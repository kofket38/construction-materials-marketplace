import { randomUUID } from "node:crypto";
import { DuplicateEmailError } from "../../src/repositories/errors.js";
import type {
  CreateUserInput,
  UserEntity,
  UserRepository,
  UserRole,
} from "../../src/repositories/user.repository.js";

export interface InMemoryUserSeed {
  id?: string;
  name?: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  passwordHash?: string;
  phone?: string | null;
  company?: string | null;
  role: UserRole;
  isActive?: boolean;
  emailVerified?: boolean;
  refreshToken?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, UserEntity>();

  addUser(input: InMemoryUserSeed): UserEntity {
    const id = input.id ?? randomUUID();
    const email = input.email ?? `${id}@example.test`;

    if ([...this.users.values()].some((user) => user.email === email)) {
      throw new DuplicateEmailError();
    }

    const now = new Date();
    const user: UserEntity = {
      id,
      name: input.name ?? `${input.role} User`,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      email,
      passwordHash: input.passwordHash ?? "unused-password-hash",
      phone: input.phone ?? null,
      company: input.company ?? null,
      role: input.role,
      isActive: input.isActive ?? true,
      emailVerified: input.emailVerified ?? false,
      refreshToken: input.refreshToken ?? null,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };

    this.users.set(user.id, user);
    return user;
  }

  allUsers(): UserEntity[] {
    return [...this.users.values()];
  }

  setActive(userId: string, isActive: boolean): UserEntity | null {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    user.isActive = isActive;
    if (!isActive) {
      user.refreshToken = null;
    }
    user.updatedAt = new Date();
    return user;
  }

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

    return this.addUser({
      name: input.name,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      email: input.email,
      passwordHash: input.passwordHash,
      phone: input.phone ?? null,
      company: input.company ?? null,
      role: input.role,
    });
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
