import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import type { UserRole } from "@/features/auth/model/auth.types";

export interface RequireRoleProps {
  /**
   * Either a single permitted role, or a predicate for capability-based
   * access. Pass isBuyerRole for routes shared by CUSTOMER and PROFESSIONAL
   * so the permitted set is not restated here.
   */
  role: UserRole | ((role: UserRole) => boolean);
}

export function RequireRole({ role }: RequireRoleProps) {
  const location = useLocation();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === "idle" || status === "loading") {
    return null; // wait for bootstrap
  }

  if (status !== "authenticated" || !user) {
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

  const isPermitted =
    typeof role === "function" ? role(user.role) : user.role === role;

  if (!isPermitted) {
    return <Navigate replace to="/products" />;
  }

  return <Outlet />;
}
