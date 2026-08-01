import SessionModel from "../../database/models/session.model.js";
import { NotFoundException } from "../../common/utils/catch-error.js";

export class SessionService {
  public async getAllSessions(userId: string) {
    const sessions = await SessionModel.find(
      {
        userId,
        expiresAt: { $gt: Date.now() },
      },
      {
        _id: 1,
        userId: 1,
        userAgent: 1,
        createdAt: 1,
        expiresAt: 1,
      },
      {
        sort: { createdAt: -1 },
      },
    );

    return {
      sessions,
    };
  }

  public async getSessionById(sessionId: string, userId: string) {
    const session = await SessionModel.findOne({ _id: sessionId, userId })
      .populate("userId")
      .select("-expiresAt");

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    const { userId: user } = session;

    return {
      user,
    };
  }

  public async deleteSession(sessionId: string, userId: string) {
    const deletedSession = await SessionModel.findOneAndDelete({
      _id: sessionId,
      userId: userId,
    });

    if (!deletedSession) {
      throw new NotFoundException("Session not found");
    }

    return;
  }
}
