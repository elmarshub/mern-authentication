import { Router } from "express";
import { authController } from "./auth.module.js";
import { authenticateJwt } from "../../common/strategies/jwt.strategy.js";
import {
  loginRateLimiter,
  registerRateLimiter,
  refreshRateLimiter,
} from "../../middlewares/rateLimiter.js";

const authRoutes = Router();

authRoutes.post("/register", registerRateLimiter, authController.register);
authRoutes.post("/login", loginRateLimiter, authController.login);
authRoutes.post("/refresh", refreshRateLimiter, authController.refreshToken);
authRoutes.post("/verify/email", authController.verifyEmail);
authRoutes.post("/verify/email/resend", authController.resendVerificationEmail);
authRoutes.post("/password/forgot", authController.forgotPassword);
authRoutes.post("/password/reset", authController.resetPassword);
authRoutes.put("/password/change", authenticateJwt, authController.changePassword);
authRoutes.post("/logout", authenticateJwt, authController.logout);

export default authRoutes;
