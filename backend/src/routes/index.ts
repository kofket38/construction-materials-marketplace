import { Router } from "express";
import type { AdminDashboardController } from "../controllers/admin-dashboard.controller.js";
import type { AuthController } from "../controllers/auth.controller.js";
import type { CategoryController } from "../controllers/category.controller.js";
import type { OrderController } from "../controllers/order.controller.js";
import type { ProductController } from "../controllers/product.controller.js";
import type { SellerDashboardController } from "../controllers/seller-dashboard.controller.js";
import { authenticate } from "../middleware/authentication.js";
import { createAuthRateLimiter } from "../middleware/rate-limit.js";
import type { UserRepository } from "../repositories/user.repository.js";
import type { TokenService } from "../services/token.service.js";
import { createAdminDashboardRouter } from "./admin-dashboard.routes.js";
import { createAuthRouter } from "./auth.routes.js";
import { createCategoryRouter } from "./category.routes.js";
import { createOrderRouter } from "./order.routes.js";
import { createProductRouter } from "./product.routes.js";
import { createSellerDashboardRouter } from "./seller-dashboard.routes.js";

export function createApiRouter(
  adminDashboardController: AdminDashboardController,
  authController: AuthController,
  categoryController: CategoryController,
  orderController: OrderController,
  productController: ProductController,
  sellerDashboardController: SellerDashboardController,
  tokenService: TokenService,
  userRepository: UserRepository,
): Router {
  const router = Router();
  const requireAuthentication = authenticate(tokenService, userRepository);

  router.use(
    "/admin",
    createAdminDashboardRouter(
      adminDashboardController,
      requireAuthentication,
    ),
  );
  router.use(
    "/auth",
    createAuthRateLimiter(),
    createAuthRouter(authController, requireAuthentication),
  );
  router.use(
    "/categories",
    createCategoryRouter(categoryController, requireAuthentication),
  );
  router.use(
    "/orders",
    createOrderRouter(orderController, requireAuthentication),
  );
  router.use(
    "/products",
    createProductRouter(productController, requireAuthentication),
  );
  router.use(
    "/seller",
    createSellerDashboardRouter(
      sellerDashboardController,
      requireAuthentication,
    ),
  );

  return router;
}
