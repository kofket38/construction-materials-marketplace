import express, { type Express } from "express";

import path from "node:path";

import cookieParser from "cookie-parser";

import cors from "cors";

import helmet from "helmet";

import { pinoHttp } from "pino-http";

import type { Logger } from "pino";

import { AdminDashboardController } from "./controllers/admin-dashboard.controller.js";

import { AuthController } from "./controllers/auth.controller.js";

import { CategoryController } from "./controllers/category.controller.js";

import { OrderController } from "./controllers/order.controller.js";

import { PaymentController } from "./controllers/payment.controller.js";

import { ProductController } from "./controllers/product.controller.js";

import { ReviewController } from "./controllers/review.controller.js";

import { RfqController } from "./controllers/rfq.controller.js";

import { SellerDashboardController } from "./controllers/seller-dashboard.controller.js";

import { SellerInventoryController } from "./controllers/seller-inventory.controller.js";

import { ProfessionalProfileController } from "./controllers/professional-profile.controller.js";

import { SellerProfileController } from "./controllers/seller-profile.controller.js";

import { WishlistController } from "./controllers/wishlist.controller.js";

import { env } from "./config/env.js";

import { logger as defaultLogger } from "./config/logger.js";

import { createErrorHandler } from "./middleware/error-handler.js";

import { notFoundHandler } from "./middleware/not-found.js";

import { createGlobalRateLimiter } from "./middleware/rate-limit.js";

import { PrismaUserRepository } from "./repositories/prisma-user.repository.js";

import { PrismaProductRepository } from "./repositories/prisma-product.repository.js";

import { PrismaCategoryRepository } from "./repositories/prisma-category.repository.js";

import { PrismaOrderRepository } from "./repositories/prisma-order.repository.js";

import { PrismaPaymentRepository } from "./repositories/prisma-payment.repository.js";

import { PrismaSellerPaymentRepository } from "./repositories/prisma-seller-payment.repository.js";

import { PrismaReviewRepository } from "./repositories/prisma-review.repository.js";

import { PrismaRfqRepository } from "./repositories/prisma-rfq.repository.js";

import { PrismaSellerDashboardRepository } from "./repositories/prisma-seller-dashboard.repository.js";

import { PrismaSellerInventoryRepository } from "./repositories/prisma-seller-inventory.repository.js";

import { PrismaSellerProfileRepository } from "./repositories/prisma-seller-profile.repository.js";

import { PrismaProfessionalProfileRepository } from "./repositories/prisma-professional-profile.repository.js";

import { PrismaAdminDashboardRepository } from "./repositories/prisma-admin-dashboard.repository.js";

import { PrismaWishlistRepository } from "./repositories/prisma-wishlist.repository.js";

import type { AdminDashboardRepository } from "./repositories/admin-dashboard.repository.js";

import type { CategoryRepository } from "./repositories/category.repository.js";

import type { OrderRepository } from "./repositories/order.repository.js";

import type { PaymentRepository } from "./repositories/payment.repository.js";

import type { SellerPaymentRepository } from "./repositories/seller-payment.repository.js";

import type { ProductRepository } from "./repositories/product.repository.js";

import type { ReviewRepository } from "./repositories/review.repository.js";

import type { RfqRepository } from "./repositories/rfq.repository.js";

import type { SellerDashboardRepository } from "./repositories/seller-dashboard.repository.js";

import type { SellerInventoryRepository } from "./repositories/seller-inventory.repository.js";

import type { SellerProfileRepository } from "./repositories/seller-profile.repository.js";

import type { ProfessionalProfileRepository } from "./repositories/professional-profile.repository.js";

import type { UserRepository } from "./repositories/user.repository.js";

import type { WishlistRepository } from "./repositories/wishlist.repository.js";

import { createApiRouter } from "./routes/index.js";

import { AuthService } from "./services/auth.service.js";

import { AdminDashboardService } from "./services/admin-dashboard.service.js";

import { CategoryService } from "./services/category.service.js";

import { OrderService } from "./services/order.service.js";

import {
  LocalPaymentProofStorage,
  type PaymentProofStorage,
} from "./services/payment-proof-storage.js";

import { SupabasePaymentProofStorage } from "./services/supabase-payment-proof-storage.js";

import { PaymentService } from "./services/payment.service.js";

import { ProductService } from "./services/product.service.js";

import { ReviewService } from "./services/review.service.js";

import { RfqService } from "./services/rfq.service.js";

import { SellerDashboardService } from "./services/seller-dashboard.service.js";

import { SellerInventoryService } from "./services/seller-inventory.service.js";

import { SellerProfileService } from "./services/seller-profile.service.js";

import { ProfessionalProfileService } from "./services/professional-profile.service.js";

import { WishlistService } from "./services/wishlist.service.js";

import {
  JwtTokenService,
  type TokenService,
} from "./services/token.service.js";

import { prisma } from "./prisma/client.js";

import { validateRequest } from "./middleware/validate-request.js";

import { emptyObjectSchema } from "./validators/auth.validators.js";

const JSON_BODY_LIMIT = "128kb";

export interface AppDependencies {
  adminDashboardRepository?: AdminDashboardRepository;
  userRepository?: UserRepository;
  categoryRepository?: CategoryRepository;
  orderRepository?: OrderRepository;
  paymentRepository?: PaymentRepository;
  sellerPaymentRepository?: SellerPaymentRepository;
  productRepository?: ProductRepository;
  reviewRepository?: ReviewRepository;
  rfqRepository?: RfqRepository;
  sellerDashboardRepository?: SellerDashboardRepository;
  sellerInventoryRepository?: SellerInventoryRepository;
  sellerProfileRepository?: SellerProfileRepository;
  professionalProfileRepository?: ProfessionalProfileRepository;
  wishlistRepository?: WishlistRepository;
  paymentProofStorage?: PaymentProofStorage;
  tokenService?: TokenService;
  logger?: Logger;
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const appLogger = dependencies.logger ?? defaultLogger;

  const userRepository =
    dependencies.userRepository ?? new PrismaUserRepository(prisma);

  const categoryRepository =
    dependencies.categoryRepository ?? new PrismaCategoryRepository(prisma);

  const orderRepository =
    dependencies.orderRepository ?? new PrismaOrderRepository(prisma);

  const paymentRepository =
    dependencies.paymentRepository ?? new PrismaPaymentRepository(prisma);

  const sellerPaymentRepository =
    dependencies.sellerPaymentRepository ??
    new PrismaSellerPaymentRepository(prisma);

  const productRepository =
    dependencies.productRepository ?? new PrismaProductRepository(prisma);

  const reviewRepository =
    dependencies.reviewRepository ?? new PrismaReviewRepository(prisma);

  const rfqRepository =
    dependencies.rfqRepository ?? new PrismaRfqRepository(prisma);

  const sellerDashboardRepository =
    dependencies.sellerDashboardRepository ??
    new PrismaSellerDashboardRepository(prisma);

  const sellerInventoryRepository =
    dependencies.sellerInventoryRepository ??
    new PrismaSellerInventoryRepository(prisma);

  const sellerProfileRepository =
    dependencies.sellerProfileRepository ??
    new PrismaSellerProfileRepository(prisma);

  const professionalProfileRepository =
    dependencies.professionalProfileRepository ??
    new PrismaProfessionalProfileRepository(prisma);

  const wishlistRepository =
    dependencies.wishlistRepository ?? new PrismaWishlistRepository(prisma);

  const adminDashboardRepository =
    dependencies.adminDashboardRepository ??
    new PrismaAdminDashboardRepository(prisma);

  const tokenService = dependencies.tokenService ?? new JwtTokenService();

  const authService = new AuthService(userRepository, tokenService);

  const authController = new AuthController(authService);

  const adminDashboardService = new AdminDashboardService(
    adminDashboardRepository,
  );

  const adminDashboardController = new AdminDashboardController(
    adminDashboardService,
  );

  const categoryService = new CategoryService(categoryRepository);

  const categoryController = new CategoryController(categoryService);

  const orderService = new OrderService(
    orderRepository,
    sellerPaymentRepository,
  );

  const orderController = new OrderController(orderService);

  const paymentProofStorage: PaymentProofStorage =
    dependencies.paymentProofStorage ??
    (env.SUPABASE_URL &&
    env.SUPABASE_SERVICE_ROLE_KEY &&
    env.SUPABASE_STORAGE_BUCKET
      ? new SupabasePaymentProofStorage(
          env.SUPABASE_URL,
          env.SUPABASE_SERVICE_ROLE_KEY,
          env.SUPABASE_STORAGE_BUCKET,
        )
      : new LocalPaymentProofStorage(
          path.resolve(env.PAYMENT_PROOF_UPLOAD_DIR),
        ));

  const paymentService = new PaymentService(
    paymentRepository,
    orderRepository,
    sellerPaymentRepository,
    paymentProofStorage,
  );

  const paymentController = new PaymentController(paymentService);

  const productService = new ProductService(productRepository);

  const productController = new ProductController(productService);

  const reviewService = new ReviewService(reviewRepository);

  const reviewController = new ReviewController(reviewService);

  const rfqService = new RfqService(rfqRepository);

  const rfqController = new RfqController(rfqService);

  const sellerDashboardService = new SellerDashboardService(
    sellerDashboardRepository,
  );

  const sellerDashboardController = new SellerDashboardController(
    sellerDashboardService,
  );

  const sellerInventoryService = new SellerInventoryService(
    sellerInventoryRepository,
  );

  const sellerInventoryController = new SellerInventoryController(
    sellerInventoryService,
  );

  const sellerProfileService = new SellerProfileService(
    sellerProfileRepository,
  );

  const sellerProfileController = new SellerProfileController(
    sellerProfileService,
  );

  const professionalProfileService = new ProfessionalProfileService(
    professionalProfileRepository,
  );

  const professionalProfileController = new ProfessionalProfileController(
    professionalProfileService,
  );

  const wishlistService = new WishlistService(wishlistRepository);

  const wishlistController = new WishlistController(wishlistService);

  const app = express();

  app.disable("x-powered-by");

  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(pinoHttp({ logger: appLogger }));

  app.use(helmet());

  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type"],
    }),
  );

  if (env.NODE_ENV !== "development") {
    app.use(createGlobalRateLimiter());
  }

  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use(cookieParser());

  // Root endpoint
  app.get("/", (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        name: "CMM Backend API",
        status: "ok",
      },
    });
  });

  // Health endpoint
  app.get(
    "/health",
    validateRequest({
      body: emptyObjectSchema,
      params: emptyObjectSchema,
      query: emptyObjectSchema,
    }),
    (_req, res) => {
      res.status(200).json({
        success: true,
        data: { status: "ok" },
      });
    },
  );

  app.use(
    "/api",
    createApiRouter(
      adminDashboardController,
      authController,
      categoryController,
      orderController,
      paymentController,
      productController,
      professionalProfileController,
      reviewController,
      rfqController,
      sellerDashboardController,
      sellerInventoryController,
      sellerProfileController,
      wishlistController,
      tokenService,
      userRepository,
    ),
  );

  app.use(notFoundHandler);

  app.use(createErrorHandler(appLogger));

  return app;
}