import type { RequestHandler } from "express";
import type { UserRepository } from "../repositories/user.repository.js";
import type { TokenService } from "../services/token.service.js";
import { UnauthorizedError } from "../utils/api-error.js";

export function authenticate(
  tokenService: TokenService,
  users: Pick<UserRepository, "findById">,
): RequestHandler {
  return async (req, _res, next) => {
    const authorization = req.header("authorization");
    const [scheme, token, extra] = authorization?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token || extra) {
      next(new UnauthorizedError("A valid Bearer access token is required."));
      return;
    }

    const payload = tokenService.verifyAccessToken(token);
    const user = await users.findById(payload.userId);

    if (!user || !user.isActive) {
      next(
        new UnauthorizedError(
          "The authenticated account is unavailable or disabled.",
        ),
      );
      return;
    }

    req.auth = {
      userId: user.id,
      role: user.role,
    };

    next();
  };
}
