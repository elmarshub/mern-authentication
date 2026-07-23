import type { ErrorRequestHandler } from "express";
import { HTTPSTATUS } from "../config/http.config.js";
import { AppError } from "../common/utils/AppError.js";
import z from "zod";
import {
  REFRESH_PATH,
  clearAuthenticationCookies,
} from "../common/utils/cookie.js";

const formatZodError = (err: z.ZodError) =>
  err?.issues?.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

export const errorHandler: ErrorRequestHandler = (err, req, res, next): any => {
  console.error(`Error occurred on PATH: ${req.path}`, err);

  if (req.path === REFRESH_PATH) {
    clearAuthenticationCookies(res);
  }

  if (err instanceof SyntaxError) {
    return res.status(HTTPSTATUS.BAD_REQUEST).json({
      message: "Invalid JSON format, please check your request body",
      error: err.message,
    });
  }

  if (err.name === z.ZodError.name) {
    return res.status(HTTPSTATUS.BAD_REQUEST).json({
      message: "Invalid request data",
      error: formatZodError(err as z.ZodError),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
      error: err.errorCode,
    });
  }

  return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
    message: "internal server error",
    error: err?.message || "Unknown error",
  });
};
