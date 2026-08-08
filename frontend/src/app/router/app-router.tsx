import { createBrowserRouter } from "react-router-dom";

import { NotFoundPage } from "@/pages/system/NotFoundPage";
import { RouteErrorPage } from "@/pages/system/RouteErrorPage";

import { PublicLayout } from "@/shared/layouts/PublicLayout";
import { RootLayout } from "@/shared/layouts/RootLayout";
import { BuyerRouteGuard } from "@/features/auth/components/BuyerRouteGuard";

import { LoginPage } from "@/pages/LoginPage";
import { CartPage } from "@/pages/CartPage";
import { BankTransferDetailsPage } from "@/features/checkout/pages/BankTransferDetailsPage";
import { CheckoutPage } from "@/features/checkout/pages/CheckoutPage";
import { OrderSuccessPage } from "@/features/checkout/pages/OrderSuccessPage";
import { MyOrdersPage } from "@/features/orders/pages/MyOrdersPage";
import { OrderDetailsPage } from "@/features/orders/pages/OrderDetailsPage";
import { MarketplaceSellersPage } from "@/features/marketplace/pages/MarketplaceSellersPage";
import { SellerStorePage } from "@/features/marketplace/pages/SellerStorePage";
import { SellerDashboardPage } from "@/features/seller/pages/SellerDashboardPage";
import { SellerInventoryPage } from "@/features/seller/pages/SellerInventoryPage";
import { SellerOrderDetailsPage } from "@/features/seller/pages/SellerOrderDetailsPage";
import { SellerOrdersPage } from "@/features/seller/pages/SellerOrdersPage";
import { SellerWorkspacePage } from "@/features/seller/pages/SellerWorkspacePage";
import { ProductDetailsPage } from "@/pages/ProductDetailsPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ProductsPage } from "@/pages/ProductsPage";

export const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,

    children: [
      {
        element: <PublicLayout />,

        children: [
          {
            index: true,
            element: <ProductsPage />,
          },

          {
            path: "login",
            element: <LoginPage />,
          },

          {
            path: "register",
            element: <RegisterPage />,
          },

          {
            path: "products",
            element: <ProductsPage />,
          },

          {
            path: "products/:id",
            element: <ProductDetailsPage />,
          },

          {
            path: "stores",
            element: <MarketplaceSellersPage />,
          },

          {
            path: "stores/:sellerId",
            element: <SellerStorePage />,
          },

          {
            path: "cart",
            element: <CartPage />,
          },

          {
            path: "checkout",
            element: <CheckoutPage />,
          },

          {
            element: <BuyerRouteGuard />,
            children: [
              {
                path: "orders",
                element: <MyOrdersPage />,
              },
              {
                path: "orders/:orderId",
                element: <OrderDetailsPage />,
              },
              {
                path: "orders/success/:orderId",
                element: <OrderSuccessPage />,
              },
              {
                path: "orders/:orderId/payment",
                element: <BankTransferDetailsPage />,
              },
              {
                path: "orders/:orderId/bank-transfer",
                element: <BankTransferDetailsPage />,
              },
            ],
          },

          {
            path: "seller/dashboard",
            element: <SellerDashboardPage />,
          },

          {
            path: "seller/inventory",
            element: <SellerInventoryPage />,
          },

          {
            path: "seller/orders",
            element: <SellerOrdersPage />,
          },

          {
            path: "seller/orders/:orderId",
            element: <SellerOrderDetailsPage />,
          },

          {
            path: "seller/payments",
            element: <SellerWorkspacePage section="payments" />,
          },

          {
            path: "seller/sales",
            element: <SellerWorkspacePage section="sales" />,
          },

          {
            path: "seller/settings",
            element: <SellerWorkspacePage section="settings" />,
          },

          {
            path: "*",
            element: <NotFoundPage />,
          },
        ],
      },
    ],
  },
]);
