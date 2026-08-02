import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import {
  ApiError,
  BadRequestError,
  PayloadTooLargeError,
} from "../utils/api-error.js";

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const normalizedError = isPayloadTooLargeError(error)
      ? new PayloadTooLargeError()
      : error instanceof SyntaxError && "body" in error
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

function isPayloadTooLargeError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (("type" in error && error.type === "entity.too.large") ||
      ("status" in error && error.status === 413))
  );
}
