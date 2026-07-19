import { Router } from "express";
import type { AuthController } from "../controllers/auth.controller.js";
import type { CategoryController } from "../controllers/category.controller.js";
import type { OrderController } from "../controllers/order.controller.js";
import type { ProductController } from "../controllers/product.controller.js";
import type { SellerDashboardController } from "../controllers/seller-dashboard.controller.js";
import { createAuthRateLimiter } from "../middleware/rate-limit.js";
import type { TokenService } from "../services/token.service.js";
import { createAuthRouter } from "./auth.routes.js";
import { createCategoryRouter } from "./category.routes.js";
import { createOrderRouter } from "./order.routes.js";
import { createProductRouter } from "./product.routes.js";
import { createSellerDashboardRouter } from "./seller-dashboard.routes.js";

export function createApiRouter(
  authController: AuthController,
  categoryController: CategoryController,
  orderController: OrderController,
  productController: ProductController,
  sellerDashboardController: SellerDashboardController,
  tokenService: TokenService,
): Router {
  const router = Router();

  router.use(
    "/auth",
    createAuthRateLimiter(),
    createAuthRouter(authController, tokenService),
  );
  router.use(
    "/categories",
    createCategoryRouter(categoryController, tokenService),
  );
  router.use(
    "/orders",
    createOrderRouter(orderController, tokenService),
  );
  router.use(
    "/products",
    createProductRouter(productController, tokenService),
  );
  router.use(
    "/seller",
    createSellerDashboardRouter(sellerDashboardController, tokenService),
  );

  return router;
}
