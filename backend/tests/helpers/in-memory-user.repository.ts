import { randomUUID } from "node:crypto";
import { DuplicateEmailError } from "../../src/repositories/errors.js";
import type {
  CreateUserInput,
  UserEntity,
  UserRepository,
} from "../../src/repositories/user.repository.js";

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, UserEntity>();

  async findByEmail(email: string): Promise<UserEntity | null> {
    return (
      [...this.users.values()].find((user) => user.email === email) ?? null
    );
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.users.get(id) ?? null;
  }

  async create(input: CreateUserInput): Promise<UserEntity> {
    if (await this.findByEmail(input.email)) {
      throw new DuplicateEmailError();
    }

    const now = new Date();
    const user: UserEntity = {
      id: randomUUID(),
      name: input.name,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      email: input.email,
      passwordHash: input.passwordHash,
      phone: input.phone ?? null,
      company: input.company ?? null,
      role: input.role,
      emailVerified: false,
      refreshToken: null,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    return user;
  }

  async setRefreshToken(
    userId: string,
    refreshTokenHash: string,
  ): Promise<void> {
    const user = this.requireUser(userId);
    user.refreshToken = refreshTokenHash;
    user.updatedAt = new Date();
  }

  async rotateRefreshToken(
    userId: string,
    currentRefreshTokenHash: string,
    nextRefreshTokenHash: string,
  ): Promise<boolean> {
    const user = this.users.get(userId);

    if (!user || user.refreshToken !== currentRefreshTokenHash) {
      return false;
    }

    user.refreshToken = nextRefreshTokenHash;
    user.updatedAt = new Date();
    return true;
  }

  async clearRefreshToken(
    userId: string,
    expectedRefreshTokenHash?: string,
  ): Promise<void> {
    const user = this.users.get(userId);

    if (
      user &&
      (expectedRefreshTokenHash === undefined ||
        user.refreshToken === expectedRefreshTokenHash)
    ) {
      user.refreshToken = null;
      user.updatedAt = new Date();
    }
  }

  private requireUser(userId: string): UserEntity {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User ${userId} does not exist.`);
    }
    return user;
  }
}
