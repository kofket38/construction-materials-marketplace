import { randomUUID } from "node:crypto";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import type {
  AccessTokenPayload,
  AuthenticatedUser,
  RefreshTokenPayload,
} from "../types/auth.js";
import type { UserRole } from "../repositories/user.repository.js";
import { UnauthorizedError } from "../utils/api-error.js";

const TOKEN_ISSUER = "cmm-api";
const TOKEN_AUDIENCE = "cmm-client";
const USER_ROLES: readonly UserRole[] = ["CUSTOMER", "SELLER", "ADMIN"];

export interface TokenService {
  createAccessToken(user: AuthenticatedUser): string;
  createRefreshToken(user: AuthenticatedUser): string;
  verifyAccessToken(token: string): AccessTokenPayload;
  verifyRefreshToken(token: string): RefreshTokenPayload;
}

function parseUserRole(value: unknown): UserRole | null {
  if (value === "BUYER") {
    return "CUSTOMER";
  }

  return typeof value === "string" && USER_ROLES.includes(value as UserRole)
    ? (value as UserRole)
    : null;
}

export class JwtTokenService implements TokenService {
  createAccessToken(user: AuthenticatedUser): string {
    return this.signToken(
      user,
      "access",
      env.JWT_ACCESS_SECRET,
      env.ACCESS_TOKEN_EXPIRES,
    );
  }

  createRefreshToken(user: AuthenticatedUser): string {
    return this.signToken(
      user,
      "refresh",
      env.JWT_REFRESH_SECRET,
      env.REFRESH_TOKEN_EXPIRES,
    );
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return {
      ...this.verifyToken(token, env.JWT_ACCESS_SECRET, "access"),
      tokenType: "access",
    };
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return {
      ...this.verifyToken(token, env.JWT_REFRESH_SECRET, "refresh"),
      tokenType: "refresh",
    };
  }

  private signToken(
    user: AuthenticatedUser,
    tokenType: "access" | "refresh",
    secret: string,
    expiresIn: string,
  ): string {
    const options: SignOptions = {
      algorithm: "HS256",
      audience: TOKEN_AUDIENCE,
      expiresIn: expiresIn as NonNullable<SignOptions["expiresIn"]>,
      issuer: TOKEN_ISSUER,
      jwtid: randomUUID(),
      subject: user.userId,
    };

    return jwt.sign(
      {
        role: user.role,
        tokenType,
      },
      secret,
      options,
    );
  }

  private verifyToken(
    token: string,
    secret: string,
    expectedTokenType: "access" | "refresh",
  ): AuthenticatedUser {
    let payload: string | JwtPayload;

    try {
      payload = jwt.verify(token, secret, {
        algorithms: ["HS256"],
        audience: TOKEN_AUDIENCE,
        issuer: TOKEN_ISSUER,
      });
    } catch {
      throw new UnauthorizedError("The authentication token is invalid or expired.");
    }

    const role =
      typeof payload === "string" ? null : parseUserRole(payload.role);

    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      payload.tokenType !== expectedTokenType ||
      !role
    ) {
      throw new UnauthorizedError("The authentication token is invalid.");
    }

    return {
      userId: payload.sub,
      role,
    };
  }
}
