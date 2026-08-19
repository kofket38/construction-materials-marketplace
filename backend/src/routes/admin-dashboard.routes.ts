import { Router, type RequestHandler } from "express";
import type { AdminDashboardController } from "../controllers/admin-dashboard.controller.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  adminOrdersQuerySchema,
  adminProductIdParamsSchema,
  adminProductsQuerySchema,
  adminSellersQuerySchema,
  adminUserIdParamsSchema,
  adminUsersQuerySchema,
  emptyAdminObjectSchema,
  updateAdminUserStatusBodySchema,
} from "../validators/admin-dashboard.validators.js";

export function createAdminDashboardRouter(
  controller: AdminDashboardController,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();

  router.use(requireAuthentication, authorizeRoles("ADMIN"));

  router.get(
    "/orders",
    validateRequest({
      body: emptyAdminObjectSchema,
      params: emptyAdminObjectSchema,
      query: adminOrdersQuerySchema,
    }),
    asyncHandler(controller.findOrders),
  );

  router.get(
    "/dashboard",
    validateRequest({
      body: emptyAdminObjectSchema,
      params: emptyAdminObjectSchema,
      query: emptyAdminObjectSchema,
    }),
    asyncHandler(controller.getDashboard),
  );

  router.get(
    "/users",
    validateRequest({
      body: emptyAdminObjectSchema,
      params: emptyAdminObjectSchema,
      query: adminUsersQuerySchema,
    }),
    asyncHandler(controller.findUsers),
  );

  router.patch(
    "/users/:id/status",
    validateRequest({
      body: updateAdminUserStatusBodySchema,
      params: adminUserIdParamsSchema,
      query: emptyAdminObjectSchema,
    }),
    asyncHandler(controller.updateUserStatus),
  );

  router.get(
    "/sellers",
    validateRequest({
      body: emptyAdminObjectSchema,
      params: emptyAdminObjectSchema,
      query: adminSellersQuerySchema,
    }),
    asyncHandler(controller.findSellers),
  );

  router.get(
    "/products",
    validateRequest({
      body: emptyAdminObjectSchema,
      params: emptyAdminObjectSchema,
      query: adminProductsQuerySchema,
    }),
    asyncHandler(controller.findProducts),
  );

  router.delete(
    "/products/:id",
    validateRequest({
      body: emptyAdminObjectSchema,
      params: adminProductIdParamsSchema,
      query: emptyAdminObjectSchema,
    }),
    asyncHandler(controller.deleteProduct),
  );

  return router;
}
