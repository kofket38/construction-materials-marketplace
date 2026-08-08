import { Outlet } from "react-router-dom";
import { AuthBootstrap } from "@/features/auth/components/AuthBootstrap";
import { CartBootstrap } from "@/features/cart/components/CartBootstrap";

export function RootLayout() {
  return (
    <AuthBootstrap>
      <CartBootstrap>
        <Outlet />
      </CartBootstrap>
    </AuthBootstrap>
  );
}
