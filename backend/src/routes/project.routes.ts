import { Router, type RequestHandler } from "express";
import type { ProjectController } from "../controllers/project.controller.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { tryAuthenticate } from "../middleware/optional-authentication.js";
import { validateRequest } from "../middleware/validate-request.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  changeProjectStatusBodySchema,
  createProjectBodySchema,
  emptyProjectObjectSchema,
  listPublishedProjectsQuerySchema,
  projectIdParamsSchema,
  projectOrderLinkParamsSchema,
  projectRfqLinkParamsSchema,
  reorderProjectsBodySchema,
  updateProjectBodySchema,
} from "../validators/project.validators.js";

export function createProjectRouter(
  controller: ProjectController,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();

  // ── GET /api/projects ───────────────────────────────────────────────────────
  // Public search of PUBLISHED projects. Anonymous access is intentional; the
  // PUBLISHED filter is enforced inside the repository query so drafts and
  // other non-published states can never leak.
  router.get(
    "/",
    validateRequest({
      body: emptyProjectObjectSchema,
      params: emptyProjectObjectSchema,
      query: listPublishedProjectsQuerySchema,
    }),
    asyncHandler(controller.list),
  );

  // ── POST /api/projects ──────────────────────────────────────────────────────
  // PROFESSIONAL accounts only (route and service gated).
  router.post(
    "/",
    requireAuthentication,
    authorizeRoles("PROFESSIONAL"),
    validateRequest({
      body: createProjectBodySchema,
      params: emptyProjectObjectSchema,
      query: emptyProjectObjectSchema,
    }),
    asyncHandler(controller.create),
  );

  // ── GET /api/projects/me ────────────────────────────────────────────────────
  // PROFESSIONAL accounts only. Returns every project owned by the
  // authenticated professional in display order. Other roles cannot own
  // projects — PROFESSIONAL is registration-only — so they receive 403 rather
  // than a meaningless empty list.
  // Must be registered BEFORE /:projectId to prevent "me" being treated as a UUID.
  router.get(
    "/me",
    requireAuthentication,
    authorizeRoles("PROFESSIONAL"),
    validateRequest({
      body: emptyProjectObjectSchema,
      params: emptyProjectObjectSchema,
      query: emptyProjectObjectSchema,
    }),
    asyncHandler(controller.getMyProjects),
  );

  // ── PUT /api/projects/me/reorder ────────────────────────────────────────────
  router.put(
    "/me/reorder",
    requireAuthentication,
    authorizeRoles("PROFESSIONAL"),
    validateRequest({
      body: reorderProjectsBodySchema,
      params: emptyProjectObjectSchema,
      query: emptyProjectObjectSchema,
    }),
    asyncHandler(controller.reorder),
  );

  // ── GET /api/projects/:projectId ────────────────────────────────────────────
  // Owners may read their project in any status; everyone else only sees
  // PUBLISHED projects. Authentication is OPTIONAL — tryAuthenticate populates
  // req.auth when a valid token is present but does not block anonymous
  // requests; visibility gating lives in the service.
  router.get(
    "/:projectId",
    tryAuthenticate(requireAuthentication),
    validateRequest({
      body: emptyProjectObjectSchema,
      params: projectIdParamsSchema,
      query: emptyProjectObjectSchema,
    }),
    asyncHandler(controller.getById),
  );

  // ── PATCH /api/projects/:projectId ──────────────────────────────────────────
  router.patch(
    "/:projectId",
    requireAuthentication,
    authorizeRoles("PROFESSIONAL"),
    validateRequest({
      body: updateProjectBodySchema,
      params: projectIdParamsSchema,
      query: emptyProjectObjectSchema,
    }),
    asyncHandler(controller.update),
  );

  // ── PATCH /api/projects/:projectId/status ───────────────────────────────────
  router.patch(
    "/:projectId/status",
    requireAuthentication,
    authorizeRoles("PROFESSIONAL"),
    validateRequest({
      body: changeProjectStatusBodySchema,
      params: projectIdParamsSchema,
      query: emptyProjectObjectSchema,
    }),
    asyncHandler(controller.changeStatus),
  );

  // ── GET /api/projects/:projectId/procurement ────────────────────────────────
  // Owner-only view of the RFQs and orders attached to the project. The route
  // guard stops non-professionals early; ownership is enforced in the service,
  // which reports a foreign or missing project identically (404).
  router.get(
    "/:projectId/procurement",
    requireAuthentication,
    authorizeRoles("PROFESSIONAL"),
    validateRequest({
      body: emptyProjectObjectSchema,
      params: projectIdParamsSchema,
      query: emptyProjectObjectSchema,
    }),
    asyncHandler(controller.getProcurement),
  );

  // ── DELETE /api/projects/:projectId/procurement/rfqs/:rfqId ─────────────────
  // Owner-only. Clears the project link on one attached RFQ; the RFQ itself is
  // untouched. Registered before DELETE /:projectId, and required because the
  // procurement foreign keys are ON DELETE RESTRICT: the RFQ update endpoint
  // only accepts OPEN, quote-free requests, so without this an owner could be
  // permanently unable to delete the project.
  router.delete(
    "/:projectId/procurement/rfqs/:rfqId",
    requireAuthentication,
    authorizeRoles("PROFESSIONAL"),
    validateRequest({
      body: emptyProjectObjectSchema,
      params: projectRfqLinkParamsSchema,
      query: emptyProjectObjectSchema,
    }),
    asyncHandler(controller.detachRfq),
  );

  // ── DELETE /api/projects/:projectId/procurement/orders/:orderId ─────────────
  // Owner-only. Orders have no update endpoint, so this is the only way to
  // release a project that order history points at.
  router.delete(
    "/:projectId/procurement/orders/:orderId",
    requireAuthentication,
    authorizeRoles("PROFESSIONAL"),
    validateRequest({
      body: emptyProjectObjectSchema,
      params: projectOrderLinkParamsSchema,
      query: emptyProjectObjectSchema,
    }),
    asyncHandler(controller.detachOrder),
  );

  // ── DELETE /api/projects/:projectId ─────────────────────────────────────────
  router.delete(
    "/:projectId",
    requireAuthentication,
    authorizeRoles("PROFESSIONAL"),
    validateRequest({
      body: emptyProjectObjectSchema,
      params: projectIdParamsSchema,
      query: emptyProjectObjectSchema,
    }),
    asyncHandler(controller.delete),
  );

  return router;
}
