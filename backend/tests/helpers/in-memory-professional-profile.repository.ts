import { randomUUID } from "node:crypto";
import { DuplicateProfessionalProfileError } from "../../src/repositories/professional-profile.errors.js";
import type {
  CreateCredentialInput,
  CreatePortfolioItemInput,
  CreateProfessionalProfileInput,
  CredentialType,
  PortfolioItemEntity,
  ProfessionalCredentialEntity,
  ProfessionalDirectoryItem,
  ProfessionalDirectoryQuery,
  ProfessionalDirectoryResult,
  ProfessionalProfileEntity,
  ProfessionalProfileRepository,
  ProfessionalSpecialtyEntity,
  ProfileVisibility,
  UpdateCredentialInput,
  UpdatePortfolioItemInput,
  UpdateProfessionalProfileInput,
} from "../../src/repositories/professional-profile.repository.js";

const DIRECTORY_SPECIALTY_LIMIT = 5;

function containsInsensitive(haystack: string | null, needle: string): boolean {
  return haystack !== null && haystack.toLowerCase().includes(needle.toLowerCase());
}

export class InMemoryProfessionalProfileRepository
  implements ProfessionalProfileRepository
{
  // Keyed by profileId
  private readonly profiles = new Map<string, ProfessionalProfileEntity>();
  // Secondary index: userId → profileId
  private readonly byUser = new Map<string, string>();
  // Portfolio items keyed by profileId
  private readonly portfolioItems = new Map<string, PortfolioItemEntity[]>();

  // ── Seed helpers ────────────────────────────────────────────────────────────

  /** Read-only snapshot of all stored profiles (for test assertions). */
  values(): ProfessionalProfileEntity[] {
    return [...this.profiles.values()];
  }

  /**
   * Directly insert a complete profile, bypassing business rules.
   * Useful in beforeEach to set up preconditions.
   */
  addProfile(
    userId: string,
    overrides: Partial<Omit<ProfessionalProfileEntity, "id" | "userId">> = {},
  ): ProfessionalProfileEntity {
    const now = new Date();
    const profile: ProfessionalProfileEntity = {
      id: randomUUID(),
      userId,
      displayName: overrides.displayName ?? "Test Professional",
      headline: overrides.headline ?? null,
      bio: overrides.bio ?? null,
      avatarUrl: overrides.avatarUrl ?? null,
      profession: overrides.profession ?? null,
      yearsExperience: overrides.yearsExperience ?? null,
      company: overrides.company ?? null,
      city: overrides.city ?? null,
      region: overrides.region ?? null,
      country: overrides.country ?? null,
      phone: overrides.phone ?? null,
      email: overrides.email ?? null,
      website: overrides.website ?? null,
      linkedinUrl: overrides.linkedinUrl ?? null,
      visibility: overrides.visibility ?? "PUBLIC",
      specialties: overrides.specialties ?? [],
      credentials: overrides.credentials ?? [],
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
    };
    this.profiles.set(profile.id, profile);
    this.byUser.set(userId, profile.id);
    return profile;
  }

  /**
   * Directly insert a portfolio item on a profile, bypassing business rules.
   * Useful in beforeEach to set up preconditions.
   */
  addItem(
    profileId: string,
    overrides: Partial<Omit<PortfolioItemEntity, "id" | "profileId">> = {},
  ): PortfolioItemEntity {
    if (!this.profiles.has(profileId)) {
      throw new Error(`Cannot add item: profile ${profileId} does not exist.`);
    }

    const now = new Date();
    const item: PortfolioItemEntity = {
      id: randomUUID(),
      profileId,
      title: overrides.title ?? "Test Portfolio Item",
      description: overrides.description ?? null,
      projectType: overrides.projectType ?? null,
      location: overrides.location ?? null,
      completionDate: overrides.completionDate ?? null,
      images: overrides.images ?? [],
      displayOrder: overrides.displayOrder ?? 0,
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
    };

    const items = this.portfolioItems.get(profileId) ?? [];
    items.push(item);
    this.portfolioItems.set(profileId, items);
    return item;
  }

  // ── Interface implementation ────────────────────────────────────────────────

  async searchPublished(
    query: ProfessionalDirectoryQuery,
  ): Promise<ProfessionalDirectoryResult> {
    // Security-critical: mirror the Prisma implementation by filtering on
    // visibility = PUBLIC before any other logic runs.
    let matches = [...this.profiles.values()].filter(
      (profile) => profile.visibility === "PUBLIC",
    );

    if (query.profession !== undefined) {
      matches = matches.filter((p) =>
        containsInsensitive(p.profession, query.profession!),
      );
    }
    if (query.city !== undefined) {
      matches = matches.filter((p) => containsInsensitive(p.city, query.city!));
    }
    if (query.specialty !== undefined) {
      matches = matches.filter((p) =>
        p.specialties.some((s) =>
          containsInsensitive(s.name, query.specialty!),
        ),
      );
    }
    if (query.search !== undefined) {
      const search = query.search;
      matches = matches.filter(
        (p) =>
          containsInsensitive(p.displayName, search) ||
          containsInsensitive(p.headline, search) ||
          containsInsensitive(p.profession, search) ||
          p.specialties.some((s) => containsInsensitive(s.name, search)),
      );
    }

    const byId = (a: ProfessionalProfileEntity, b: ProfessionalProfileEntity): number =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

    // Mirror professionalDirectoryOrderBy() in the Prisma repository exactly:
    // newest/oldest use fixed directions; experience/name honour sortOrder.
    switch (query.sortBy) {
      case "newest":
        matches.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || byId(a, b),
        );
        break;
      case "oldest":
        matches.sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || byId(a, b),
        );
        break;
      case "experience": {
        // Mirror Postgres ASC NULLS FIRST / DESC NULLS LAST semantics.
        const nullPenalty = (p: ProfessionalProfileEntity): number =>
          p.yearsExperience === null ? (query.sortOrder === "asc" ? -1 : 1) : 0;
        matches.sort((a, b) => {
          const penalty = nullPenalty(a) - nullPenalty(b);
          if (penalty !== 0) return penalty;
          const av = a.yearsExperience ?? 0;
          const bv = b.yearsExperience ?? 0;
          if (av !== bv) {
            return query.sortOrder === "desc" ? bv - av : av - bv;
          }
          return b.createdAt.getTime() - a.createdAt.getTime() || byId(a, b);
        });
        break;
      }
      case "name": {
        const byName = (x: string, y: string): number =>
          x.toLowerCase().localeCompare(y.toLowerCase());
        matches.sort(
          (a, b) =>
            (query.sortOrder === "desc"
              ? byName(b.displayName, a.displayName)
              : byName(a.displayName, b.displayName)) || byId(a, b),
        );
        break;
      }
    }

    const totalItems = matches.length;
    const totalPages = Math.ceil(totalItems / query.limit);
    const page = matches.slice(
      (query.page - 1) * query.limit,
      query.page * query.limit,
    );

    const professionals: ProfessionalDirectoryItem[] = page.map((profile) => ({
      id: profile.id,
      displayName: profile.displayName,
      headline: profile.headline,
      profession: profile.profession,
      yearsExperience: profile.yearsExperience,
      city: profile.city,
      region: profile.region,
      country: profile.country,
      avatarUrl: profile.avatarUrl,
      specialties: profile.specialties
        .map((s) => s.name)
        .sort((a, b) => a.localeCompare(b))
        .slice(0, DIRECTORY_SPECIALTY_LIMIT),
    }));

    return {
      professionals,
      totalItems,
      totalPages,
      currentPage: query.page,
      pageSize: query.limit,
      hasNextPage: query.page < totalPages,
      hasPreviousPage: query.page > 1,
    };
  }

  async findByUserId(
    userId: string,
  ): Promise<ProfessionalProfileEntity | null> {
    const profileId = this.byUser.get(userId);
    if (!profileId) return null;
    return this.profiles.get(profileId) ?? null;
  }

  async findById(
    profileId: string,
  ): Promise<ProfessionalProfileEntity | null> {
    return this.profiles.get(profileId) ?? null;
  }

  async create(
    input: CreateProfessionalProfileInput,
  ): Promise<ProfessionalProfileEntity> {
    if (this.byUser.has(input.userId)) {
      throw new DuplicateProfessionalProfileError();
    }

    const now = new Date();
    const profile: ProfessionalProfileEntity = {
      id: randomUUID(),
      userId: input.userId,
      displayName: input.displayName.trim(),
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
      specialties: [],
      credentials: [],
      createdAt: now,
      updatedAt: now,
    };

    this.profiles.set(profile.id, profile);
    this.byUser.set(input.userId, profile.id);
    return profile;
  }

  async update(
    profileId: string,
    input: UpdateProfessionalProfileInput,
  ): Promise<ProfessionalProfileEntity | null> {
    const profile = this.profiles.get(profileId);
    if (!profile) return null;

    if (input.displayName !== undefined)
      profile.displayName = input.displayName.trim();
    if (input.headline !== undefined) profile.headline = input.headline;
    if (input.bio !== undefined) profile.bio = input.bio;
    if (input.avatarUrl !== undefined) profile.avatarUrl = input.avatarUrl;
    if (input.profession !== undefined) profile.profession = input.profession;
    if (input.yearsExperience !== undefined)
      profile.yearsExperience = input.yearsExperience;
    if (input.company !== undefined) profile.company = input.company;
    if (input.city !== undefined) profile.city = input.city;
    if (input.region !== undefined) profile.region = input.region;
    if (input.country !== undefined) profile.country = input.country;
    if (input.phone !== undefined) profile.phone = input.phone;
    if (input.email !== undefined) profile.email = input.email;
    if (input.website !== undefined) profile.website = input.website;
    if (input.linkedinUrl !== undefined)
      profile.linkedinUrl = input.linkedinUrl;
    if (input.visibility !== undefined)
      profile.visibility = input.visibility as ProfileVisibility;

    profile.updatedAt = new Date();
    return profile;
  }

  async delete(profileId: string): Promise<boolean> {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;
    this.profiles.delete(profileId);
    this.byUser.delete(profile.userId);
    return true;
  }

  async replaceSpecialties(
    profileId: string,
    names: string[],
  ): Promise<ProfessionalProfileEntity | null> {
    const profile = this.profiles.get(profileId);
    if (!profile) return null;

    const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    const now = new Date();

    profile.specialties = unique.map(
      (name): ProfessionalSpecialtyEntity => ({
        id: randomUUID(),
        profileId,
        name,
        createdAt: now,
      }),
    );
    profile.updatedAt = now;
    return profile;
  }

  async addCredential(
    profileId: string,
    input: CreateCredentialInput,
  ): Promise<ProfessionalProfileEntity | null> {
    const profile = this.profiles.get(profileId);
    if (!profile) return null;

    const now = new Date();
    const credential: ProfessionalCredentialEntity = {
      id: randomUUID(),
      profileId,
      type: (input.type as CredentialType | undefined) ?? "EDUCATION",
      title: input.title.trim(),
      institution: input.institution ?? null,
      yearObtained: input.yearObtained ?? null,
      description: input.description ?? null,
      credentialUrl: input.credentialUrl ?? null,
      createdAt: now,
      updatedAt: now,
    };

    profile.credentials.push(credential);
    profile.updatedAt = now;
    return profile;
  }

  async updateCredential(
    credentialId: string,
    input: UpdateCredentialInput,
  ): Promise<ProfessionalCredentialEntity | null> {
    // Search all profiles for the credential.
    for (const profile of this.profiles.values()) {
      const credential = profile.credentials.find(
        (c) => c.id === credentialId,
      );
      if (!credential) continue;

      if (input.type !== undefined)
        credential.type = input.type as CredentialType;
      if (input.title !== undefined) credential.title = input.title.trim();
      if (input.institution !== undefined)
        credential.institution = input.institution;
      if (input.yearObtained !== undefined)
        credential.yearObtained = input.yearObtained;
      if (input.description !== undefined)
        credential.description = input.description;
      if (input.credentialUrl !== undefined)
        credential.credentialUrl = input.credentialUrl;

      credential.updatedAt = new Date();
      return credential;
    }
    return null;
  }

  async deleteCredential(credentialId: string): Promise<boolean> {
    for (const profile of this.profiles.values()) {
      const index = profile.credentials.findIndex(
        (c) => c.id === credentialId,
      );
      if (index === -1) continue;
      profile.credentials.splice(index, 1);
      profile.updatedAt = new Date();
      return true;
    }
    return false;
  }

  // ── Portfolio items ────────────────────────────────────────────────────────

  async countPortfolioItems(profileId: string): Promise<number> {
    return (this.portfolioItems.get(profileId) ?? []).length;
  }

  async findPortfolioItems(profileId: string): Promise<PortfolioItemEntity[]> {
    const items = [...(this.portfolioItems.get(profileId) ?? [])];

    // Mirror portfolioItemOrderBy() in the Prisma repository exactly:
    // displayOrder ascending, then newest first, then item ID.
    const byId = (a: PortfolioItemEntity, b: PortfolioItemEntity): number =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

    items.sort(
      (a, b) =>
        a.displayOrder - b.displayOrder ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        byId(a, b),
    );

    return items;
  }

  async createPortfolioItem(
    profileId: string,
    input: CreatePortfolioItemInput,
  ): Promise<PortfolioItemEntity> {
    if (!this.profiles.has(profileId)) {
      // Mirror the FK violation the database would raise.
      throw new Error(`Profile ${profileId} does not exist.`);
    }

    const now = new Date();
    const item: PortfolioItemEntity = {
      id: randomUUID(),
      profileId,
      title: input.title.trim(),
      description: input.description ?? null,
      projectType: input.projectType ?? null,
      location: input.location ?? null,
      completionDate: input.completionDate ?? null,
      images: input.images ? [...input.images] : [],
      displayOrder: input.displayOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    const items = this.portfolioItems.get(profileId) ?? [];
    items.push(item);
    this.portfolioItems.set(profileId, items);
    return item;
  }

  async updatePortfolioItem(
    profileId: string,
    itemId: string,
    input: UpdatePortfolioItemInput,
  ): Promise<PortfolioItemEntity | null> {
    const item = (this.portfolioItems.get(profileId) ?? []).find(
      (i) => i.id === itemId,
    );
    if (!item) return null;

    if (input.title !== undefined) item.title = input.title.trim();
    if (input.description !== undefined)
      item.description = input.description;
    if (input.projectType !== undefined)
      item.projectType = input.projectType;
    if (input.location !== undefined) item.location = input.location;
    if (input.completionDate !== undefined)
      item.completionDate = input.completionDate;
    if (input.images !== undefined) item.images = [...input.images];
    if (input.displayOrder !== undefined)
      item.displayOrder = input.displayOrder;

    item.updatedAt = new Date();
    return item;
  }

  async deletePortfolioItem(
    profileId: string,
    itemId: string,
  ): Promise<boolean> {
    const items = this.portfolioItems.get(profileId);
    if (!items) return false;

    const index = items.findIndex((i) => i.id === itemId);
    if (index === -1) return false;

    items.splice(index, 1);
    return true;
  }
}
