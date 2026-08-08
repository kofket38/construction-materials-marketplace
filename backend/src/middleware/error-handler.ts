import type { ErrorRequestHandler } from "express";
import { MulterError } from "multer";
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
      : error instanceof MulterError
        ? normalizeMulterError(error)
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

function normalizeMulterError(error: MulterError): ApiError {
  if (error.code === "LIMIT_FILE_SIZE") {
    return new PayloadTooLargeError(
      "The payment screenshot must not exceed 5 MB.",
    );
  }

  return new BadRequestError("Payment proof upload failed.", [
    {
      field: "body.proof",
      message:
        error.code === "LIMIT_UNEXPECTED_FILE"
          ? "Upload one image using the proof field."
          : "The payment screenshot could not be processed.",
    },
  ]);
}

function isPayloadTooLargeError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (("type" in error && error.type === "entity.too.large") ||
      ("status" in error && error.status === 413))
  );
}
