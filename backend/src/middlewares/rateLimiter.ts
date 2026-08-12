import rateLimit from "express-rate-limit";
import { ErrorCode } from "../common/enums/error-code.enum.js";

const rateLimitResponse = (message: string) => ({
  message,
  error: ErrorCode.AUTH_TOO_MANY_ATTEMPTS,
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse("Too many login attempts, please try again later"),
});

export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse(
    "Too many accounts created from this IP, please try again later",
  ),
});

export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse("Too many requests, please try again later"),
});

export const mfaVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse("Too many MFA attempts, please try again later"),
});

export const resendVerificationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse("Too many requests, please try again later"),
});
