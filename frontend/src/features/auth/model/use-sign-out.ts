import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { logout } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/model/auth.store";

interface UseSignOutOptions {
  /** Optional route navigated to after the session is cleared, e.g. "/login" */
  redirectTo?: string;
}

interface UseSignOutResult {
  /** True while the sign-out request is in flight */
  isSigningOut: boolean;
  /** Terminates the session; clears local auth state even when the API fails */
  signOut: () => Promise<void>;
}

export function useSignOut(options: UseSignOutOptions = {}): UseSignOutResult {
  const { redirectTo } = options;
  const navigate = useNavigate();
  const setUnauthenticated = useAuthStore((state) => state.setUnauthenticated);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut(): Promise<void> {
    setIsSigningOut(true);
    try {
      await logout();
    } catch {
      // Clear local session even when the API is unavailable.
    } finally {
      setUnauthenticated();
      if (redirectTo) {
        navigate(redirectTo);
      }
    }
  }

  return { isSigningOut, signOut };
}
