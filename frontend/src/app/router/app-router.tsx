import { createBrowserRouter } from "react-router-dom";

import { NotFoundPage } from "@/pages/system/NotFoundPage";
import { RouteErrorPage } from "@/pages/system/RouteErrorPage";

import { PublicLayout } from "@/shared/layouts/PublicLayout";
import { RootLayout } from "@/shared/layouts/RootLayout";

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
import { SellerLayout } from "@/features/seller/layouts/SellerLayout";
import { MyProfessionalProfilePage } from "@/features/professional-profile/pages/MyProfessionalProfilePage";
import { ProfessionalProfilePage } from "@/features/professional-profile/pages/ProfessionalProfilePage";
import { ProfessionalDirectoryPage } from "@/features/professional-profile/pages/ProfessionalDirectoryPage";
import { ProfessionalDashboardPage } from "@/features/professional-profile/pages/ProfessionalDashboardPage";
import { ProfessionalLayout } from "@/features/professional-profile/layouts/ProfessionalLayout";
import { CreateProjectPage } from "@/features/projects/pages/CreateProjectPage";
import { MyProjectsPage } from "@/features/projects/pages/MyProjectsPage";
import { ProjectDetailPage } from "@/features/projects/pages/ProjectDetailPage";
import { CreateRfqPage } from "@/features/rfq/pages/CreateRfqPage";
import { MyRfqsPage } from "@/features/rfq/pages/MyRfqsPage";
import { RfqDetailPage } from "@/features/rfq/pages/RfqDetailPage";
import { SellerRfqsPage } from "@/features/rfq/pages/SellerRfqsPage";
import { SubmitQuotePage } from "@/features/rfq/pages/SubmitQuotePage";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { RequireRole } from "@/features/auth/components/RequireRole";
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

          // ── Public professional directory ─────────────────────────────────
          {
            path: "professionals",
            element: <ProfessionalDirectoryPage />,
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
            element: <RequireRole role="CUSTOMER" />,
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

          // ── Seller workspace routes (role-guarded, persistent shell) ─────
          {
            path: "seller",
            element: <RequireRole role="SELLER" />,
            children: [
              {
                element: <SellerLayout />,
                children: [
                  {
                    path: "dashboard",
                    element: <SellerDashboardPage />,
                  },
                  {
                    path: "inventory",
                    element: <SellerInventoryPage />,
                  },
                  {
                    path: "profile",
                    element: <SellerProfilePage />,
                  },
                  {
                    path: "orders",
                    element: <SellerOrdersPage />,
                  },
                  {
                    path: "orders/:orderId",
                    element: <SellerOrderDetailsPage />,
                  },
                  {
                    path: "payments",
                    element: <SellerWorkspacePage section="payments" />,
                  },
                  {
                    path: "sales",
                    element: <SellerWorkspacePage section="sales" />,
                  },
                  {
                    path: "settings",
                    element: <SellerWorkspacePage section="settings" />,
                  },
                  {
                    path: "rfqs",
                    element: <SellerRfqsPage />,
                  },
                  {
                    path: "rfqs/:rfqId",
                    element: <RfqDetailPage />,
                  },
                  {
                    path: "rfqs/:rfqId/quote",
                    element: <SubmitQuotePage />,
                  },
                ],
              },
            ],
          },

          // ── Professional workspace routes (auth-guarded, persistent shell) ─
          {
            element: <RequireAuth />,
            children: [
              {
                element: <ProfessionalLayout />,
                children: [
                  {
                    path: "professional/dashboard",
                    element: <ProfessionalDashboardPage />,
                  },
                  {
                    path: "profile/professional",
                    element: <MyProfessionalProfilePage />,
                  },
                  // ── Owner project management ───────────────────────────────
                  {
                    path: "professional/projects",
                    element: <MyProjectsPage />,
                  },
                  {
                    path: "professional/projects/new",
                    element: <CreateProjectPage />,
                  },
                  {
                    path: "professional/projects/:projectId",
                    element: <ProjectDetailPage />,
                  },
                ],
              },
            ],
          },

          // ── Public professional profile view ──────────────────────────────
          {
            path: "professionals/:profileId",
            element: <ProfessionalProfilePage />,
          },

          {
            path: "*",
            element: <NotFoundPage />,
          },
        ],
      },

      // ── Admin workspace routes (own layout, sibling of PublicLayout) ──────
      {
        element: <RequireRole role="ADMIN" />,
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
    ],
  },
]);
