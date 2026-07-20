import { Router, type RequestHandler } from "express";
import type { SellerDashboardController } from "../controllers/seller-dashboard.controller.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  emptySellerDashboardObjectSchema,
  sellerOrdersQuerySchema,
  sellerProductsQuerySchema,
} from "../validators/seller-dashboard.validators.js";

export function createSellerDashboardRouter(
  controller: SellerDashboardController,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();

  router.use(requireAuthentication, authorizeRoles("SELLER"));

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
