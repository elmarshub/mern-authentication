import { MfaService } from "./mfa.service.js";
import { MfaController } from "./mfa.controller.js";

const mfsService = new MfaService();
const mfaController = new MfaController(mfsService);

export { mfsService, mfaController };