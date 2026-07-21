import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";

const authService = new AuthService();
const authController = new AuthController();

export { authService, authController };
