import { SessionService } from "./session.service.js";
import { SessionController } from "./session.controller.js";

const sessionService = new SessionService();
const sessionController = new SessionController();

export { sessionService, sessionController };
