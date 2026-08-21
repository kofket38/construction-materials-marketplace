import { randomUUID } from "node:crypto";
import { DuplicateProfessionalProfileError } from "../../src/repositories/professional-profile.errors.js";
import type {
  CreateCredentialInput,
  CreateProfessionalProfileInput,
  CredentialType,
  ProfessionalCredentialEntity,
  ProfessionalProfileEntity,
  ProfessionalProfileRepository,
  ProfessionalSpecialtyEntity,
  ProfileVisibility,
  UpdateCredentialInput,
  UpdateProfessionalProfileInput,
} from "../../src/repositories/professional-profile.repository.js";

export class InMemoryProfessionalProfileRepository
  implements ProfessionalProfileRepository
{
  // Keyed by profileId
  private readonly profiles = new Map<string, ProfessionalProfileEntity>();
  // Secondary index: userId → profileId
  private readonly byUser = new Map<string, string>();

  // ── Seed helpers ────────────────────────────────────────────────────────────

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

  // ── Interface implementation ────────────────────────────────────────────────

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
}
