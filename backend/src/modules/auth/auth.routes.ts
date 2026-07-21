import { Router } from "express";
import { authController } from "./auth.module.js";

const authRoutes = Router();

authRoutes.post("/register", authController.register);

export default authRoutes;
