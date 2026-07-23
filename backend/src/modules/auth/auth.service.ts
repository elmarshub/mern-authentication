import { ErrorCode } from "../../common/enums/error-code.enum.js";
import { VerificationEnum } from "../../common/enums/verification.enum.js";
import type {
  LoginDto,
  RegisterDto,
} from "../../common/interfaces/auth.interface.js";
import {
  BadRequestException,
  UnauthorizedException,
} from "../../common/utils/catch-error.js";
import {
  calculateExpirationDate,
  fortyFiveMinutesFromNow,
  ONE_DAY_IN_MS,
} from "../../common/utils/date-time.js";
import UserModel from "../../database/models/user.model.js";
import SessionModel from "../../database/models/session.model.js";
import VerificationCodeModel from "../../database/models/verification.js";
import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import config from "../../config/app.config.js";
import {
  signJwtToken,
  verifyJwtToken,
  refreshTokenSignOptions,
  type RefreshTPayload,
} from "../../common/utils/jwt.js";

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
    const verificationCode = await VerificationCodeModel.create({
      userId,
      type: VerificationEnum.EMAIL_VERIFICATION,
      expiresAt: fortyFiveMinutesFromNow(),
    });

    // sending verification email link

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

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new BadRequestException(
        "Invalid email or password provided",
        ErrorCode.AUTH_USER_NOT_FOUND,
      );
    }

    // check if user enable 2fa return user null

    const session = await SessionModel.create({
      userId: user._id,
      userAgent,
    });

    const accessToken = jwt.sign(
      { userId: user._id, sessionId: session._id },
      config.JWT.SECRET,
      {
        audience: ["user"],
        expiresIn: config.JWT.EXPIRES_IN as StringValue,
      },
    );

    const refreshToken = jwt.sign(
      { userId: user._id, sessionId: session._id },
      config.JWT.REFRESH_SECRET,
      {
        audience: ["user"],
        expiresIn: config.JWT.REFRESH_EXPIRES_IN as StringValue,
      },
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

    const sessionRequireRefresh =
      session.expiresAt.getTime() - now <= ONE_DAY_IN_MS;

    if (sessionRequireRefresh) {
      session.expiresAt = calculateExpirationDate(
        config.JWT.REFRESH_EXPIRES_IN,
      );

      await session.save();
    }

    const newRefreshToken = sessionRequireRefresh
      ? signJwtToken(
          {
            sessionId: session._id,
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
}
