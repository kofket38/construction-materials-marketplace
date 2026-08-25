import type { Request, Response } from "express";
import type { ProfessionalProfileService } from "../services/professional-profile.service.js";
import { ForbiddenError, UnauthorizedError } from "../utils/api-error.js";
import type {
  CreateProfessionalProfileBody,
  CredentialIdParams,
  CreateCredentialBody,
  ListProfessionalProfilesQueryParams,
  ProfileIdParams,
  ReplaceSpecialtiesBody,
  UpdateCredentialBody,
  UpdateProfessionalProfileBody,
} from "../validators/professional-profile.validators.js";

export class ProfessionalProfileController {
  constructor(
    private readonly service: ProfessionalProfileService,
  ) {}

  // ── Public directory ────────────────────────────────────────────────────────

  /** GET /api/professional-profiles */
  list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.listPublished(
      req.query as ListProfessionalProfilesQueryParams,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  // ── Own profile ────────────────────────────────────────────────────────────

  /** POST /api/professional-profiles */
  create = async (req: Request, res: Response): Promise<void> => {
    const profile = await this.service.create(
      this.requireActor(req),
      req.body as CreateProfessionalProfileBody,
    );

    res.status(201).json({ success: true, data: { profile } });
  };

  /** GET /api/professional-profiles/me */
  getOwn = async (req: Request, res: Response): Promise<void> => {
    const profile = await this.service.getOwnProfile(this.requireActor(req));

    res.status(200).json({ success: true, data: { profile } });
  };

  // ── Public / mixed profile ─────────────────────────────────────────────────

  /**
   * GET /api/professional-profiles/:profileId
   *
   * Public profiles are returned to anyone (authenticated or not).
   * PRIVATE profiles are returned only to their owner; all others receive 403.
   */
  getById = async (req: Request, res: Response): Promise<void> => {
    const { profileId } = req.params as ProfileIdParams;
    const profile = await this.service.getById(profileId);

    if (profile.visibility === "PRIVATE") {
      // Allow access only to the profile owner.
      if (!req.auth || req.auth.userId !== profile.userId) {
        throw new ForbiddenError(
          "This profile is private.",
        );
      }
    }

    res.status(200).json({ success: true, data: { profile } });
  };

  // ── Owner mutations ────────────────────────────────────────────────────────

  /** PATCH /api/professional-profiles/:profileId */
  update = async (req: Request, res: Response): Promise<void> => {
    const { profileId } = req.params as ProfileIdParams;
    const profile = await this.service.update(
      this.requireActor(req),
      profileId,
      req.body as UpdateProfessionalProfileBody,
    );

    res.status(200).json({ success: true, data: { profile } });
  };

  /** DELETE /api/professional-profiles/:profileId */
  delete = async (req: Request, res: Response): Promise<void> => {
    const { profileId } = req.params as ProfileIdParams;
    await this.service.delete(this.requireActor(req), profileId);

    res.status(200).json({ success: true, data: null });
  };

  // ── Specialties ────────────────────────────────────────────────────────────

  /** PUT /api/professional-profiles/:profileId/specialties */
  replaceSpecialties = async (req: Request, res: Response): Promise<void> => {
    const { profileId } = req.params as ProfileIdParams;
    const profile = await this.service.replaceSpecialties(
      this.requireActor(req),
      profileId,
      req.body as ReplaceSpecialtiesBody,
    );

    res.status(200).json({ success: true, data: { profile } });
  };

  // ── Credentials ────────────────────────────────────────────────────────────

  /** POST /api/professional-profiles/:profileId/credentials */
  addCredential = async (req: Request, res: Response): Promise<void> => {
    const { profileId } = req.params as ProfileIdParams;
    const profile = await this.service.addCredential(
      this.requireActor(req),
      profileId,
      req.body as CreateCredentialBody,
    );

    res.status(201).json({ success: true, data: { profile } });
  };

  /** PATCH /api/professional-profiles/:profileId/credentials/:credentialId */
  updateCredential = async (req: Request, res: Response): Promise<void> => {
    const { profileId } = req.params as ProfileIdParams;
    const { credentialId } = req.params as CredentialIdParams;
    const credential = await this.service.updateCredential(
      this.requireActor(req),
      profileId,
      credentialId,
      req.body as UpdateCredentialBody,
    );

    res.status(200).json({ success: true, data: { credential } });
  };

  /** DELETE /api/professional-profiles/:profileId/credentials/:credentialId */
  deleteCredential = async (req: Request, res: Response): Promise<void> => {
    const { profileId } = req.params as ProfileIdParams;
    const { credentialId } = req.params as CredentialIdParams;
    await this.service.deleteCredential(
      this.requireActor(req),
      profileId,
      credentialId,
    );

    res.status(200).json({ success: true, data: null });
  };

  // ── Private helpers ────────────────────────────────────────────────────────

  private requireActor(req: Request) {
    if (!req.auth) {
      throw new UnauthorizedError();
    }
    return req.auth;
  }
}
