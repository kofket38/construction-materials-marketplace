import { Navigate, useParams } from "react-router-dom";

export function OrderSuccessPage() {
  const { orderId } = useParams<{ orderId: string }>();

  if (!orderId) {
    return <Navigate replace to="/products" />;
  }

  return (
    <Navigate
      replace
      to={`/orders/${encodeURIComponent(orderId)}`}
    />
  );
}
