import { Router } from "express";
import type { OrderController } from "../controllers/order.controller.js";
import { authenticate } from "../middleware/authentication.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import type { TokenService } from "../services/token.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  createOrderBodySchema,
  emptyOrderObjectSchema,
  orderIdParamsSchema,
  updateOrderStatusBodySchema,
} from "../validators/order.validators.js";

export function createOrderRouter(
  controller: OrderController,
  tokenService: TokenService,
): Router {
  const router = Router();

  router.post(
    "/",
    authenticate(tokenService),
    authorizeRoles("CUSTOMER"),
    validateRequest({
      body: createOrderBodySchema,
      params: emptyOrderObjectSchema,
      query: emptyOrderObjectSchema,
    }),
    asyncHandler(controller.create),
  );

  router.get(
    "/me",
    authenticate(tokenService),
    validateRequest({
      body: emptyOrderObjectSchema,
      params: emptyOrderObjectSchema,
      query: emptyOrderObjectSchema,
    }),
    asyncHandler(controller.findMyOrders),
  );

  router.patch(
    "/:id/status",
    authenticate(tokenService),
    authorizeRoles("ADMIN"),
    validateRequest({
      body: updateOrderStatusBodySchema,
      params: orderIdParamsSchema,
      query: emptyOrderObjectSchema,
    }),
    asyncHandler(controller.updateStatus),
  );

  router.get(
    "/:id",
    authenticate(tokenService),
    validateRequest({
      body: emptyOrderObjectSchema,
      params: orderIdParamsSchema,
      query: emptyOrderObjectSchema,
    }),
    asyncHandler(controller.findById),
  );

  router.delete(
    "/:id",
    authenticate(tokenService),
    validateRequest({
      body: emptyOrderObjectSchema,
      params: orderIdParamsSchema,
      query: emptyOrderObjectSchema,
    }),
    asyncHandler(controller.cancel),
  );

  return router;
}
