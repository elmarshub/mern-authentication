import { Router } from "express";
import { authenticateJwt } from "../../common/strategies/jwt.strategy.js";
import { mfaController } from "./mfa.module.js";
import { mfaVerifyRateLimiter } from "../../middlewares/rateLimiter.js";

const mfaRoutes = Router()


mfaRoutes.get("/setup", authenticateJwt, mfaController.generateMFASetup);
mfaRoutes.post("/verify", authenticateJwt, mfaVerifyRateLimiter, mfaController.verifyMFASetup);
mfaRoutes.post("/verify-login", mfaVerifyRateLimiter, mfaController.verifyMFAForLogin);
mfaRoutes.put("/revoke", authenticateJwt, mfaController.revokeMFA);


export { mfaRoutes };