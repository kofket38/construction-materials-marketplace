export type UserRole = "CUSTOMER" | "SELLER" | "ADMIN";

/**
 * UI-only registration role. PROFESSIONAL is a product-level concept that
 * creates a CUSTOMER account and redirects to professional profile onboarding.
 * It must NEVER be sent to the backend — auth.api.ts maps it to "CUSTOMER"
 * before the API request.
 */
export type RegistrationRole = "CUSTOMER" | "SELLER" | "PROFESSIONAL";

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
   * The UI registration role. PROFESSIONAL maps to CUSTOMER on the wire.
   * auth.api.ts performs the mapping — the backend never receives PROFESSIONAL.
   */
  role: RegistrationRole;
}
