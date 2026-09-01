export type UserRole = "CUSTOMER" | "SELLER" | "ADMIN" | "PROFESSIONAL";

export interface UserEntity {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  passwordHash: string;
  phone: string | null;
  company: string | null;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  refreshToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  passwordHash: string;
  phone?: string;
  company?: string;
  role: UserRole;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  create(input: CreateUserInput): Promise<UserEntity>;
  setRefreshToken(userId: string, refreshTokenHash: string): Promise<void>;
  rotateRefreshToken(
    userId: string,
    currentRefreshTokenHash: string,
    nextRefreshTokenHash: string,
  ): Promise<boolean>;
  clearRefreshToken(
    userId: string,
    expectedRefreshTokenHash?: string,
  ): Promise<void>;
}
