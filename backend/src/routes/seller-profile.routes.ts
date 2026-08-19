import { Router, type RequestHandler } from "express";
import type { SellerProfileController } from "../controllers/seller-profile.controller.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  emptySellerProfileObjectSchema,
  patchSellerProfileBodySchema,
  upsertSellerProfileBodySchema,
} from "../validators/seller-profile.validators.js";

export function createSellerProfileRouter(
  controller: SellerProfileController,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();

  router.use(requireAuthentication, authorizeRoles("SELLER"));

  // GET /api/seller/profile — fetch own profile (null when not yet created)
  router.get(
    "/",
    validateRequest({
      body: emptySellerProfileObjectSchema,
      params: emptySellerProfileObjectSchema,
      query: emptySellerProfileObjectSchema,
    }),
    asyncHandler(controller.get),
  );

  // PUT /api/seller/profile — create or fully replace profile
  router.put(
    "/",
    validateRequest({
      body: upsertSellerProfileBodySchema,
      params: emptySellerProfileObjectSchema,
      query: emptySellerProfileObjectSchema,
    }),
    asyncHandler(controller.upsert),
  );

  // PATCH /api/seller/profile — partial update of existing profile
  router.patch(
    "/",
    validateRequest({
      body: patchSellerProfileBodySchema,
      params: emptySellerProfileObjectSchema,
      query: emptySellerProfileObjectSchema,
    }),
    asyncHandler(controller.patch),
  );

  return router;
}
