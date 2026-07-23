import { Router } from "express";
import { authController } from "./auth.module.js";

const authRoutes = Router();

authRoutes.post("/register", authController.register);
authRoutes.post("/login", authController.login);
authRoutes.post("/refresh", authController.refreshToken);
authRoutes.post("/verify/email", authController.verifyEmail);

export default authRoutes;
