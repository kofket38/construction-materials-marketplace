import type { RequestHandler } from "express";

/**
 * Wraps a mandatory authentication middleware so it becomes optional.
 * When a valid token is present, req.auth is populated as usual.
 * When the token is missing or invalid, the request continues unauthenticated
 * (req.auth remains undefined) rather than being rejected.
 *
 * Shared by the professional-profile and project routes, whose public read
 * endpoints populate ownership context when available and delegate all
 * visibility/authorization decisions to their controllers and services.
 */
export function tryAuthenticate(authenticate: RequestHandler): RequestHandler {
  return (req, res, next) => {
    authenticate(req, res, (err) => {
      // Suppress authentication errors so public access still works.
      // The controller/service handles authorization for restricted resources.
      void err;
      next();
    });
  };
}
