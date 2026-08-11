import { setAuthenticationCookies } from "../../common/utils/cookie.js";
import { verifyMFAForLoginSchema, verifyMFASchema } from "../../common/validators/mfa.validator.js";
import { HTTPSTATUS } from "../../config/http.config.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";
import type { MfaService } from "./mfa.service.js";
import type { Request, Response } from "express";

export class MfaController {
    private mfaService: MfaService;

    constructor(mfaService: MfaService) {
        this.mfaService = mfaService;
    }

    public generateMFASetup = asyncHandler(
        async (req: Request, res: Response) => {
       const {secret, qrImageUrl, message} = await this.mfaService.generateMFASetup(req);


       return res.status(HTTPSTATUS.OK).json({
        message,
        qrImageUrl,
        secret
       })
     }
 );


    public verifyMFASetup = asyncHandler(
        async (req: Request, res: Response) => {
            const { code } = verifyMFASchema.parse({
                ...req.body,
            });

            const { userPreferences, message, recoveryCodes } = await this.mfaService.verifyMFASetup(
                req,
                code
            );

            return res.status(HTTPSTATUS.OK).json({
                message,
                userPreferences,
                recoveryCodes,
            });
        }
    );


    public revokeMFA = asyncHandler(
        async (req: Request, res: Response) => {
            const { userPreferences, message } = await this.mfaService.revokeMFA(
                req
            );

            return res.status(HTTPSTATUS.OK).json({
                message,
                userPreferences,
            });
        }
    );



    public verifyMFAForLogin = asyncHandler(
        async (req: Request, res: Response) => {
            const { code, email, userAgent } = verifyMFAForLoginSchema.parse({
                ...req.body,
                userAgent: req.headers["user-agent"],
            });

          
        const {user, accessToken, refreshToken} = 
        
        await this.mfaService.verifyMFAForLogin( code, email, userAgent);

        return setAuthenticationCookies({
            res,
            accessToken,
            refreshToken,
            mfaRequired: false,
          })
            .status(HTTPSTATUS.OK)
            .json({
              message: "Verified & login successfully",
              user,
            });
        }
    );
}