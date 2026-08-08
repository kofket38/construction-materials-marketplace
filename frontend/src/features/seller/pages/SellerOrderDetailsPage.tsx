import { useCallback } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import { SellerOrderDetailsDialog } from "@/features/orders/components/SellerOrderDetailsDialog";

export function SellerOrderDetailsPage() {
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const closeDetails = useCallback(() => {
    void navigate("/seller/orders");
  }, [navigate]);

  if (authStatus !== "authenticated" || !user) {
    return (
      <Navigate
        replace
        state={{
          returnTo: orderId
            ? `/seller/orders/${encodeURIComponent(orderId)}`
            : "/seller/orders",
        }}
        to="/login"
      />
    );
  }
  if (user.role !== "SELLER") {
    return <Navigate replace to="/products" />;
  }
  if (!orderId) {
    return <Navigate replace to="/seller/orders" />;
  }

  return (
    <SellerOrderDetailsDialog
      onClose={closeDetails}
      orderId={orderId}
    />
  );
}
