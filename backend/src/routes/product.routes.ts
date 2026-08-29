import { Router, type RequestHandler } from "express";
import type { ProductController } from "../controllers/product.controller.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  addProductImageBodySchema,
  createProductBodySchema,
  emptyProductObjectSchema,
  marketplaceSellersQuerySchema,
  productDiscoveryQuerySchema,
  productImageIdParamsSchema,
  productIdParamsSchema,
  sellerStoreParamsSchema,
  sellerStoreQuerySchema,
  updateProductBodySchema,
} from "../validators/product.validators.js";

export function createProductRouter(
  controller: ProductController,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();

  router.post(
    "/",
    requireAuthentication,
    authorizeRoles("SELLER"),
    validateRequest({
      body: createProductBodySchema,
      params: emptyProductObjectSchema,
      query: emptyProductObjectSchema,
    }),
    asyncHandler(controller.create),
  );

  router.get(
    "/",
    validateRequest({
      body: emptyProductObjectSchema,
      params: emptyProductObjectSchema,
      query: productDiscoveryQuerySchema,
    }),
    asyncHandler(controller.findAll),
  );

  router.get(
    "/marketplace/cities",
    validateRequest({
      body: emptyProductObjectSchema,
      params: emptyProductObjectSchema,
      query: emptyProductObjectSchema,
    }),
    asyncHandler(controller.findMarketplaceCities),
  );

  router.get(
    "/marketplace/sellers",
    validateRequest({
      body: emptyProductObjectSchema,
      params: emptyProductObjectSchema,
      query: marketplaceSellersQuerySchema,
    }),
    asyncHandler(controller.findMarketplaceSellers),
  );

  router.get(
    "/stores/:sellerId",
    validateRequest({
      body: emptyProductObjectSchema,
      params: sellerStoreParamsSchema,
      query: sellerStoreQuerySchema,
    }),
    asyncHandler(controller.findSellerStore),
  );

  router.post(
    "/:id/images",
    requireAuthentication,
    authorizeRoles("SELLER"),
    validateRequest({
      body: addProductImageBodySchema,
      params: productIdParamsSchema,
      query: emptyProductObjectSchema,
    }),
    asyncHandler(controller.addImage),
  );

  router.get(
    "/:id/images",
    validateRequest({
      body: emptyProductObjectSchema,
      params: productIdParamsSchema,
      query: emptyProductObjectSchema,
    }),
    asyncHandler(controller.findImages),
  );

  router.delete(
    "/:id/images/:imageId",
    requireAuthentication,
    authorizeRoles("SELLER"),
    validateRequest({
      body: emptyProductObjectSchema,
      params: productImageIdParamsSchema,
      query: emptyProductObjectSchema,
    }),
    asyncHandler(controller.deleteImage),
  );

  router.patch(
    "/:id/images/:imageId/primary",
    requireAuthentication,
    authorizeRoles("SELLER"),
    validateRequest({
      body: emptyProductObjectSchema,
      params: productImageIdParamsSchema,
      query: emptyProductObjectSchema,
    }),
    asyncHandler(controller.setPrimaryImage),
  );

  router.get(
    "/:id",
    validateRequest({
      body: emptyProductObjectSchema,
      params: productIdParamsSchema,
      query: emptyProductObjectSchema,
    }),
    asyncHandler(controller.findById),
  );

  router.put(
    "/:id",
    requireAuthentication,
    authorizeRoles("SELLER"),
    validateRequest({
      body: updateProductBodySchema,
      params: productIdParamsSchema,
      query: emptyProductObjectSchema,
    }),
    asyncHandler(controller.update),
  );

  router.delete(
    "/:id",
    requireAuthentication,
    authorizeRoles("SELLER"),
    validateRequest({
      body: emptyProductObjectSchema,
      params: productIdParamsSchema,
      query: emptyProductObjectSchema,
    }),
    asyncHandler(controller.delete),
  );

  return router;
}
