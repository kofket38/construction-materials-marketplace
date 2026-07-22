import { QueryClient } from "@tanstack/react-query";
import { getHttpStatus } from "@/shared/api/http-error";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = getHttpStatus(error);

        if (status !== undefined && status >= 400 && status < 500) {
          return false;
        }

        return failureCount < 2;
      },
      staleTime: 30 * 1000,
    },
    mutations: {
      retry: false,
    },
  },
});
