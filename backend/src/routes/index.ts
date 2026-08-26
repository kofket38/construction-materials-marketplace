import { Router } from "express";
import type { AdminDashboardController } from "../controllers/admin-dashboard.controller.js";
import type { AuthController } from "../controllers/auth.controller.js";
import type { CategoryController } from "../controllers/category.controller.js";
import type { OrderController } from "../controllers/order.controller.js";
import type { PaymentController } from "../controllers/payment.controller.js";
import type { ProductController } from "../controllers/product.controller.js";
import type { ProfessionalProfileController } from "../controllers/professional-profile.controller.js";
import type { ProjectController } from "../controllers/project.controller.js";
import type { ReviewController } from "../controllers/review.controller.js";
import type { RfqController } from "../controllers/rfq.controller.js";
import type { SellerDashboardController } from "../controllers/seller-dashboard.controller.js";
import type { SellerInventoryController } from "../controllers/seller-inventory.controller.js";
import type { SellerProfileController } from "../controllers/seller-profile.controller.js";
import type { WishlistController } from "../controllers/wishlist.controller.js";
import { authenticate } from "../middleware/authentication.js";
import { createAuthRateLimiter } from "../middleware/rate-limit.js";
import type { UserRepository } from "../repositories/user.repository.js";
import type { TokenService } from "../services/token.service.js";
import { createAdminDashboardRouter } from "./admin-dashboard.routes.js";
import { createAuthRouter } from "./auth.routes.js";
import { createCategoryRouter } from "./category.routes.js";
import { createOrderRouter } from "./order.routes.js";
import { createPaymentRouter } from "./payment.routes.js";
import { createProductRouter } from "./product.routes.js";
import { createProfessionalProfileRouter } from "./professional-profile.routes.js";
import { createProjectRouter } from "./project.routes.js";
import { createReviewRouter } from "./review.routes.js";
import { createRfqRouter } from "./rfq.routes.js";
import { createSellerDashboardRouter } from "./seller-dashboard.routes.js";
import { createSellerInventoryRouter } from "./seller-inventory.routes.js";
import { createSellerProfileRouter } from "./seller-profile.routes.js";
import { createWishlistRouter } from "./wishlist.routes.js";

export function createApiRouter(
  adminDashboardController: AdminDashboardController,
  authController: AuthController,
  categoryController: CategoryController,
  orderController: OrderController,
  paymentController: PaymentController,
  productController: ProductController,
  professionalProfileController: ProfessionalProfileController,
  projectController: ProjectController,
  reviewController: ReviewController,
  rfqController: RfqController,
  sellerDashboardController: SellerDashboardController,
  sellerInventoryController: SellerInventoryController,
  sellerProfileController: SellerProfileController,
  wishlistController: WishlistController,
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
    "/payments",
    createPaymentRouter(paymentController, requireAuthentication),
  );
  router.use(
    "/products",
    createProductRouter(productController, requireAuthentication),
  );
  router.use(
    "/professional-profiles",
    createProfessionalProfileRouter(
      professionalProfileController,
      requireAuthentication,
    ),
  );
  router.use(
    "/projects",
    createProjectRouter(projectController, requireAuthentication),
  );
  router.use(createReviewRouter(reviewController, requireAuthentication));
  router.use(createRfqRouter(rfqController, requireAuthentication));
  // More-specific /seller/* routes must be registered before the
  // catch-all /seller router so they are matched first.
  router.use(
    "/seller/inventory",
    createSellerInventoryRouter(
      sellerInventoryController,
      requireAuthentication,
    ),
  );
  router.use(
    "/seller/profile",
    createSellerProfileRouter(
      sellerProfileController,
      requireAuthentication,
    ),
  );
  router.use(
    "/seller",
    createSellerDashboardRouter(
      sellerDashboardController,
      requireAuthentication,
    ),
  );
  router.use(
    "/wishlist",
    createWishlistRouter(wishlistController, requireAuthentication),
  );

  return router;
}
