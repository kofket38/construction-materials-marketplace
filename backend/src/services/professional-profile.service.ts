import type { AuthenticatedUser } from "../types/auth.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/api-error.js";
import { DuplicateProfessionalProfileError } from "../repositories/professional-profile.errors.js";
import type {
  PortfolioItemEntity,
  ProfessionalCredentialEntity,
  ProfessionalDirectoryResult,
  ProfessionalProfileEntity,
  ProfessionalProfileRepository,
} from "../repositories/professional-profile.repository.js";
import type {
  CreateCredentialBody,
  CreatePortfolioItemBody,
  CreateProfessionalProfileBody,
  ListProfessionalProfilesQueryParams,
  ReplaceSpecialtiesBody,
  UpdateCredentialBody,
  UpdatePortfolioItemBody,
  UpdateProfessionalProfileBody,
} from "../validators/professional-profile.validators.js";

/** Hard cap on portfolio items per profile (mirrors the specialty cap). */
const MAX_PORTFOLIO_ITEMS_PER_PROFILE = 50;

function defaultDirectorySortOrder(
  sortBy: "newest" | "oldest" | "experience" | "name",
): "asc" | "desc" {
  return sortBy === "newest" ? "desc" : "asc";
}

export class ProfessionalProfileService {
  constructor(
    private readonly profiles: ProfessionalProfileRepository,
  ) {}

  // ── Public directory ─────────────────────────────────────────────────────

  listPublished(
    input: ListProfessionalProfilesQueryParams,
  ): Promise<ProfessionalDirectoryResult> {
    const sortBy = input.sortBy ?? "newest";

    return this.profiles.searchPublished({
      page: Number(input.page ?? "1"),
      limit: Number(input.limit ?? "20"),
      sortBy,
      sortOrder: input.sortOrder ?? defaultDirectorySortOrder(sortBy),
      ...(input.search !== undefined ? { search: input.search.trim() } : {}),
      ...(input.profession !== undefined
        ? { profession: input.profession }
        : {}),
      ...(input.specialty !== undefined
        ? { specialty: input.specialty }
        : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
    });
  }

  // ── Profile CRUD ──────────────────────────────────────────────────────────

  async create(
    actor: AuthenticatedUser,
    input: CreateProfessionalProfileBody,
  ): Promise<ProfessionalProfileEntity> {
    try {
      return await this.profiles.create({
        userId: actor.userId,
        displayName: input.displayName,
        headline: input.headline ?? null,
        bio: input.bio ?? null,
        avatarUrl: input.avatarUrl ?? null,
        profession: input.profession ?? null,
        yearsExperience: input.yearsExperience ?? null,
        company: input.company ?? null,
        city: input.city ?? null,
        region: input.region ?? null,
        country: input.country ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        website: input.website ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        visibility: input.visibility ?? "PUBLIC",
      });
    } catch (error) {
      if (error instanceof DuplicateProfessionalProfileError) {
        throw new ConflictError(
          "A professional profile already exists for your account.",
        );
      }
      throw error;
    }
  }

  async getOwnProfile(
    actor: AuthenticatedUser,
  ): Promise<ProfessionalProfileEntity | null> {
    return this.profiles.findByUserId(actor.userId);
  }

  async getById(
    profileId: string,
  ): Promise<ProfessionalProfileEntity> {
    const profile = await this.profiles.findById(profileId);
    if (!profile) {
      throw new NotFoundError("Professional profile not found.");
    }
    return profile;
  }

  async update(
    actor: AuthenticatedUser,
    profileId: string,
    input: UpdateProfessionalProfileBody,
  ): Promise<ProfessionalProfileEntity> {
    await this.requireOwnership(actor, profileId);

    const updated = await this.profiles.update(profileId, {
      ...(input.displayName !== undefined
        ? { displayName: input.displayName }
        : {}),
      ...(input.headline !== undefined ? { headline: input.headline } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.profession !== undefined
        ? { profession: input.profession }
        : {}),
      ...(input.yearsExperience !== undefined
        ? { yearsExperience: input.yearsExperience }
        : {}),
      ...(input.company !== undefined ? { company: input.company } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.region !== undefined ? { region: input.region } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.website !== undefined ? { website: input.website } : {}),
      ...(input.linkedinUrl !== undefined
        ? { linkedinUrl: input.linkedinUrl }
        : {}),
      ...(input.visibility !== undefined
        ? { visibility: input.visibility }
        : {}),
    });

    if (!updated) {
      throw new NotFoundError("Professional profile not found.");
    }

    return updated;
  }

  async delete(
    actor: AuthenticatedUser,
    profileId: string,
  ): Promise<void> {
    await this.requireOwnership(actor, profileId);

    const deleted = await this.profiles.delete(profileId);
    if (!deleted) {
      throw new NotFoundError("Professional profile not found.");
    }
  }

  // ── Specialties ───────────────────────────────────────────────────────────

  async replaceSpecialties(
    actor: AuthenticatedUser,
    profileId: string,
    input: ReplaceSpecialtiesBody,
  ): Promise<ProfessionalProfileEntity> {
    await this.requireOwnership(actor, profileId);

    const updated = await this.profiles.replaceSpecialties(
      profileId,
      input.names,
    );

    if (!updated) {
      throw new NotFoundError("Professional profile not found.");
    }

    return updated;
  }

  // ── Credentials ───────────────────────────────────────────────────────────

  async addCredential(
    actor: AuthenticatedUser,
    profileId: string,
    input: CreateCredentialBody,
  ): Promise<ProfessionalProfileEntity> {
    await this.requireOwnership(actor, profileId);

    const updated = await this.profiles.addCredential(profileId, {
      ...(input.type !== undefined ? { type: input.type } : {}),
      title: input.title,
      institution: input.institution ?? null,
      yearObtained: input.yearObtained ?? null,
      description: input.description ?? null,
      credentialUrl: input.credentialUrl ?? null,
    });

    if (!updated) {
      throw new NotFoundError("Professional profile not found.");
    }

    return updated;
  }

  async updateCredential(
    actor: AuthenticatedUser,
    profileId: string,
    credentialId: string,
    input: UpdateCredentialBody,
  ): Promise<ProfessionalCredentialEntity> {
    await this.requireOwnership(actor, profileId);

    // Verify the credential belongs to this profile before updating.
    const profile = await this.profiles.findById(profileId);
    if (!profile) {
      throw new NotFoundError("Professional profile not found.");
    }

    const belongsToProfile = profile.credentials.some(
      (c) => c.id === credentialId,
    );
    if (!belongsToProfile) {
      throw new NotFoundError("Credential not found.");
    }

    const updated = await this.profiles.updateCredential(credentialId, {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.institution !== undefined
        ? { institution: input.institution }
        : {}),
      ...(input.yearObtained !== undefined
        ? { yearObtained: input.yearObtained }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.credentialUrl !== undefined
        ? { credentialUrl: input.credentialUrl }
        : {}),
    });

    if (!updated) {
      throw new NotFoundError("Credential not found.");
    }

    return updated;
  }

  async deleteCredential(
    actor: AuthenticatedUser,
    profileId: string,
    credentialId: string,
  ): Promise<void> {
    await this.requireOwnership(actor, profileId);

    // Verify the credential belongs to this profile before deleting.
    const profile = await this.profiles.findById(profileId);
    if (!profile) {
      throw new NotFoundError("Professional profile not found.");
    }

    const belongsToProfile = profile.credentials.some(
      (c) => c.id === credentialId,
    );
    if (!belongsToProfile) {
      throw new NotFoundError("Credential not found.");
    }

    const deleted = await this.profiles.deleteCredential(credentialId);
    if (!deleted) {
      throw new NotFoundError("Credential not found.");
    }
  }

  // ── Authorization helper ──────────────────────────────────────────────────

  /**
   * Resolves the profile and throws ForbiddenError if the actor does not own
   * it, or NotFoundError if the profile does not exist.
   * Returns the profile so callers can reuse it without a second lookup.
   */
  private async requireOwnership(
    actor: AuthenticatedUser,
    profileId: string,
  ): Promise<ProfessionalProfileEntity> {
    const profile = await this.profiles.findById(profileId);

    if (!profile) {
      throw new NotFoundError("Professional profile not found.");
    }

    if (profile.userId !== actor.userId) {
      throw new ForbiddenError(
        "You do not have permission to modify this profile.",
      );
    }

    return profile;
  }

  // ── Portfolio items ───────────────────────────────────────────────────────

  /**
   * Lists a profile's portfolio in display order.
   * PUBLIC profiles are readable by anyone (including anonymous visitors);
   * PRIVATE profiles are readable only by their owner, who receives all
   * other errors as usual.
   */
  async listPortfolio(
    actor: AuthenticatedUser | null,
    profileId: string,
  ): Promise<PortfolioItemEntity[]> {
    const profile = await this.profiles.findById(profileId);

    if (!profile) {
      throw new NotFoundError("Professional profile not found.");
    }

    if (
      actor === null ||
      actor.userId !== profile.userId
    ) {
      if (profile.visibility !== "PUBLIC") {
        throw new ForbiddenError("This profile is private.");
      }
    }

    return this.profiles.findPortfolioItems(profileId);
  }

  async addPortfolioItem(
    actor: AuthenticatedUser,
    profileId: string,
    input: CreatePortfolioItemBody,
  ): Promise<PortfolioItemEntity> {
    await this.requireOwnership(actor, profileId);

    const count = await this.profiles.countPortfolioItems(profileId);
    if (count >= MAX_PORTFOLIO_ITEMS_PER_PROFILE) {
      throw new BadRequestError(
        `A profile may have at most ${MAX_PORTFOLIO_ITEMS_PER_PROFILE} portfolio items.`,
      );
    }

    return this.profiles.createPortfolioItem(profileId, {
      title: input.title,
      description: input.description ?? null,
      projectType: input.projectType ?? null,
      location: input.location ?? null,
      completionDate: input.completionDate ?? null,
      images: input.images ?? [],
      displayOrder: input.displayOrder ?? 0,
    });
  }

  async updatePortfolioItem(
    actor: AuthenticatedUser,
    profileId: string,
    itemId: string,
    input: UpdatePortfolioItemBody,
  ): Promise<PortfolioItemEntity> {
    await this.requireOwnership(actor, profileId);

    // Scoped to this profile — an item belonging to another profile is
    // reported as missing rather than modified.
    const updated = await this.profiles.updatePortfolioItem(
      profileId,
      itemId,
      {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.projectType !== undefined
          ? { projectType: input.projectType }
          : {}),
        ...(input.location !== undefined
          ? { location: input.location }
          : {}),
        ...(input.completionDate !== undefined
          ? { completionDate: input.completionDate }
          : {}),
        ...(input.images !== undefined ? { images: input.images } : {}),
        ...(input.displayOrder !== undefined
          ? { displayOrder: input.displayOrder }
          : {}),
      },
    );

    if (!updated) {
      throw new NotFoundError("Portfolio item not found.");
    }

    return updated;
  }

  async deletePortfolioItem(
    actor: AuthenticatedUser,
    profileId: string,
    itemId: string,
  ): Promise<void> {
    await this.requireOwnership(actor, profileId);

    // Scoped to this profile for the same ownership reason as update.
    const deleted = await this.profiles.deletePortfolioItem(
      profileId,
      itemId,
    );

    if (!deleted) {
      throw new NotFoundError("Portfolio item not found.");
    }
  }
}
