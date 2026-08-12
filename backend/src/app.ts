import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./docs/openapi.js";
import config from "./config/app.config.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { HTTPSTATUS } from "./config/http.config.js";
import { asyncHandler } from "./middlewares/asyncHandler.js";
import authRoutes from "./modules/auth/auth.routes.js";
import passport from "./middlewares/passport.js";
import { sessionRoutes } from "./modules/session/session.route.js";
import { authenticateJwt } from "./common/strategies/jwt.strategy.js";
import { mfaRoutes } from "./modules/mfa/mfa.route.js";

const app = express();
const basePath = config.BASE_PATH;

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: config.APP_ORIGIN,
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(passport.initialize());

app.get(
  "/",
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    res.status(HTTPSTATUS.OK).json({ message: "Hello Subscribers!" });
  }),
);

app.use(`${basePath}/auth`, authRoutes);
app.use(`${basePath}/session`, authenticateJwt, sessionRoutes);
app.use(`${basePath}/mfa`, mfaRoutes);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get("/api-docs.json", (req: Request, res: Response) => {
  res.json(openApiDocument);
});

app.use(errorHandler);

export default app;
