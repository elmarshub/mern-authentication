import { ErrorCode } from "../../common/enums/error-code.enum.js";
import { VerificationEnum } from "../../common/enums/verification.enum.js";
import type {
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from "../../common/interfaces/auth.interface.js";
import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "../../common/utils/catch-error.js";
import {
  anHourFromNow,
  calculateExpirationDate,
  fortyFiveMinutesFromNow,
  ONE_DAY_IN_MS,
  threeMinutesAgo,
} from "../../common/utils/date-time.js";
import UserModel from "../../database/models/user.model.js";
import SessionModel from "../../database/models/session.model.js";
import VerificationModel from "../../database/models/verification.js";
import config from "../../config/app.config.js";
import {
  signJwtToken,
  verifyJwtToken,
  accessTokenSignOptions,
  refreshTokenSignOptions,
  type RefreshTPayload,
} from "../../common/utils/jwt.js";
import { sendEmail } from "../../mailers/mailer.js";
import {
  passwordResetTemplate,
  verifyEmailTemplate,
} from "../../mailers/templates/template.js";
import { HTTPSTATUS } from "../../config/http.config.js";
import { hashValue } from "../../common/utils/bcrypt.js";
import {
  assertAccountNotLocked,
  registerFailedAttempt,
  resetFailedAttempts,
} from "../../common/utils/account-lockout.js";

export class AuthService {
  public async register(registerData: RegisterDto) {
    const { name, email, password } = registerData;

    const existingUser = await UserModel.exists({
      email,
    });

    if (existingUser) {
      throw new BadRequestException(
        "User already exists with this email",
        ErrorCode.AUTH_EMAIL_ALREADY_EXISTS,
      );
    }

    const newUser = await UserModel.create({
      name,
      email,
      password,
    });

    const userId = newUser._id;

    // create a verification code
    const verification = await VerificationModel.create({
      userId,
      type: VerificationEnum.EMAIL_VERIFICATION,
      expiresAt: fortyFiveMinutesFromNow(),
    });

    // sending verification email link
    const verificationUrl = `${config.APP_ORIGIN}/confirm-account?code=${verification.code}`;
    const { data: emailData, error: emailError } = await sendEmail({
      to: newUser.email,
      ...verifyEmailTemplate(verificationUrl),
    });

    if (!emailData || emailError) {
      await VerificationModel.findByIdAndDelete(verification._id);
      await UserModel.findByIdAndDelete(userId);
      throw new InternalServerErrorException(
        "Failed to send verification email",
        HTTPSTATUS.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      user: newUser,
    };
  }

  public async login(loginData: LoginDto) {
    const { email, password, userAgent } = loginData;

    const user = await UserModel.findOne({ email });

    if (!user) {
      throw new BadRequestException(
        "Invalid email or password provided",
        ErrorCode.AUTH_USER_NOT_FOUND,
      );
    }

    assertAccountNotLocked(user);

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await registerFailedAttempt(user);
      throw new BadRequestException(
        "Invalid email or password provided",
        ErrorCode.AUTH_USER_NOT_FOUND,
      );
    }

    await resetFailedAttempts(user);

    // check if user enable 2fa return user null
    if(user.userPreferences.enable2FA) {
      return {
        user: null,
        mfaRequired: true,
        accessToken: "",
        refreshToken: "",
      }
    }

    const session = await SessionModel.create({
      userId: user._id,
      userAgent,
    });

    const accessToken = signJwtToken(
      { userId: user._id, sessionId: session._id },
      accessTokenSignOptions,
    );

    const refreshToken = signJwtToken(
      { sessionId: session._id, version: session.refreshTokenVersion },
      refreshTokenSignOptions,
    );

    return {
      user,
      accessToken,
      refreshToken,
      mfaRequired: false,
    };
  }

  public async refreshToken(refreshToken: string) {
    const { payload, error } = verifyJwtToken<RefreshTPayload>(refreshToken, {
      secret: refreshTokenSignOptions.secret,
    });

    if (error || !payload) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const session = await SessionModel.findById(payload.sessionId);
    const now = Date.now();

    if (!session) {
      throw new UnauthorizedException("Session does not exist");
    }

    if (session.expiresAt.getTime() <= now) {
      throw new UnauthorizedException("Session expired");
    }

    if (payload.version !== session.refreshTokenVersion) {
      await SessionModel.findByIdAndDelete(session._id);
      throw new UnauthorizedException(
        "Refresh token reuse detected, session revoked. Please log in again.",
      );
    }

    const sessionRequireRefresh =
      session.expiresAt.getTime() - now <= ONE_DAY_IN_MS;

    if (sessionRequireRefresh) {
      session.expiresAt = calculateExpirationDate(
        config.JWT.REFRESH_EXPIRES_IN,
      );
      session.refreshTokenVersion += 1;

      await session.save();
    }

    const newRefreshToken = sessionRequireRefresh
      ? signJwtToken(
          {
            sessionId: session._id,
            version: session.refreshTokenVersion,
          },
          refreshTokenSignOptions,
        )
      : undefined;

    const accessToken = signJwtToken({
      userId: session.userId,
      sessionId: session._id,
    });

    return {
      accessToken,
      newRefreshToken,
    };
  }

  public async verifyEmail(code: string) {
    const validCode = await VerificationModel.findOneAndDelete({
      code: code,
      type: VerificationEnum.EMAIL_VERIFICATION,
      expiresAt: { $gt: new Date() },
    });

    if (!validCode) {
      throw new BadRequestException("Invalid or expired verification code");
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      validCode.userId,
      {
        isEmailVerified: true,
      },
      { new: true },
    );

    if (!updatedUser) {
      throw new BadRequestException(
        "Unable to verify email address",
        ErrorCode.VERIFICATION_ERROR,
      );
    }

    return {
      user: updatedUser,
    };
  }

  public async forgotPassword(email: string) {
    const user = await UserModel.findOne({
      email: email,
    });

    if (!user) {
      return;
    }

    //check mail rate limit is 2 email per 3mins or 10mins interval
    const timeAgo = threeMinutesAgo();
    const maxAttempts = 2;
    const count = await VerificationModel.countDocuments({
      userId: user._id,
      type: VerificationEnum.PASSWORD_RESET,
      createdAt: { $gt: timeAgo },
    });

    if (count >= maxAttempts) {
      throw new HttpException(
        "Too many request, try again later",
        HTTPSTATUS.TOO_MANY_REQUESTS,
        ErrorCode.AUTH_TOO_MANY_ATTEMPTS,
      );
    }

    const expiresAt = anHourFromNow();
    const validCode = await VerificationModel.create({
      userId: user._id,
      type: VerificationEnum.PASSWORD_RESET,
      expiresAt,
    });

    const resetLink = `${config.APP_ORIGIN}/reset-password?code=${validCode.code}&exp=${expiresAt.getTime()}`;

    const { data, error } = await sendEmail({
      to: user.email,
      ...passwordResetTemplate(resetLink),
    });

    if (!data || error) {
      await VerificationModel.findByIdAndDelete(validCode._id);
      throw new InternalServerErrorException(
        "Failed to send password reset email",
        HTTPSTATUS.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      url: resetLink,
      emailId: data.id,
    };
  }

  public async resetPassword({ password, verificationCode }: ResetPasswordDto) {
    const validCode = await VerificationModel.findOneAndDelete({
      code: verificationCode,
      type: VerificationEnum.PASSWORD_RESET,
      expiresAt: { $gt: new Date() },
    });

    if (!validCode) {
      throw new NotFoundException("Invalid or expired verification code");
    }

    const hashedPassword = await hashValue(password);

    const updatedUser = await UserModel.findByIdAndUpdate(validCode.userId, {
      password: hashedPassword,
    });

    if (!updatedUser) {
      throw new BadRequestException("Failed to reset password");
    }

    await SessionModel.deleteMany({
      userId: updatedUser._id,
    });

    return {
      user: updatedUser,
    };
  }

  public async changePassword(
    userId: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await UserModel.findById(userId);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    assertAccountNotLocked(user);

    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      await registerFailedAttempt(user);
      throw new BadRequestException("Current password is incorrect");
    }

    await resetFailedAttempts(user);

    user.password = newPassword;
    await user.save();

    await SessionModel.deleteMany({ userId, _id: { $ne: sessionId } });

    return {
      message: "Password changed successfully",
    };
  }

  public async resendVerificationEmail(email: string) {
    const user = await UserModel.findOne({ email });

    if (!user || user.isEmailVerified) {
      return;
    }

    const timeAgo = threeMinutesAgo();
    const maxAttempts = 2;
    const count = await VerificationModel.countDocuments({
      userId: user._id,
      type: VerificationEnum.EMAIL_VERIFICATION,
      createdAt: { $gt: timeAgo },
    });

    if (count >= maxAttempts) {
      throw new HttpException(
        "Too many request, try again later",
        HTTPSTATUS.TOO_MANY_REQUESTS,
        ErrorCode.AUTH_TOO_MANY_ATTEMPTS,
      );
    }

    const verification = await VerificationModel.create({
      userId: user._id,
      type: VerificationEnum.EMAIL_VERIFICATION,
      expiresAt: fortyFiveMinutesFromNow(),
    });

    const verificationUrl = `${config.APP_ORIGIN}/confirm-account?code=${verification.code}`;
    const { data, error } = await sendEmail({
      to: user.email,
      ...verifyEmailTemplate(verificationUrl),
    });

    if (!data || error) {
      await VerificationModel.findByIdAndDelete(verification._id);
      throw new InternalServerErrorException(
        "Failed to send verification email",
        HTTPSTATUS.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
      );
    }

    return;
  }

  public async logout(userId: string, sessionId: string) {
    const session = await SessionModel.findOneAndDelete({
      _id: sessionId,
      userId: userId,
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    return {
      message: "Logged out successfully",
    };
  }
}
