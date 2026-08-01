import type { Request, Response } from "express";
import { SessionService } from "./session.service.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { HTTPSTATUS } from "../../config/http.config.js";
import {
  NotFoundException,
  UnauthorizedException,
} from "../../common/utils/catch-error.js";
import z from "zod";

export class SessionController {
  private sessionService: SessionService;

  constructor() {
    this.sessionService = new SessionService();
  }

  public getAllSessions = asyncHandler(
    async (req: Request, res: Response): Promise<any> => {
      const userId = req.user?.id;
      const sessionId = req.sessionId;
      if (!userId) {
        throw new UnauthorizedException("User not authenticated");
      }

      const { sessions } = await this.sessionService.getAllSessions(userId);

      const modifySessions = sessions.map((session) => ({
        ...session.toObject(),
        ...(session.id === sessionId && { isCurrentSession: true }),
      }));

      return res.status(HTTPSTATUS.OK).json({
        message: "Sessions retrieved successfully",
        data: modifySessions,
      });
    },
  );

  public getSession = asyncHandler(
    async (req: Request, res: Response): Promise<any> => {
      const sessionId = req.sessionId;
      const userId = req.user?.id;
      if (!sessionId) {
        throw new NotFoundException("Session not found");
      }

      if (!userId) {
        throw new UnauthorizedException("User not authenticated");
      }

      const { user } = await this.sessionService.getSessionById(
        sessionId,
        userId,
      );

      return res.status(HTTPSTATUS.OK).json({
        message: "Current session retrieved successfully",
        data: user,
      });
    },
  );

  public deleteSession = asyncHandler(
    async (req: Request, res: Response): Promise<any> => {
      const sessionId = z.string().parse(req.params.id);
      const userId = req.user?.id;

      if (!sessionId) {
        throw new NotFoundException("Session not found");
      }

      if (!userId) {
        throw new UnauthorizedException("User not authenticated");
      }

      await this.sessionService.deleteSession(sessionId, userId);

      return res.status(HTTPSTATUS.OK).json({
        message: "Session deleted successfully",
      });
    },
  );
}
