import { getCurrentUser } from "@/features/auth/api/auth.api";
import { refreshAccessToken } from "@/features/auth/api/refresh-access-token";
import { useAuthStore } from "@/features/auth/model/auth.store";
import {
  getApiErrorMessage,
  getHttpStatus,
} from "@/shared/api/http-error";

let bootstrapRequest: Promise<void> | null = null;

async function runAuthenticationBootstrap(): Promise<void> {
  const authStore = useAuthStore.getState();
  authStore.beginBootstrap();

  try {
    const accessToken = await refreshAccessToken();
    const user = await getCurrentUser();
    useAuthStore.getState().setSession({ accessToken, user });
  } catch (error) {
    const status = getHttpStatus(error);

    // Any client-side rejection of the refresh probe means the same thing to the
    // application: there is no session to restore, so render the marketplace
    // signed out. 401 is the ordinary "no cookie" case; 429 happens when the
    // refresh endpoint's rate limit is reached (20 in 15 minutes per address,
    // which several visitors behind one office address can share). Blocking the
    // whole shopfront on that would stop anonymous browsing for everyone on that
    // address, and no session could be restored by waiting either.
    if (status !== undefined && status >= 400 && status < 500) {
      useAuthStore.getState().setUnauthenticated();
      return;
    }

    // A 5xx or a request that never reached the API is a genuine outage: the
    // catalog would fail too, so the blocking status page is still correct.
    useAuthStore
      .getState()
      .setBootstrapError(
        getApiErrorMessage(
          error,
          "The application could not connect to the marketplace service.",
        ),
      );
  }
}

export function bootstrapAuthentication(): Promise<void> {
  if (!bootstrapRequest) {
    bootstrapRequest = runAuthenticationBootstrap().finally(() => {
      bootstrapRequest = null;
    });
  }

  return bootstrapRequest;
}
