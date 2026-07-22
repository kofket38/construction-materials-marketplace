import { getCurrentUser } from "@/features/auth/api/auth.api";
import { refreshAccessToken } from "@/features/auth/api/refresh-access-token";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { getApiErrorMessage, getHttpStatus } from "@/shared/api/http-error";

let bootstrapRequest: Promise<void> | null = null;

async function runAuthenticationBootstrap(): Promise<void> {
  const authStore = useAuthStore.getState();
  authStore.beginBootstrap();

  try {
    const accessToken = await refreshAccessToken();
    const user = await getCurrentUser();
    useAuthStore.getState().setSession({ accessToken, user });
  } catch (error) {
    if (getHttpStatus(error) === 401) {
      useAuthStore.getState().setUnauthenticated();
      return;
    }

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
