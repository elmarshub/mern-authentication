import { getEnv } from "../common/utils/get-env.js";

const appConfig = () => {
  const NODE_ENV = getEnv("NODE_ENV", "development");
  const APP_ORIGIN =
    NODE_ENV === "development"
      ? getEnv("APP_ORIGIN", "http://localhost:3000")
      : getEnv("APP_ORIGIN");
  const PORT = getEnv("PORT", "5000");
  const BASE_PATH = getEnv("BASE_PATH", "/api/v1");
  const JWT_SECRET =
    NODE_ENV === "development"
      ? getEnv("JWT_SECRET", "secret")
      : getEnv("JWT_SECRET");
  const JWT_EXPIRES_IN = getEnv("JWT_EXPIRES_IN", "15m");
  const JWT_REFRESH_SECRET =
    NODE_ENV === "development"
      ? getEnv("JWT_REFRESH_SECRET", "refresh-secret")
      : getEnv("JWT_REFRESH_SECRET");
  const JWT_REFRESH_EXPIRES_IN = getEnv("JWT_REFRESH_EXPIRES_IN", "30d");
  const MONGO_URI = getEnv("MONGO_URI");
  const MAILER_SENDER =
    NODE_ENV === "development"
      ? getEnv("MAILER_SENDER", "noreply@example.com")
      : getEnv("MAILER_SENDER");
  const RESEND_API_KEY = getEnv("RESEND_API_KEY");

  return {
    NODE_ENV,
    APP_ORIGIN,
    PORT,
    BASE_PATH,
    JWT: {
      SECRET: JWT_SECRET,
      EXPIRES_IN: JWT_EXPIRES_IN,
      REFRESH_SECRET: JWT_REFRESH_SECRET,
      REFRESH_EXPIRES_IN: JWT_REFRESH_EXPIRES_IN,
    },
    MONGO_URI,
    MAILER: {
      SENDER: MAILER_SENDER,
      RESEND_API_KEY,
    },
  };
};

export default appConfig();
