import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/features/auth/model/auth.store";

export function AdminRouteGuard() {
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

  if (user.role !== "ADMIN") {
    return <Navigate replace to="/products" />;
  }

  return <Outlet />;
}
