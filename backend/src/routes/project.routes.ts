import { Router, type RequestHandler } from "express";
import type { ProjectController } from "../controllers/project.controller.js";
import { validateRequest } from "../middleware/validate-request.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  changeProjectStatusBodySchema,
  createProjectBodySchema,
  emptyProjectObjectSchema,
  listPublishedProjectsQuerySchema,
  projectIdParamsSchema,
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
  // Authenticated users only (any role may own projects).
  router.post(
    "/",
    requireAuthentication,
    validateRequest({
      body: createProjectBodySchema,
      params: emptyProjectObjectSchema,
      query: emptyProjectObjectSchema,
    }),
    asyncHandler(controller.create),
  );

  // ── GET /api/projects/me ────────────────────────────────────────────────────
  // Returns every project owned by the authenticated user in display order.
  // Must be registered BEFORE /:projectId to prevent "me" being treated as a UUID.
  router.get(
    "/me",
    requireAuthentication,
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
    validateRequest({
      body: changeProjectStatusBodySchema,
      params: projectIdParamsSchema,
      query: emptyProjectObjectSchema,
    }),
    asyncHandler(controller.changeStatus),
  );

  // ── DELETE /api/projects/:projectId ─────────────────────────────────────────
  router.delete(
    "/:projectId",
    requireAuthentication,
    validateRequest({
      body: emptyProjectObjectSchema,
      params: projectIdParamsSchema,
      query: emptyProjectObjectSchema,
    }),
    asyncHandler(controller.delete),
  );

  return router;
}

/**
 * Wraps a mandatory authentication middleware so it becomes optional.
 * When a valid token is present, req.auth is populated as usual.
 * When the token is missing or invalid, the request continues unauthenticated
 * (req.auth remains undefined) rather than being rejected.
 */
function tryAuthenticate(authenticate: RequestHandler): RequestHandler {
  return (req, res, next) => {
    authenticate(req, res, (err) => {
      // Suppress authentication errors so public access still works.
      // The service handles authorization for non-published projects.
      void err;
      next();
    });
  };
}
