import { Router, type RequestHandler } from "express";
import type { ProfessionalProfileController } from "../controllers/professional-profile.controller.js";
import { validateRequest } from "../middleware/validate-request.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  createCredentialBodySchema,
  createPortfolioItemBodySchema,
  createProfessionalProfileBodySchema,
  credentialIdParamsSchema,
  emptyProfessionalProfileObjectSchema,
  listProfessionalProfilesQuerySchema,
  portfolioItemIdParamsSchema,
  profileIdParamsSchema,
  replaceSpecialtiesBodySchema,
  updateCredentialBodySchema,
  updatePortfolioItemBodySchema,
  updateProfessionalProfileBodySchema,
} from "../validators/professional-profile.validators.js";

export function createProfessionalProfileRouter(
  controller: ProfessionalProfileController,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();

  // ── GET /api/professional-profiles ──────────────────────────────────────────
  // Public directory of PUBLISHED (visibility = PUBLIC) professional profiles.
  // Anonymous access is intentional; the PUBLIC filter is enforced inside the
  // repository query so PRIVATE profiles can never leak.
  // Must be registered BEFORE /me and /:profileId (Express matches in order).
  router.get(
    "/",
    validateRequest({
      body: emptyProfessionalProfileObjectSchema,
      params: emptyProfessionalProfileObjectSchema,
      query: listProfessionalProfilesQuerySchema,
    }),
    asyncHandler(controller.list),
  );

  // ── POST /api/professional-profiles ─────────────────────────────────────────
  // Authenticated users only (any role may create a professional profile).
  router.post(
    "/",
    requireAuthentication,
    validateRequest({
      body: createProfessionalProfileBodySchema,
      params: emptyProfessionalProfileObjectSchema,
      query: emptyProfessionalProfileObjectSchema,
    }),
    asyncHandler(controller.create),
  );

  // ── GET /api/professional-profiles/me ────────────────────────────────────────
  // Returns the authenticated user's own profile (null if not yet created).
  // Must be registered BEFORE /:profileId to prevent "me" being treated as a UUID.
  router.get(
    "/me",
    requireAuthentication,
    validateRequest({
      body: emptyProfessionalProfileObjectSchema,
      params: emptyProfessionalProfileObjectSchema,
      query: emptyProfessionalProfileObjectSchema,
    }),
    asyncHandler(controller.getOwn),
  );

  // ── GET /api/professional-profiles/:profileId ─────────────────────────────────
  // Public profiles visible to anyone; private profiles require ownership.
  // Authentication is OPTIONAL — controller handles visibility gating.
  // tryAuthenticate populates req.auth when a valid token is present but
  // does not block unauthenticated requests.
  router.get(
    "/:profileId",
    tryAuthenticate(requireAuthentication),
    validateRequest({
      body: emptyProfessionalProfileObjectSchema,
      params: profileIdParamsSchema,
      query: emptyProfessionalProfileObjectSchema,
    }),
    asyncHandler(controller.getById),
  );

  // ── PATCH /api/professional-profiles/:profileId ───────────────────────────────
  router.patch(
    "/:profileId",
    requireAuthentication,
    validateRequest({
      body: updateProfessionalProfileBodySchema,
      params: profileIdParamsSchema,
      query: emptyProfessionalProfileObjectSchema,
    }),
    asyncHandler(controller.update),
  );

  // ── DELETE /api/professional-profiles/:profileId ──────────────────────────────
  router.delete(
    "/:profileId",
    requireAuthentication,
    validateRequest({
      body: emptyProfessionalProfileObjectSchema,
      params: profileIdParamsSchema,
      query: emptyProfessionalProfileObjectSchema,
    }),
    asyncHandler(controller.delete),
  );

  // ── PUT /api/professional-profiles/:profileId/specialties ─────────────────────
  router.put(
    "/:profileId/specialties",
    requireAuthentication,
    validateRequest({
      body: replaceSpecialtiesBodySchema,
      params: profileIdParamsSchema,
      query: emptyProfessionalProfileObjectSchema,
    }),
    asyncHandler(controller.replaceSpecialties),
  );

  // ── POST /api/professional-profiles/:profileId/credentials ───────────────────
  router.post(
    "/:profileId/credentials",
    requireAuthentication,
    validateRequest({
      body: createCredentialBodySchema,
      params: profileIdParamsSchema,
      query: emptyProfessionalProfileObjectSchema,
    }),
    asyncHandler(controller.addCredential),
  );

  // ── PATCH /api/professional-profiles/:profileId/credentials/:credentialId ─────
  router.patch(
    "/:profileId/credentials/:credentialId",
    requireAuthentication,
    validateRequest({
      body: updateCredentialBodySchema,
      params: profileIdParamsSchema.merge(credentialIdParamsSchema),
      query: emptyProfessionalProfileObjectSchema,
    }),
    asyncHandler(controller.updateCredential),
  );

  // ── DELETE /api/professional-profiles/:profileId/credentials/:credentialId ────
  router.delete(
    "/:profileId/credentials/:credentialId",
    requireAuthentication,
    validateRequest({
      body: emptyProfessionalProfileObjectSchema,
      params: profileIdParamsSchema.merge(credentialIdParamsSchema),
      query: emptyProfessionalProfileObjectSchema,
    }),
    asyncHandler(controller.deleteCredential),
  );

  // ── GET /api/professional-profiles/:profileId/portfolio ──────────────────────
  // PUBLIC profiles are readable by anyone (authentication optional);
  // PRIVATE profiles are readable only by their owner. The service enforces
  // visibility, so tryAuthenticate is used exactly as for GET /:profileId.
  router.get(
    "/:profileId/portfolio",
    tryAuthenticate(requireAuthentication),
    validateRequest({
      body: emptyProfessionalProfileObjectSchema,
      params: profileIdParamsSchema,
      query: emptyProfessionalProfileObjectSchema,
    }),
    asyncHandler(controller.listPortfolio),
  );

  // ── POST /api/professional-profiles/:profileId/portfolio ─────────────────────
  router.post(
    "/:profileId/portfolio",
    requireAuthentication,
    validateRequest({
      body: createPortfolioItemBodySchema,
      params: profileIdParamsSchema,
      query: emptyProfessionalProfileObjectSchema,
    }),
    asyncHandler(controller.addPortfolioItem),
  );

  // ── PATCH /api/professional-profiles/:profileId/portfolio/:itemId ────────────
  router.patch(
    "/:profileId/portfolio/:itemId",
    requireAuthentication,
    validateRequest({
      body: updatePortfolioItemBodySchema,
      params: profileIdParamsSchema.merge(portfolioItemIdParamsSchema),
      query: emptyProfessionalProfileObjectSchema,
    }),
    asyncHandler(controller.updatePortfolioItem),
  );

  // ── DELETE /api/professional-profiles/:profileId/portfolio/:itemId ───────────
  router.delete(
    "/:profileId/portfolio/:itemId",
    requireAuthentication,
    validateRequest({
      body: emptyProfessionalProfileObjectSchema,
      params: profileIdParamsSchema.merge(portfolioItemIdParamsSchema),
      query: emptyProfessionalProfileObjectSchema,
    }),
    asyncHandler(controller.deletePortfolioItem),
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
      // The controller handles authorization for private profiles.
      void err;
      next();
    });
  };
}
