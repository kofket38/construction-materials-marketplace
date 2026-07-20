import { Router, type RequestHandler } from "express";
import type { WishlistController } from "../controllers/wishlist.controller.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  emptyWishlistObjectSchema,
  wishlistProductIdParamsSchema,
} from "../validators/wishlist.validators.js";

export function createWishlistRouter(
  controller: WishlistController,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();

  router.get(
    "/",
    requireAuthentication,
    authorizeRoles("CUSTOMER"),
    validateRequest({
      body: emptyWishlistObjectSchema,
      params: emptyWishlistObjectSchema,
      query: emptyWishlistObjectSchema,
    }),
    asyncHandler(controller.findAll),
  );

  router.post(
    "/:productId",
    requireAuthentication,
    authorizeRoles("CUSTOMER"),
    validateRequest({
      body: emptyWishlistObjectSchema,
      params: wishlistProductIdParamsSchema,
      query: emptyWishlistObjectSchema,
    }),
    asyncHandler(controller.create),
  );

  router.delete(
    "/:productId",
    requireAuthentication,
    authorizeRoles("CUSTOMER"),
    validateRequest({
      body: emptyWishlistObjectSchema,
      params: wishlistProductIdParamsSchema,
      query: emptyWishlistObjectSchema,
    }),
    asyncHandler(controller.delete),
  );

  return router;
}
