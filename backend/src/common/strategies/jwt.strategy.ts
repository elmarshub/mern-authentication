import type { Request } from "express";
import {
  ExtractJwt,
  Strategy as JwtStrategy,
  type StrategyOptionsWithRequest,
} from "passport-jwt";
import { UnauthorizedException } from "../utils/catch-error.js";
import { ErrorCode } from "../enums/error-code.enum.js";
import config from "../../config/app.config.js";
import type { PassportStatic } from "passport";
import { userService } from "../../modules/user/user.module.js";
import passport from "passport";
import SessionModel from "../../database/models/session.model.js";

interface JwtPayload {
  userId: string;
  sessionId: string;
}

const options: StrategyOptionsWithRequest = {
  jwtFromRequest: ExtractJwt.fromExtractors([
    (req: Request) => {
      const accessToken = req.cookies?.accessToken;

      if (!accessToken) {
        throw new UnauthorizedException(
          "Access token not found in cookies",
          ErrorCode.AUTH_TOKEN_NOT_FOUND,
        );
      }

      return accessToken;
    },
  ]),

  secretOrKey: config.JWT.SECRET,
  audience: ["user"],
  algorithms: ["HS256"],
  passReqToCallback: true,
};

export const setupJwtStrategy = (passport: PassportStatic) => {
  passport.use(
    new JwtStrategy(
      options,
      async (req: Request, payload: JwtPayload, done) => {
        try {
          const user = await userService.findUserById(payload.userId);

          if (!user) {
            return done(null, false);
          }

          const session = await SessionModel.findOne({
            _id: payload.sessionId,
            userId: payload.userId,
            expiresAt: { $gt: new Date() },
          });

          if (!session) {
            return done(null, false);
          }

          req.sessionId = payload.sessionId;
          return done(null, user);
        } catch (error) {
          return done(error, false);
        }
      },
    ),
  );
};

export const authenticateJwt = passport.authenticate("jwt", { session: false });
