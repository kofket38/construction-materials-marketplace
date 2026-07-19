import { type User, Role, type PrismaClient } from "../prisma/generated/client.js";
import type {
  CreateUserInput,
  UserEntity,
  UserRepository,
} from "./user.repository.js";
import { DuplicateEmailError } from "./errors.js";

function mapUser(user: User): UserEntity {
  return {
    id: user.id,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    passwordHash: user.passwordHash,
    phone: user.phone,
    company: user.company,
    role: user.role as UserEntity["role"],
    emailVerified: user.emailVerified,
    refreshToken: user.refreshToken,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly client: PrismaClient) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.client.user.findUnique({ where: { email } });
    return user ? mapUser(user) : null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.client.user.findUnique({ where: { id } });
    return user ? mapUser(user) : null;
  }

  async create(input: CreateUserInput): Promise<UserEntity> {
    try {
      const user = await this.client.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: input.passwordHash,
          role: Role[input.role],
          ...(input.firstName !== undefined
            ? { firstName: input.firstName }
            : {}),
          ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.company !== undefined ? { company: input.company } : {}),
        },
      });

      return mapUser(user);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new DuplicateEmailError();
      }

      throw error;
    }
  }

  async setRefreshToken(
    userId: string,
    refreshTokenHash: string,
  ): Promise<void> {
    await this.client.user.update({
      where: { id: userId },
      data: { refreshToken: refreshTokenHash },
    });
  }

  async rotateRefreshToken(
    userId: string,
    currentRefreshTokenHash: string,
    nextRefreshTokenHash: string,
  ): Promise<boolean> {
    const result = await this.client.user.updateMany({
      where: {
        id: userId,
        refreshToken: currentRefreshTokenHash,
      },
      data: {
        refreshToken: nextRefreshTokenHash,
      },
    });

    return result.count === 1;
  }

  async clearRefreshToken(
    userId: string,
    expectedRefreshTokenHash?: string,
  ): Promise<void> {
    if (expectedRefreshTokenHash !== undefined) {
      await this.client.user.updateMany({
        where: {
          id: userId,
          refreshToken: expectedRefreshTokenHash,
        },
        data: { refreshToken: null },
      });
      return;
    }

    await this.client.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }
}
