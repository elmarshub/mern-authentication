import { getEnv } from "../common/utils/get-env.js";

const appConfig = () => {
  const NODE_ENV = getEnv("NODE_ENV", "development");
  const APP_ORIGIN = getEnv("APP_ORIGIN", "localhost");
  const PORT = getEnv("PORT", "5000");
  const BASE_PATH = getEnv("BASE_PATH", "/api/v1");
  const JWT_SECRET = getEnv("JWT_SECRET", "secret");
  const JWT_EXPIRES_IN = getEnv("JWT_EXPIRES_IN", "15m");
  const JWT_REFRESH_SECRET = getEnv("JWT_REFRESH_SECRET", "refresh-secret");
  const JWT_REFRESH_EXPIRES_IN = getEnv("JWT_REFRESH_EXPIRES_IN", "30d");
  const MONGO_URI = getEnv("MONGO_URI");

  return {
    NODE_ENV,
    APP_ORIGIN,
    PORT,
    BASE_PATH,
    JWT_SECRET,
    JWT_EXPIRES_IN,
    JWT_REFRESH_SECRET,
    JWT_REFRESH_EXPIRES_IN,
    MONGO_URI,
  };
};

export default appConfig();
