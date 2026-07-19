import type { RequestHandler } from "express";
import type { UserRole } from "../repositories/user.repository.js";
import { ForbiddenError, UnauthorizedError } from "../utils/api-error.js";

export function authorizeRoles(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }

    if (!roles.includes(req.auth.role)) {
      next(new ForbiddenError());
      return;
    }

    next();
  };
}
