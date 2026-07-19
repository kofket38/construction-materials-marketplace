import { Router } from "express";
import type { ProductController } from "../controllers/product.controller.js";
import { authenticate } from "../middleware/authentication.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import type { TokenService } from "../services/token.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  createProductBodySchema,
  emptyProductObjectSchema,
  productDiscoveryQuerySchema,
  productIdParamsSchema,
  updateProductBodySchema,
} from "../validators/product.validators.js";

export function createProductRouter(
  controller: ProductController,
  tokenService: TokenService,
): Router {
  const router = Router();

  router.post(
    "/",
    authenticate(tokenService),
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
    authenticate(tokenService),
    validateRequest({
      body: updateProductBodySchema,
      params: productIdParamsSchema,
      query: emptyProductObjectSchema,
    }),
    asyncHandler(controller.update),
  );

  router.delete(
    "/:id",
    authenticate(tokenService),
    validateRequest({
      body: emptyProductObjectSchema,
      params: productIdParamsSchema,
      query: emptyProductObjectSchema,
    }),
    asyncHandler(controller.delete),
  );

  return router;
}
