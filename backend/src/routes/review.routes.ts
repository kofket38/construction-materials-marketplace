import { Router, type RequestHandler } from "express";
import type { ReviewController } from "../controllers/review.controller.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  createReviewBodySchema,
  emptyReviewObjectSchema,
  reviewIdParamsSchema,
  reviewProductIdParamsSchema,
  updateReviewBodySchema,
} from "../validators/review.validators.js";

export function createReviewRouter(
  controller: ReviewController,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();

  router.get(
    "/products/:id/reviews",
    validateRequest({
      body: emptyReviewObjectSchema,
      params: reviewProductIdParamsSchema,
      query: emptyReviewObjectSchema,
    }),
    asyncHandler(controller.findByProductId),
  );

  router.post(
    "/products/:id/reviews",
    requireAuthentication,
    authorizeRoles("CUSTOMER", "PROFESSIONAL"),
    validateRequest({
      body: createReviewBodySchema,
      params: reviewProductIdParamsSchema,
      query: emptyReviewObjectSchema,
    }),
    asyncHandler(controller.create),
  );

  router.put(
    "/reviews/:id",
    requireAuthentication,
    authorizeRoles("CUSTOMER", "PROFESSIONAL"),
    validateRequest({
      body: updateReviewBodySchema,
      params: reviewIdParamsSchema,
      query: emptyReviewObjectSchema,
    }),
    asyncHandler(controller.update),
  );

  router.delete(
    "/reviews/:id",
    requireAuthentication,
    authorizeRoles("CUSTOMER", "PROFESSIONAL", "ADMIN"),
    validateRequest({
      body: emptyReviewObjectSchema,
      params: reviewIdParamsSchema,
      query: emptyReviewObjectSchema,
    }),
    asyncHandler(controller.delete),
  );

  return router;
}
