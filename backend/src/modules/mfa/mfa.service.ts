import type { Request } from "express";
import crypto from "node:crypto";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import {  BadRequestException, NotFoundException, UnauthorizedException } from "../../common/utils/catch-error.js";
import UserModel, { type UserDocument } from "../../database/models/user.model.js";
import SessionModel from "../../database/models/session.model.js";
import { signJwtToken, accessTokenSignOptions, refreshTokenSignOptions } from "../../common/utils/jwt.js";
import { hashValue, compareValue } from "../../common/utils/bcrypt.js";
import {
  assertAccountNotLocked,
  registerFailedAttempt,
  resetFailedAttempts,
} from "../../common/utils/account-lockout.js";

const RECOVERY_CODE_COUNT = 8;

const generateRecoveryCodes = (): string[] => {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = crypto.randomBytes(8).toString("hex").toUpperCase();
    return raw.match(/.{1,4}/g)!.join("-");
  });
};

const consumeRecoveryCode = async (
  user: UserDocument,
  code: string,
): Promise<boolean> => {
  const hashedCodes = user.userPreferences.twoFactorRecoveryCodes;
  if (!hashedCodes || hashedCodes.length === 0) {
    return false;
  }

  const normalized = code.trim().toUpperCase();

  for (let i = 0; i < hashedCodes.length; i++) {
    const matches = await compareValue(normalized, hashedCodes[i]!);
    if (matches) {
      hashedCodes.splice(i, 1);
      await user.save();
      return true;
    }
  }

  return false;
};

export class MfaService {
 public async generateMFASetup(req: Request) {
   
    const user = req.user
    if(!user) {
        throw new UnauthorizedException('user not authorized')
    }

    if(user.userPreferences.enable2FA) {
        return {
            message: "MFA already enabled"
        }
    }


    let secretKey = user.userPreferences.twoFactorSecret
    if(!secretKey) {
        const secret = speakeasy.generateSecret({name: 'Mern Authentication'})
        secretKey = secret.base32;
        user.userPreferences.twoFactorSecret = secretKey;
        await user.save();
    }


    const url = speakeasy.otpauthURL({
        secret: secretKey,
        label: `${user.name}`,
        issuer: 'mernauth.com',
        encoding: 'base32'
    })


    const qrImageUrl = await qrcode.toDataURL(url)



    return {
      message: "Scan the QR code or use the setup key",
    qrImageUrl,
      secret: secretKey
    };
  }

  public async verifyMFASetup(req: Request, code: string) {
    const user = req.user
    if(!user) {
        throw new UnauthorizedException('user not authorized')
    }

    if(user.userPreferences.enable2FA) {
       return {
        message: "MFA already enabled",
        userPreferences: {
            enable2FA: user.userPreferences.enable2FA,
        }
       }
    }

    const secretKey = user.userPreferences.twoFactorSecret;
    if(!secretKey) {
        throw new BadRequestException('MFA setup was not initiated. Please request a new QR code.')
    }

    const isValid = speakeasy.totp.verify({
        secret: secretKey,
        encoding: 'base32',
        token: code,
    })

    if(!isValid) {
        throw new UnauthorizedException('Invalid MFA code. Please try again.')
    }

    const recoveryCodes = generateRecoveryCodes();
    user.userPreferences.twoFactorRecoveryCodes = await Promise.all(
      recoveryCodes.map((c) => hashValue(c)),
    );
    user.userPreferences.enable2FA = true;
    await user.save();

    return {
      message: "MFA setup verified successfully. Save these recovery codes somewhere safe — each can be used once if you lose access to your authenticator app, and they won't be shown again.",
      recoveryCodes,
      userPreferences: {
        enable2FA: user.userPreferences.enable2FA,
      },
    };
  }


  public async revokeMFA(req: Request) {
    const user = req.user
    if(!user) {
        throw new UnauthorizedException('user not authorized')
    }

    if(!user.userPreferences.enable2FA) {
       return {
        message: "MFA is not enabled",
        userPreferences: {
            enable2FA: user.userPreferences.enable2FA,
        }
       }
    }

    user.userPreferences.twoFactorSecret = undefined;
    user.userPreferences.twoFactorRecoveryCodes = undefined;
    user.userPreferences.enable2FA = false;
    await user.save();

    return {
      message: "MFA revoked successfully",
      userPreferences: {
        enable2FA: user.userPreferences.enable2FA,
      },
    };
  }

  public async verifyMFAForLogin(code: string, email: string, userAgent?: string) {
    const user = await UserModel.findOne({ email });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!user.userPreferences.enable2FA && !user.userPreferences.twoFactorSecret) {
      throw new UnauthorizedException("MFA is not enabled for this user");
    }

    assertAccountNotLocked(user);

    const isValid = speakeasy.totp.verify({
      secret: user.userPreferences.twoFactorSecret!,
      encoding: 'base32',
      token: code,
    });

    if (!isValid && !(await consumeRecoveryCode(user, code))) {
      await registerFailedAttempt(user);
      throw new BadRequestException("Invalid MFA code. Please try again.");
    }

    await resetFailedAttempts(user);

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
    };
  }
}