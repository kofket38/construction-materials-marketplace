import type { RequestHandler } from "express";
import { NotFoundError } from "../utils/api-error.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} was not found.`));
};
