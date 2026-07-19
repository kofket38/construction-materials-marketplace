import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Logger } from "pino";
import { AuthController } from "./controllers/auth.controller.js";
import { CategoryController } from "./controllers/category.controller.js";
import { OrderController } from "./controllers/order.controller.js";
import { ProductController } from "./controllers/product.controller.js";
import { SellerDashboardController } from "./controllers/seller-dashboard.controller.js";
import { env } from "./config/env.js";
import { logger as defaultLogger } from "./config/logger.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { createGlobalRateLimiter } from "./middleware/rate-limit.js";
import { PrismaUserRepository } from "./repositories/prisma-user.repository.js";
import { PrismaProductRepository } from "./repositories/prisma-product.repository.js";
import { PrismaCategoryRepository } from "./repositories/prisma-category.repository.js";
import { PrismaOrderRepository } from "./repositories/prisma-order.repository.js";
import { PrismaSellerDashboardRepository } from "./repositories/prisma-seller-dashboard.repository.js";
import type { CategoryRepository } from "./repositories/category.repository.js";
import type { OrderRepository } from "./repositories/order.repository.js";
import type { ProductRepository } from "./repositories/product.repository.js";
import type { SellerDashboardRepository } from "./repositories/seller-dashboard.repository.js";
import type { UserRepository } from "./repositories/user.repository.js";
import { createApiRouter } from "./routes/index.js";
import { AuthService } from "./services/auth.service.js";
import { CategoryService } from "./services/category.service.js";
import { OrderService } from "./services/order.service.js";
import { ProductService } from "./services/product.service.js";
import { SellerDashboardService } from "./services/seller-dashboard.service.js";
import {
  JwtTokenService,
  type TokenService,
} from "./services/token.service.js";
import { prisma } from "./prisma/client.js";
import { validateRequest } from "./middleware/validate-request.js";
import { emptyObjectSchema } from "./validators/auth.validators.js";

export interface AppDependencies {
  userRepository?: UserRepository;
  categoryRepository?: CategoryRepository;
  orderRepository?: OrderRepository;
  productRepository?: ProductRepository;
  sellerDashboardRepository?: SellerDashboardRepository;
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
  const productRepository =
    dependencies.productRepository ?? new PrismaProductRepository(prisma);
  const sellerDashboardRepository =
    dependencies.sellerDashboardRepository ??
    new PrismaSellerDashboardRepository(prisma);
  const tokenService = dependencies.tokenService ?? new JwtTokenService();
  const authService = new AuthService(userRepository, tokenService);
  const authController = new AuthController(authService);
  const categoryService = new CategoryService(categoryRepository);
  const categoryController = new CategoryController(categoryService);
  const orderService = new OrderService(orderRepository);
  const orderController = new OrderController(orderService);
  const productService = new ProductService(productRepository);
  const productController = new ProductController(productService);
  const sellerDashboardService = new SellerDashboardService(
    sellerDashboardRepository,
  );
  const sellerDashboardController = new SellerDashboardController(
    sellerDashboardService,
  );

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
  app.use(createGlobalRateLimiter());
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());

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
      authController,
      categoryController,
      orderController,
      productController,
      sellerDashboardController,
      tokenService,
    ),
  );
  app.use(notFoundHandler);
  app.use(createErrorHandler(appLogger));

  return app;
}
