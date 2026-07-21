import { registerSchema } from "../../common/validators/auth.validator.js";
import { HTTPSTATUS } from "../../config/http.config.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { AuthService } from "./auth.service.js";
import type { Request, Response } from "express";

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  public register = asyncHandler(
    async (req: Request, res: Response): Promise<any> => {
      const body = registerSchema.parse({
        ...req.body,
      });

      const { user } = await this.authService.register(body);

      return res
        .status(HTTPSTATUS.CREATED)
        .json({ message: "User registered Successfully", user });
    },
  );
}
