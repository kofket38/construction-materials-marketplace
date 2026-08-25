import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";

export function RequireAuth() {
  const location = useLocation();
  const status = useAuthStore((state) => state.status);

  if (status === "idle" || status === "loading") {
    return null; // wait for bootstrap
  }

  if (status !== "authenticated") {
    return (
      <Navigate
        replace
        state={{
          returnTo: `${location.pathname}${location.search}${location.hash}`,
        }}
        to="/login"
      />
    );
  }

  return <Outlet />;
}
