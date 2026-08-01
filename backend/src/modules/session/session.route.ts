import { Router } from "express";
import { sessionController } from "./session.module.js";

const sessionRoutes = Router();

sessionRoutes.get("/all", sessionController.getAllSessions);
sessionRoutes.get("/", sessionController.getSession);
sessionRoutes.delete("/:id", sessionController.deleteSession);

export { sessionRoutes };
