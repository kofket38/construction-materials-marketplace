import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import { ApiError, BadRequestError } from "../utils/api-error.js";

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const normalizedError =
      error instanceof SyntaxError && "body" in error
        ? new BadRequestError("Request body contains invalid JSON.")
        : error;

    if (normalizedError instanceof ApiError) {
      res.status(normalizedError.statusCode).json({
        success: false,
        message: normalizedError.message,
        errors: normalizedError.errors,
      });
      return;
    }

    logger.error({ err: normalizedError }, "Unhandled request error");
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred.",
      errors: [],
    });
  };
}
