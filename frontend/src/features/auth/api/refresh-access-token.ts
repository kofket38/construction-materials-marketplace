import { refreshSession } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/model/auth.store";

let refreshRequest: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (!refreshRequest) {
    refreshRequest = refreshSession()
      .then((accessToken) => {
        useAuthStore.getState().setAccessToken(accessToken);
        return accessToken;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}
