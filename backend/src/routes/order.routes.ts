import { Router, type RequestHandler } from "express";
import type { OrderController } from "../controllers/order.controller.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  createOrderBodySchema,
  emptyOrderObjectSchema,
  orderIdParamsSchema,
  updateOrderStatusBodySchema,
} from "../validators/order.validators.js";

export function createOrderRouter(
  controller: OrderController,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();

  router.post(
    "/",
    requireAuthentication,
    authorizeRoles("CUSTOMER"),
    validateRequest({
      body: createOrderBodySchema,
      params: emptyOrderObjectSchema,
      query: emptyOrderObjectSchema,
    }),
    asyncHandler(controller.create),
  );

  router.get(
    "/",
    requireAuthentication,
    authorizeRoles("CUSTOMER"),
    validateRequest({
      body: emptyOrderObjectSchema,
      params: emptyOrderObjectSchema,
      query: emptyOrderObjectSchema,
    }),
    asyncHandler(controller.findMyOrders),
  );

  router.get(
    "/me",
    requireAuthentication,
    authorizeRoles("CUSTOMER"),
    validateRequest({
      body: emptyOrderObjectSchema,
      params: emptyOrderObjectSchema,
      query: emptyOrderObjectSchema,
    }),
    asyncHandler(controller.findMyOrders),
  );

  router.patch(
    "/:id/status",
    requireAuthentication,
    authorizeRoles("ADMIN"),
    validateRequest({
      body: updateOrderStatusBodySchema,
      params: orderIdParamsSchema,
      query: emptyOrderObjectSchema,
    }),
    asyncHandler(controller.updateStatus),
  );

  router.post(
    "/:id/complete",
    requireAuthentication,
    authorizeRoles("CUSTOMER"),
    validateRequest({
      body: emptyOrderObjectSchema,
      params: orderIdParamsSchema,
      query: emptyOrderObjectSchema,
    }),
    asyncHandler(controller.complete),
  );

  router.get(
    "/:id",
    requireAuthentication,
    authorizeRoles("CUSTOMER", "ADMIN"),
    validateRequest({
      body: emptyOrderObjectSchema,
      params: orderIdParamsSchema,
      query: emptyOrderObjectSchema,
    }),
    asyncHandler(controller.findById),
  );

  router.delete(
    "/:id",
    requireAuthentication,
    authorizeRoles("CUSTOMER", "ADMIN"),
    validateRequest({
      body: emptyOrderObjectSchema,
      params: orderIdParamsSchema,
      query: emptyOrderObjectSchema,
    }),
    asyncHandler(controller.cancel),
  );

  return router;
}
