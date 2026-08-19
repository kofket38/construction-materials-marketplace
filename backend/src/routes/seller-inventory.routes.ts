import { Router, type RequestHandler } from "express";
import type { SellerInventoryController } from "../controllers/seller-inventory.controller.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  createSellerInventoryBodySchema,
  emptySellerInventoryObjectSchema,
  listSellerInventoryQuerySchema,
  sellerInventoryIdParamsSchema,
  updateSellerInventoryBodySchema,
} from "../validators/seller-inventory.validators.js";

export function createSellerInventoryRouter(
  controller: SellerInventoryController,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();

  router.use(requireAuthentication, authorizeRoles("SELLER"));

  // GET /api/seller/inventory
  router.get(
    "/",
    validateRequest({
      body: emptySellerInventoryObjectSchema,
      params: emptySellerInventoryObjectSchema,
      query: listSellerInventoryQuerySchema,
    }),
    asyncHandler(controller.list),
  );

  // POST /api/seller/inventory
  router.post(
    "/",
    validateRequest({
      body: createSellerInventoryBodySchema,
      params: emptySellerInventoryObjectSchema,
      query: emptySellerInventoryObjectSchema,
    }),
    asyncHandler(controller.create),
  );

  // PATCH /api/seller/inventory/:id
  router.patch(
    "/:id",
    validateRequest({
      body: updateSellerInventoryBodySchema,
      params: sellerInventoryIdParamsSchema,
      query: emptySellerInventoryObjectSchema,
    }),
    asyncHandler(controller.update),
  );

  // DELETE /api/seller/inventory/:id
  router.delete(
    "/:id",
    validateRequest({
      body: emptySellerInventoryObjectSchema,
      params: sellerInventoryIdParamsSchema,
      query: emptySellerInventoryObjectSchema,
    }),
    asyncHandler(controller.remove),
  );

  return router;
}
