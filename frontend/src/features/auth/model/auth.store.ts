import { create } from "zustand";
import type { AuthSession, AuthUser } from "@/features/auth/model/auth.types";

export type AuthenticationStatus =
  | "idle"
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "error";

interface AuthState {
  accessToken: string | null;
  bootstrapError: string | null;
  status: AuthenticationStatus;
  user: AuthUser | null;
}

interface AuthActions {
  beginBootstrap: () => void;
  setAccessToken: (accessToken: string) => void;
  setBootstrapError: (message: string) => void;
  setSession: (session: AuthSession) => void;
  setUnauthenticated: () => void;
}

const initialState: AuthState = {
  accessToken: null,
  bootstrapError: null,
  status: "idle",
  user: null,
};

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  ...initialState,
  beginBootstrap: () =>
    set({
      bootstrapError: null,
      status: "loading",
    }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setBootstrapError: (bootstrapError) =>
    set({
      ...initialState,
      bootstrapError,
      status: "error",
    }),
  setSession: ({ accessToken, user }) =>
    set({
      accessToken,
      bootstrapError: null,
      status: "authenticated",
      user,
    }),
  setUnauthenticated: () =>
    set({
      ...initialState,
      status: "unauthenticated",
    }),
}));
