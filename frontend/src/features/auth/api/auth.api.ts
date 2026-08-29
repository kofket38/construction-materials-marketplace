import { apiClient, sessionClient } from "@/shared/api/http-client";
import type { ApiSuccessResponse } from "@/shared/api/api.types";

import type {
  AuthSession,
  AuthUser,
  LoginInput,
  RegisterInput,
  UserRole,
} from "@/features/auth/model/auth.types";

interface CurrentUserData {
  user: AuthUser;
}

interface RefreshSessionData {
  accessToken: string;
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const response = await apiClient.post<ApiSuccessResponse<AuthSession>>(
    "/auth/login",
    input,
  );

  return response.data.data;
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  // PROFESSIONAL is a UI-only registration choice that creates a CUSTOMER
  // account. The backend only accepts CUSTOMER or SELLER — ADMIN is
  // structurally impossible (rejected by Zod enum with a 400 response).
  const wireRole: Exclude<UserRole, "ADMIN"> =
    input.role === "PROFESSIONAL" ? "CUSTOMER" : input.role;

  const response = await apiClient.post<ApiSuccessResponse<AuthSession>>(
    "/auth/register",
    { ...input, role: wireRole },
  );

  return response.data.data;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response =
    await apiClient.get<ApiSuccessResponse<CurrentUserData>>("/auth/me");

  return response.data.data.user;
}

export async function refreshSession(): Promise<string> {
  const response = await sessionClient.post<
    ApiSuccessResponse<RefreshSessionData>
  >("/auth/refresh", {});

  return response.data.data.accessToken;
}

export async function logout(): Promise<void> {
  await sessionClient.post<ApiSuccessResponse<null>>("/auth/logout", {});
}
