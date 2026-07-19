import type { RequestHandler } from "express";
import type { TokenService } from "../services/token.service.js";
import { UnauthorizedError } from "../utils/api-error.js";

export function authenticate(tokenService: TokenService): RequestHandler {
  return (req, _res, next) => {
    const authorization = req.header("authorization");
    const [scheme, token, extra] = authorization?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token || extra) {
      next(new UnauthorizedError("A valid Bearer access token is required."));
      return;
    }

    const payload = tokenService.verifyAccessToken(token);
    req.auth = {
      userId: payload.userId,
      role: payload.role,
    };

    next();
  };
}
