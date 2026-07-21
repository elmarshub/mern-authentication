import type { ErrorRequestHandler } from "express";
import { HTTPSTATUS } from "../config/http.config.js";
import { AppError } from "../common/utils/AppError.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, next): any => {
  console.error(`Error occurred on PATH: ${req.path}`, err);

  if (err instanceof SyntaxError) {
    return res.status(HTTPSTATUS.BAD_REQUEST).json({
      message: "Invalid JSON format, please check your request body",
      error: err.message,
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
