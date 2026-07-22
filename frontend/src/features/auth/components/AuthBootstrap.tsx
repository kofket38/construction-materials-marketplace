import { LoaderCircle, ServerOff } from "lucide-react";
import { useEffect, useRef, type PropsWithChildren } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { bootstrapAuthentication } from "@/features/auth/api/bootstrap-authentication";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

export function AuthBootstrap({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const status = useAuthStore((state) => state.status);
  const bootstrapError = useAuthStore((state) => state.bootstrapError);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (status === "idle") {
      void bootstrapAuthentication();
    }
  }, [status]);

  useEffect(() => {
    if (
      previousUserId.current !== undefined &&
      previousUserId.current !== userId
    ) {
      queryClient.clear();
    }

    previousUserId.current = userId;
  }, [queryClient, userId]);

  if (status === "idle" || status === "loading") {
    return (
      <FullPageStatus
        description="Checking your marketplace session."
        icon={LoaderCircle}
        title="Loading"
      />
    );
  }

  if (status === "error") {
    return (
      <FullPageStatus
        action={{
          label: "Try again",
          onClick: () => void bootstrapAuthentication(),
        }}
        description={
          bootstrapError ??
          "The application could not connect to the marketplace service."
        }
        icon={ServerOff}
        title="Service unavailable"
      />
    );
  }

  return children;
}
