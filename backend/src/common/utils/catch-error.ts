import { AppError } from "./AppError.js";
import { ErrorCode } from "../enums/error-code.enum.js";
import { HTTPSTATUS, type HttpStatusCode } from "../../config/http.config.js";

export class NotFoundException extends AppError {
  constructor(message = "Resource not found", errorCode: ErrorCode) {
    super(
      message,
      HTTPSTATUS.NOT_FOUND,
      errorCode || ErrorCode.RESOURCE_NOT_FOUND,
    );
  }
}

export class BadRequestException extends AppError {
  constructor(
    message = "Bad request",
    errorCode: ErrorCode = ErrorCode.BAD_REQUEST,
  ) {
    super(message, HTTPSTATUS.BAD_REQUEST, errorCode);
  }
}

export class UnauthorizedException extends AppError {
  constructor(message = "Unauthorized", errorCode: ErrorCode) {
    super(message, HTTPSTATUS.UNAUTHORIZED, errorCode);
  }
}

export class ForbiddenException extends AppError {
  constructor(message = "Forbidden", errorCode: ErrorCode) {
    super(message, HTTPSTATUS.FORBIDDEN, errorCode);
  }
}

export class MethodNotAllowedException extends AppError {
  constructor(
    message: string,
    statusCode: HttpStatusCode,
    errorCode: ErrorCode,
  ) {
    super(message, statusCode, errorCode);
  }
}

export class InternalServerErrorException extends AppError {
  constructor(
    message: string,
    statusCode: HttpStatusCode,
    errorCode: ErrorCode,
  ) {
    super(message, statusCode, errorCode);
  }
}
