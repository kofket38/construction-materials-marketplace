import { Outlet } from "react-router-dom";
import { AuthBootstrap } from "@/features/auth/components/AuthBootstrap";

export function RootLayout() {
  return (
    <AuthBootstrap>
      <Outlet />
    </AuthBootstrap>
  );
}
