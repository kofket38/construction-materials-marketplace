import { Router, type RequestHandler } from "express";
import type { ProfessionalProfileController } from "../controllers/professional-profile.controller.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { tryAuthenticate } from "../middleware/optional-authentication.js";
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
  // PROFESSIONAL accounts only (route and service gated). Ownership of the
  // created profile is the authenticated user's own account.
  router.post(
    "/",
    requireAuthentication,
    authorizeRoles("PROFESSIONAL"),
    validateRequest({
      body: createProfessionalProfileBodySchema,
      params: emptyProfessionalProfileObjectSchema,
      query: emptyProfessionalProfileObjectSchema,
    }),
    asyncHandler(controller.create),
  );

  // ── GET /api/professional-profiles/me ────────────────────────────────────────
  // PROFESSIONAL accounts only. Returns the authenticated professional's own
  // profile (null if not yet created). Other roles cannot own a professional
  // profile — PROFESSIONAL is registration-only — so they receive 403 rather
  // than a meaningless null.
  // Must be registered BEFORE /:profileId to prevent "me" being treated as a UUID.
  router.get(
    "/me",
    requireAuthentication,
    authorizeRoles("PROFESSIONAL"),
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
    authorizeRoles("PROFESSIONAL"),
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
    authorizeRoles("PROFESSIONAL"),
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
    authorizeRoles("PROFESSIONAL"),
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
    authorizeRoles("PROFESSIONAL"),
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
    authorizeRoles("PROFESSIONAL"),
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
    authorizeRoles("PROFESSIONAL"),
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
    authorizeRoles("PROFESSIONAL"),
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
    authorizeRoles("PROFESSIONAL"),
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
    authorizeRoles("PROFESSIONAL"),
    validateRequest({
      body: emptyProfessionalProfileObjectSchema,
      params: profileIdParamsSchema.merge(portfolioItemIdParamsSchema),
      query: emptyProfessionalProfileObjectSchema,
    }),
    asyncHandler(controller.deletePortfolioItem),
  );

  return router;
}
