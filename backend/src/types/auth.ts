import type { UserRole } from "../repositories/user.repository.js";

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}

export interface AccessTokenPayload extends AuthenticatedUser {
  tokenType: "access";
}

export interface RefreshTokenPayload extends AuthenticatedUser {
  tokenType: "refresh";
}
