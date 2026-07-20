import { Router, type RequestHandler } from "express";
import type { CategoryController } from "../controllers/category.controller.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  categoryIdParamsSchema,
  createCategoryBodySchema,
  emptyCategoryObjectSchema,
  updateCategoryBodySchema,
} from "../validators/category.validators.js";

export function createCategoryRouter(
  controller: CategoryController,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();

  router.get(
    "/",
    validateRequest({
      body: emptyCategoryObjectSchema,
      params: emptyCategoryObjectSchema,
      query: emptyCategoryObjectSchema,
    }),
    asyncHandler(controller.findAll),
  );

  router.get(
    "/:id",
    validateRequest({
      body: emptyCategoryObjectSchema,
      params: categoryIdParamsSchema,
      query: emptyCategoryObjectSchema,
    }),
    asyncHandler(controller.findById),
  );

  router.post(
    "/",
    requireAuthentication,
    authorizeRoles("ADMIN"),
    validateRequest({
      body: createCategoryBodySchema,
      params: emptyCategoryObjectSchema,
      query: emptyCategoryObjectSchema,
    }),
    asyncHandler(controller.create),
  );

  router.put(
    "/:id",
    requireAuthentication,
    authorizeRoles("ADMIN"),
    validateRequest({
      body: updateCategoryBodySchema,
      params: categoryIdParamsSchema,
      query: emptyCategoryObjectSchema,
    }),
    asyncHandler(controller.update),
  );

  router.delete(
    "/:id",
    requireAuthentication,
    authorizeRoles("ADMIN"),
    validateRequest({
      body: emptyCategoryObjectSchema,
      params: categoryIdParamsSchema,
      query: emptyCategoryObjectSchema,
    }),
    asyncHandler(controller.delete),
  );

  return router;
}
