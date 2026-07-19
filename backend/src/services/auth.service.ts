import type {
  UserEntity,
  UserRepository,
  UserRole,
} from "../repositories/user.repository.js";
import { DuplicateEmailError } from "../repositories/errors.js";
import type {
  LoginBody,
  RegisterBody,
} from "../validators/auth.validators.js";
import {
  ConflictError,
  UnauthorizedError,
} from "../utils/api-error.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { hashRefreshToken } from "../utils/token-hash.js";
import type { TokenService } from "./token.service.js";

export interface PublicUser {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  role: UserRole;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticationResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

function toPublicUser(user: UserEntity): PublicUser {
  return {
    id: user.id,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    company: user.company,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterBody): Promise<AuthenticationResult> {
    const existingUser = await this.users.findByEmail(input.email);

    if (existingUser) {
      throw new ConflictError("A user with that email already exists.");
    }

    const passwordHash = await hashPassword(input.password);

    let user: UserEntity;
    try {
      user = await this.users.create({
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        ...(input.firstName !== undefined
          ? { firstName: input.firstName }
          : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.company !== undefined ? { company: input.company } : {}),
      });
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        throw new ConflictError(error.message);
      }

      throw error;
    }

    return this.createSession(user);
  }

  async login(input: LoginBody): Promise<AuthenticationResult> {
    const user = await this.users.findByEmail(input.email);

    if (!user || !(await comparePassword(input.password, user.passwordHash))) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    return this.createSession(user);
  }

  async refresh(
    currentRefreshToken: string | undefined,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!currentRefreshToken) {
      throw new UnauthorizedError("A refresh token is required.");
    }

    const payload = this.tokens.verifyRefreshToken(currentRefreshToken);
    const user = await this.users.findById(payload.userId);

    if (!user) {
      throw new UnauthorizedError("The refresh token is no longer valid.");
    }

    const nextRefreshToken = this.tokens.createRefreshToken({
      userId: user.id,
      role: user.role,
    });
    const rotated = await this.users.rotateRefreshToken(
      user.id,
      hashRefreshToken(currentRefreshToken),
      hashRefreshToken(nextRefreshToken),
    );

    if (!rotated) {
      await this.users.clearRefreshToken(user.id);
      throw new UnauthorizedError(
        "Refresh token reuse was detected. Please sign in again.",
      );
    }

    return {
      accessToken: this.tokens.createAccessToken({
        userId: user.id,
        role: user.role,
      }),
      refreshToken: nextRefreshToken,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const payload = this.tokens.verifyRefreshToken(refreshToken);
      await this.users.clearRefreshToken(
        payload.userId,
        hashRefreshToken(refreshToken),
      );
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) {
        throw error;
      }
    }
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);

    if (!user) {
      throw new UnauthorizedError("The authenticated user no longer exists.");
    }

    return toPublicUser(user);
  }

  private async createSession(user: UserEntity): Promise<AuthenticationResult> {
    const tokenUser = {
      userId: user.id,
      role: user.role,
    };
    const accessToken = this.tokens.createAccessToken(tokenUser);
    const refreshToken = this.tokens.createRefreshToken(tokenUser);

    await this.users.setRefreshToken(user.id, hashRefreshToken(refreshToken));

    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
    };
  }
}
