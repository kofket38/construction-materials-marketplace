import { Router } from "express";
import type { SellerDashboardController } from "../controllers/seller-dashboard.controller.js";
import { authenticate } from "../middleware/authentication.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import type { TokenService } from "../services/token.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  emptySellerDashboardObjectSchema,
  sellerOrdersQuerySchema,
  sellerProductsQuerySchema,
} from "../validators/seller-dashboard.validators.js";

export function createSellerDashboardRouter(
  controller: SellerDashboardController,
  tokenService: TokenService,
): Router {
  const router = Router();

  router.use(authenticate(tokenService), authorizeRoles("SELLER"));

  router.get(
    "/dashboard",
    validateRequest({
      body: emptySellerDashboardObjectSchema,
      params: emptySellerDashboardObjectSchema,
      query: emptySellerDashboardObjectSchema,
    }),
    asyncHandler(controller.getDashboard),
  );

  router.get(
    "/products",
    validateRequest({
      body: emptySellerDashboardObjectSchema,
      params: emptySellerDashboardObjectSchema,
      query: sellerProductsQuerySchema,
    }),
    asyncHandler(controller.findProducts),
  );

  router.get(
    "/orders",
    validateRequest({
      body: emptySellerDashboardObjectSchema,
      params: emptySellerDashboardObjectSchema,
      query: sellerOrdersQuerySchema,
    }),
    asyncHandler(controller.findOrders),
  );

  router.get(
    "/analytics",
    validateRequest({
      body: emptySellerDashboardObjectSchema,
      params: emptySellerDashboardObjectSchema,
      query: emptySellerDashboardObjectSchema,
    }),
    asyncHandler(controller.getAnalytics),
  );

  return router;
}
