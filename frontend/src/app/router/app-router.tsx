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
import { SellerProfilePage } from "@/features/seller/pages/SellerProfilePage";
import { SellerWorkspacePage } from "@/features/seller/pages/SellerWorkspacePage";
import { MyProfessionalProfilePage } from "@/features/professional-profile/pages/MyProfessionalProfilePage";
import { ProfessionalProfilePage } from "@/features/professional-profile/pages/ProfessionalProfilePage";
import { CreateRfqPage } from "@/features/rfq/pages/CreateRfqPage";
import { MyRfqsPage } from "@/features/rfq/pages/MyRfqsPage";
import { RfqDetailPage } from "@/features/rfq/pages/RfqDetailPage";
import { SellerRfqsPage } from "@/features/rfq/pages/SellerRfqsPage";
import { SubmitQuotePage } from "@/features/rfq/pages/SubmitQuotePage";
import { AdminRouteGuard } from "@/features/auth/components/AdminRouteGuard";
import { AdminLayout } from "@/features/admin/layouts/AdminLayout";
import { AdminDashboardPage } from "@/features/admin/pages/AdminDashboardPage";
import { AdminUsersPage } from "@/features/admin/pages/AdminUsersPage";
import { AdminSellersPage } from "@/features/admin/pages/AdminSellersPage";
import { AdminProductsPage } from "@/features/admin/pages/AdminProductsPage";
import { AdminOrdersPage } from "@/features/admin/pages/AdminOrdersPage";
import { ProductDetailsPage } from "@/pages/ProductDetailsPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { WishlistPage } from "@/pages/WishlistPage";

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

          // ── Authenticated buyer routes ───────────────────────────────────
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
              // ── Buyer RFQ routes ─────────────────────────────────────────
              {
                path: "rfqs",
                element: <MyRfqsPage />,
              },
              {
                path: "rfqs/new",
                element: <CreateRfqPage />,
              },
              {
                path: "rfqs/:rfqId",
                element: <RfqDetailPage />,
              },
              {
                path: "wishlist",
                element: <WishlistPage />,
              },
            ],
          },

          // ── Seller workspace routes ──────────────────────────────────────
          {
            path: "seller/dashboard",
            element: <SellerDashboardPage />,
          },

          {
            path: "seller/inventory",
            element: <SellerInventoryPage />,
          },

          {
            path: "seller/profile",
            element: <SellerProfilePage />,
          },

          // ── Professional profile routes ──────────────────────────────────
          {
            path: "profile/professional",
            element: <MyProfessionalProfilePage />,
          },
          {
            path: "professionals/:profileId",
            element: <ProfessionalProfilePage />,
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

          // ── Seller RFQ routes ────────────────────────────────────────────
          {
            path: "seller/rfqs",
            element: <SellerRfqsPage />,
          },

          {
            path: "seller/rfqs/:rfqId",
            element: <RfqDetailPage />,
          },

          {
            path: "seller/rfqs/:rfqId/quote",
            element: <SubmitQuotePage />,
          },

          {
            path: "*",
            element: <NotFoundPage />,
          },
        ],
      },
    ],
  },
  // ── Admin routes (own layout, no PublicLayout) ──────────────────────────
  {
    element: <AdminRouteGuard />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            path: "/admin",
            element: <AdminDashboardPage />,
          },
          {
            path: "/admin/dashboard",
            element: <AdminDashboardPage />,
          },
          {
            path: "/admin/users",
            element: <AdminUsersPage />,
          },
          {
            path: "/admin/sellers",
            element: <AdminSellersPage />,
          },
          {
            path: "/admin/products",
            element: <AdminProductsPage />,
          },
          {
            path: "/admin/orders",
            element: <AdminOrdersPage />,
          },
        ],
      },
    ],
  },
]);
