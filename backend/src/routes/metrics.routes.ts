import { Router, type RequestHandler } from "express";
import type { MetricsController } from "../controllers/metrics.controller.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import { asyncHandler } from "../utils/async-handler.js";
import { emptyObjectSchema } from "../validators/auth.validators.js";

export function createMetricsRouter(
  controller: MetricsController,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();
  const noInput = validateRequest({
    body: emptyObjectSchema,
    params: emptyObjectSchema,
    query: emptyObjectSchema,
  });

  // All metrics endpoints require admin role
  router.use(requireAuthentication, authorizeRoles("ADMIN"));

  router.get(
    "/",
    noInput,
    asyncHandler(controller.getMetrics),
  );

  router.get(
    "/prometheus",
    noInput,
    asyncHandler(controller.getPrometheusMetrics),
  );

  router.delete(
    "/",
    noInput,
    asyncHandler(controller.resetMetrics),
  );

  return router;
}
