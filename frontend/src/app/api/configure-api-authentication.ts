import {
  AxiosHeaders,
  type InternalAxiosRequestConfig,
  type AxiosError,
} from "axios";
import { refreshAccessToken } from "@/features/auth/api/refresh-access-token";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { apiClient } from "@/shared/api/http-client";

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _authenticationRetry?: boolean;
}

const nonRefreshableAuthPaths = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
];

let isConfigured = false;

function canRefreshRequest(error: AxiosError): boolean {
  if (error.response?.status !== 401 || !error.config) {
    return false;
  }

  const requestUrl = error.config.url ?? "";
  return !nonRefreshableAuthPaths.some((path) => requestUrl.endsWith(path));
}

export function configureApiAuthentication(): void {
  if (isConfigured) {
    return;
  }

  isConfigured = true;

  apiClient.interceptors.request.use((config) => {
    const accessToken = useAuthStore.getState().accessToken;

    if (accessToken) {
      config.headers = AxiosHeaders.from(config.headers);
      config.headers.set("Authorization", `Bearer ${accessToken}`);
    }

    return config;
  });

  apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (!canRefreshRequest(error) || !error.config) {
        return Promise.reject(error);
      }

      const originalRequest = error.config as RetryableRequestConfig;

      if (originalRequest._authenticationRetry) {
        useAuthStore.getState().setUnauthenticated();
        return Promise.reject(error);
      }

      originalRequest._authenticationRetry = true;

      try {
        const accessToken = await refreshAccessToken();
        originalRequest.headers = AxiosHeaders.from(originalRequest.headers);
        originalRequest.headers.set(
          "Authorization",
          `Bearer ${accessToken}`,
        );

        return await apiClient(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().setUnauthenticated();
        return Promise.reject(refreshError);
      }
    },
  );
}
