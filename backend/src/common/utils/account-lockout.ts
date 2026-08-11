import type { UserDocument } from "../../database/models/user.model.js";
import { ErrorCode } from "../enums/error-code.enum.js";
import { HTTPSTATUS } from "../../config/http.config.js";
import { HttpException } from "./catch-error.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export const assertAccountNotLocked = (user: UserDocument): void => {
  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
    throw new HttpException(
      `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      HTTPSTATUS.TOO_MANY_REQUESTS,
      ErrorCode.AUTH_TOO_MANY_ATTEMPTS,
    );
  }
};

export const registerFailedAttempt = async (user: UserDocument): Promise<void> => {
  user.failedLoginAttempts += 1;

  if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    user.failedLoginAttempts = 0;
  }

  await user.save();
};

export const resetFailedAttempts = async (user: UserDocument): Promise<void> => {
  if (user.failedLoginAttempts !== 0 || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
  }
};
