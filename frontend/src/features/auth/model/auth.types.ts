export type UserRole = "CUSTOMER" | "SELLER" | "ADMIN" | "PROFESSIONAL";

/**
 * Registration roles offered by the sign-up UI. ADMIN is excluded — it can
 * never be self-registered (the backend Zod enum rejects it with a 400).
 */
export type RegistrationRole = Exclude<UserRole, "ADMIN">;

/**
 * Buyer-capable roles. PROFESSIONAL accounts retain full customer purchasing
 * capabilities (orders, payments, reviews, wishlists, RFQs).
 */
export function isBuyerRole(role: UserRole | undefined): boolean {
  return role === "CUSTOMER" || role === "PROFESSIONAL";
}

export interface AuthUser {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  company?: string;
  /**
   * The registration role is sent to the backend as chosen. Since M1,
   * PROFESSIONAL is a real backend role; only ADMIN is not registrable.
   */
  role: RegistrationRole;
}
