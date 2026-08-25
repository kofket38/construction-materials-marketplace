import { useCallback } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { SellerOrderDetailsDialog } from "@/features/orders/components/SellerOrderDetailsDialog";

export function SellerOrderDetailsPage() {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const closeDetails = useCallback(() => {
    void navigate("/seller/orders");
  }, [navigate]);

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
