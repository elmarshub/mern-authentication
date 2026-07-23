import { UnauthorizedException } from "../../common/utils/catch-error.js";
import {
  setAuthenticationCookies,
  clearAuthenticationCookies,
  getRefreshTokenCookieOptions,
  getAccessTokenCookieOptions,
} from "../../common/utils/cookie.js";
import {
  loginSchema,
  registerSchema,
} from "../../common/validators/auth.validator.js";
import { HTTPSTATUS } from "../../config/http.config.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { AuthService } from "./auth.service.js";
import type { Request, Response } from "express";
import { verificationEmailSchema } from "../../common/validators/auth.validator.js";

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
        .json({ message: "User registered Successfully", data: user });
    },
  );

  public login = asyncHandler(
    async (req: Request, res: Response): Promise<any> => {
      const userAgent = req.get("user-agent");
      const body = loginSchema.parse({
        ...req.body,
        userAgent,
      });

      const { user, accessToken, refreshToken, mfaRequired } =
        await this.authService.login(body);

      return setAuthenticationCookies({
        res,
        accessToken,
        refreshToken,
        mfaRequired,
      })
        .status(HTTPSTATUS.OK)
        .json({
          message: "User logged in Successfully",
          mfaRequired,
          user,
        });
    },
  );

  public refreshToken = asyncHandler(
    async (req: Request, res: Response): Promise<any> => {
      const refreshToken = req.cookies.refreshToken as string | undefined;
      if (!refreshToken) {
        throw new UnauthorizedException("Missing refresh token");
      }

      const { accessToken, newRefreshToken } =
        await this.authService.refreshToken(refreshToken);

      if (newRefreshToken) {
        res.cookie(
          "refreshToken",
          newRefreshToken,
          getRefreshTokenCookieOptions(),
        );
      }

      return res
        .status(HTTPSTATUS.OK)
        .cookie("accessToken", accessToken, getAccessTokenCookieOptions())
        .json({
          message: "Refresh access token successfully",
        });
    },
  );

  public verifyEmail = asyncHandler(
    async (req: Request, res: Response): Promise<any> => {
      const { code } = verificationEmailSchema.parse(req.body);
      await this.authService.verifyEmail(code);

      return res.status(HTTPSTATUS.OK).json({
        message: "Email verified successfully",
      });
    },
  );
}
