import {
  CredentialType as PrismaCredentialType,
  ProfileVisibility as PrismaProfileVisibility,
  Prisma,
  type PrismaClient,
} from "../prisma/generated/client.js";
import { DuplicateProfessionalProfileError } from "./professional-profile.errors.js";
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
} from "./professional-profile.repository.js";

// ── Prisma select shapes ──────────────────────────────────────────────────────

const specialtySelect = {
  id: true,
  profileId: true,
  name: true,
  createdAt: true,
} as const;

const credentialSelect = {
  id: true,
  profileId: true,
  type: true,
  title: true,
  institution: true,
  yearObtained: true,
  description: true,
  credentialUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

const profileInclude = {
  specialties: {
    select: specialtySelect,
    orderBy: { name: "asc" as const },
  },
  credentials: {
    select: credentialSelect,
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.ProfessionalProfileInclude;

type ProfileWithRelations = Prisma.ProfessionalProfileGetPayload<{
  include: typeof profileInclude;
}>;

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapSpecialty(
  row: Prisma.ProfessionalSpecialtyGetPayload<{
    select: typeof specialtySelect;
  }>,
): ProfessionalSpecialtyEntity {
  return {
    id: row.id,
    profileId: row.profileId,
    name: row.name,
    createdAt: row.createdAt,
  };
}

function mapCredential(
  row: Prisma.ProfessionalCredentialGetPayload<{
    select: typeof credentialSelect;
  }>,
): ProfessionalCredentialEntity {
  return {
    id: row.id,
    profileId: row.profileId,
    type: row.type as CredentialType,
    title: row.title,
    institution: row.institution,
    yearObtained: row.yearObtained,
    description: row.description,
    credentialUrl: row.credentialUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapProfile(row: ProfileWithRelations): ProfessionalProfileEntity {
  return {
    id: row.id,
    userId: row.userId,
    displayName: row.displayName,
    headline: row.headline,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    profession: row.profession,
    yearsExperience: row.yearsExperience,
    company: row.company,
    city: row.city,
    region: row.region,
    country: row.country,
    phone: row.phone,
    email: row.email,
    website: row.website,
    linkedinUrl: row.linkedinUrl,
    visibility: row.visibility as ProfileVisibility,
    specialties: row.specialties.map(mapSpecialty),
    credentials: row.credentials.map(mapCredential),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Error detection ───────────────────────────────────────────────────────────

function hasPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

// ── Repository implementation ─────────────────────────────────────────────────

export class PrismaProfessionalProfileRepository
  implements ProfessionalProfileRepository
{
  constructor(private readonly client: PrismaClient) {}

  async findByUserId(
    userId: string,
  ): Promise<ProfessionalProfileEntity | null> {
    const row = await this.client.professionalProfile.findUnique({
      where: { userId },
      include: profileInclude,
    });

    return row ? mapProfile(row) : null;
  }

  async findById(
    profileId: string,
  ): Promise<ProfessionalProfileEntity | null> {
    const row = await this.client.professionalProfile.findUnique({
      where: { id: profileId },
      include: profileInclude,
    });

    return row ? mapProfile(row) : null;
  }

  async create(
    input: CreateProfessionalProfileInput,
  ): Promise<ProfessionalProfileEntity> {
    try {
      const row = await this.client.professionalProfile.create({
        data: {
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
          visibility:
            (input.visibility as PrismaProfileVisibility | undefined) ??
            PrismaProfileVisibility.PUBLIC,
        },
        include: profileInclude,
      });

      return mapProfile(row);
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw new DuplicateProfessionalProfileError();
      }

      throw error;
    }
  }

  async update(
    profileId: string,
    input: UpdateProfessionalProfileInput,
  ): Promise<ProfessionalProfileEntity | null> {
    try {
      const row = await this.client.professionalProfile.update({
        where: { id: profileId },
        data: {
          ...(input.displayName !== undefined
            ? { displayName: input.displayName.trim() }
            : {}),
          ...(input.headline !== undefined
            ? { headline: input.headline }
            : {}),
          ...(input.bio !== undefined ? { bio: input.bio } : {}),
          ...(input.avatarUrl !== undefined
            ? { avatarUrl: input.avatarUrl }
            : {}),
          ...(input.profession !== undefined
            ? { profession: input.profession }
            : {}),
          ...(input.yearsExperience !== undefined
            ? { yearsExperience: input.yearsExperience }
            : {}),
          ...(input.company !== undefined
            ? { company: input.company }
            : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.region !== undefined
            ? { region: input.region }
            : {}),
          ...(input.country !== undefined
            ? { country: input.country }
            : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.website !== undefined
            ? { website: input.website }
            : {}),
          ...(input.linkedinUrl !== undefined
            ? { linkedinUrl: input.linkedinUrl }
            : {}),
          ...(input.visibility !== undefined
            ? {
                visibility:
                  input.visibility as PrismaProfileVisibility,
              }
            : {}),
        },
        include: profileInclude,
      });

      return mapProfile(row);
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        return null;
      }

      throw error;
    }
  }

  async delete(profileId: string): Promise<boolean> {
    try {
      await this.client.professionalProfile.delete({
        where: { id: profileId },
      });

      return true;
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        return false;
      }

      throw error;
    }
  }

  async replaceSpecialties(
    profileId: string,
    names: string[],
  ): Promise<ProfessionalProfileEntity | null> {
    // Check profile exists before starting the transaction.
    const exists = await this.client.professionalProfile.findUnique({
      where: { id: profileId },
      select: { id: true },
    });

    if (!exists) {
      return null;
    }

    // Deduplicate and normalise the incoming list.
    const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];

    return this.client.$transaction(async (tx) => {
      // Delete all current specialties then recreate — simpler and atomic.
      await tx.professionalSpecialty.deleteMany({
        where: { profileId },
      });

      if (unique.length > 0) {
        await tx.professionalSpecialty.createMany({
          data: unique.map((name) => ({ profileId, name })),
        });
      }

      const updated = await tx.professionalProfile.findUnique({
        where: { id: profileId },
        include: profileInclude,
      });

      // updated cannot be null here — we checked existence above and the
      // transaction would roll back on any error before this point.
      return updated ? mapProfile(updated) : null;
    }, { timeout: 30_000, maxWait: 10_000 });
  }

  async addCredential(
    profileId: string,
    input: CreateCredentialInput,
  ): Promise<ProfessionalProfileEntity | null> {
    const exists = await this.client.professionalProfile.findUnique({
      where: { id: profileId },
      select: { id: true },
    });

    if (!exists) {
      return null;
    }

    await this.client.professionalCredential.create({
      data: {
        profileId,
        type:
          (input.type as PrismaCredentialType | undefined) ??
          PrismaCredentialType.EDUCATION,
        title: input.title.trim(),
        institution: input.institution ?? null,
        yearObtained: input.yearObtained ?? null,
        description: input.description ?? null,
        credentialUrl: input.credentialUrl ?? null,
      },
    });

    const updated = await this.client.professionalProfile.findUnique({
      where: { id: profileId },
      include: profileInclude,
    });

    return updated ? mapProfile(updated) : null;
  }

  async updateCredential(
    credentialId: string,
    input: UpdateCredentialInput,
  ): Promise<ProfessionalCredentialEntity | null> {
    try {
      const row = await this.client.professionalCredential.update({
        where: { id: credentialId },
        data: {
          ...(input.type !== undefined
            ? { type: input.type as PrismaCredentialType }
            : {}),
          ...(input.title !== undefined
            ? { title: input.title.trim() }
            : {}),
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
        },
        select: credentialSelect,
      });

      return mapCredential(row);
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        return null;
      }

      throw error;
    }
  }

  async deleteCredential(credentialId: string): Promise<boolean> {
    try {
      await this.client.professionalCredential.delete({
        where: { id: credentialId },
      });

      return true;
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        return false;
      }

      throw error;
    }
  }
}
