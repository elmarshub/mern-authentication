import type { SignOptions, VerifyOptions } from "jsonwebtoken";
import type { StringValue } from "ms";
import jwt from "jsonwebtoken";
import type { SessionDocument } from "../../database/models/session.model.js";
import type { UserDocument } from "../../database/models/user.model.js";
import config from "../../config/app.config.js";

export type AccessTPayload = {
  userId: UserDocument["_id"];
  sessionId: SessionDocument["_id"];
};

export type RefreshTPayload = {
  sessionId: SessionDocument["_id"];
};

type SignOptsAndSecret = SignOptions & {
  secret: string;
};

// Separate defaults for signing vs verifying — they are different types.
const signDefaults: SignOptions = {
  audience: ["user"],
};

const verifyDefaults: VerifyOptions = {
  audience: ["user"],
};

export const accessTokenSignOptions: SignOptsAndSecret = {
  expiresIn: config.JWT.EXPIRES_IN as StringValue,
  secret: config.JWT.SECRET,
};

export const refreshTokenSignOptions: SignOptsAndSecret = {
  expiresIn: config.JWT.REFRESH_EXPIRES_IN as StringValue,
  secret: config.JWT.REFRESH_SECRET,
};

export const signJwtToken = (
  payload: AccessTPayload | RefreshTPayload,
  options?: SignOptsAndSecret,
) => {
  const { secret, ...opts } = options || accessTokenSignOptions;
  return jwt.sign(payload, secret, {
    ...signDefaults,
    ...opts,
  });
};

export const verifyJwtToken = <TPayload extends object = AccessTPayload>(
  token: string,
  options?: VerifyOptions & { secret: string },
) => {
  try {
    const { secret = config.JWT.SECRET, ...opts } = options || {};
    const payload = jwt.verify(token, secret, {
      ...verifyDefaults,
      ...opts,
    }) as TPayload;

    return { payload };
  } catch (err) {
    return {
      error: (err as Error).message,
    };
  }
};
