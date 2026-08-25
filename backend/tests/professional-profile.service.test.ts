import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DuplicateProfessionalProfileError,
} from "../src/repositories/professional-profile.errors.js";
import type {
  ProfessionalCredentialEntity,
  ProfessionalProfileEntity,
  ProfessionalProfileRepository,
  ProfessionalSpecialtyEntity,
} from "../src/repositories/professional-profile.repository.js";
import { ProfessionalProfileService } from "../src/services/professional-profile.service.js";
import {
  createCredentialBodySchema,
  createProfessionalProfileBodySchema,
  replaceSpecialtiesBodySchema,
  updateCredentialBodySchema,
  updateProfessionalProfileBodySchema,
} from "../src/validators/professional-profile.validators.js";
import type { AuthenticatedUser } from "../src/types/auth.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../src/utils/api-error.js";

// ── Fixed IDs ─────────────────────────────────────────────────────────────────

const userAId    = "00000000-0000-4000-8000-000000000001";
const userBId    = "00000000-0000-4000-8000-000000000002";
const profileId  = "00000000-0000-4000-8000-000000000010";
const credId     = "00000000-0000-4000-8000-000000000020";

const actorA: AuthenticatedUser = { userId: userAId, role: "CUSTOMER" };
const actorB: AuthenticatedUser = { userId: userBId, role: "CUSTOMER" };

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSpecialty(name: string): ProfessionalSpecialtyEntity {
  return {
    id: "00000000-0000-4000-8000-000000000030",
    profileId,
    name,
    createdAt: new Date(),
  };
}

function makeCredential(
  overrides: Partial<ProfessionalCredentialEntity> = {},
): ProfessionalCredentialEntity {
  return {
    id: credId,
    profileId,
    type: "EDUCATION",
    title: "BSc Civil Engineering",
    institution: "Addis Ababa University",
    yearObtained: 2015,
    description: null,
    credentialUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeProfile(
  overrides: Partial<ProfessionalProfileEntity> = {},
): ProfessionalProfileEntity {
  return {
    id: profileId,
    userId: userAId,
    displayName: "Abebe Bekele",
    headline: "Structural Engineer",
    bio: null,
    avatarUrl: null,
    profession: "Engineer",
    yearsExperience: 10,
    company: "Addis Structures",
    city: "Addis Ababa",
    region: null,
    country: "Ethiopia",
    phone: null,
    email: null,
    website: null,
    linkedinUrl: null,
    visibility: "PUBLIC",
    specialties: [],
    credentials: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Mock factory ──────────────────────────────────────────────────────────────

function createMockRepo(): ProfessionalProfileRepository {
  return {
    searchPublished: vi.fn(),
    findByUserId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    replaceSpecialties: vi.fn(),
    addCredential: vi.fn(),
    updateCredential: vi.fn(),
    deleteCredential: vi.fn(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ProfessionalProfileService", () => {
  let repo: ReturnType<typeof createMockRepo>;
  let service: ProfessionalProfileService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new ProfessionalProfileService(repo);
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates a profile and returns it", async () => {
      const profile = makeProfile();
      vi.mocked(repo.create).mockResolvedValue(profile);

      const result = await service.create(actorA, {
        displayName: "Abebe Bekele",
      });

      expect(result).toBe(profile);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: userAId,
          displayName: "Abebe Bekele",
          visibility: "PUBLIC",
        }),
      );
    });

    it("defaults visibility to PUBLIC when not supplied", async () => {
      vi.mocked(repo.create).mockResolvedValue(makeProfile());
      await service.create(actorA, { displayName: "X" });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: "PUBLIC" }),
      );
    });

    it("passes PRIVATE visibility through", async () => {
      vi.mocked(repo.create).mockResolvedValue(
        makeProfile({ visibility: "PRIVATE" }),
      );
      await service.create(actorA, {
        displayName: "X",
        visibility: "PRIVATE",
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: "PRIVATE" }),
      );
    });

    it("translates DuplicateProfessionalProfileError to ConflictError", async () => {
      vi.mocked(repo.create).mockRejectedValue(
        new DuplicateProfessionalProfileError(),
      );
      await expect(
        service.create(actorA, { displayName: "X" }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("re-throws unexpected repository errors", async () => {
      vi.mocked(repo.create).mockRejectedValue(new Error("DB down"));
      await expect(
        service.create(actorA, { displayName: "X" }),
      ).rejects.toThrow("DB down");
    });
  });

  // ── getOwnProfile ────────────────────────────────────────────────────────────

  describe("getOwnProfile", () => {
    it("returns the profile for the acting user", async () => {
      const profile = makeProfile();
      vi.mocked(repo.findByUserId).mockResolvedValue(profile);

      const result = await service.getOwnProfile(actorA);

      expect(result).toBe(profile);
      expect(repo.findByUserId).toHaveBeenCalledWith(userAId);
    });

    it("returns null when the user has no profile", async () => {
      vi.mocked(repo.findByUserId).mockResolvedValue(null);
      expect(await service.getOwnProfile(actorA)).toBeNull();
    });
  });

  // ── getById ──────────────────────────────────────────────────────────────────

  describe("getById", () => {
    it("returns the profile when found", async () => {
      const profile = makeProfile();
      vi.mocked(repo.findById).mockResolvedValue(profile);

      expect(await service.getById(profileId)).toBe(profile);
    });

    it("throws NotFoundError when the profile does not exist", async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.getById(profileId)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("updates and returns the profile when the actor owns it", async () => {
      const profile = makeProfile();
      const updated = makeProfile({ displayName: "Updated Name" });
      vi.mocked(repo.findById).mockResolvedValue(profile);
      vi.mocked(repo.update).mockResolvedValue(updated);

      const result = await service.update(actorA, profileId, {
        displayName: "Updated Name",
      });

      expect(result.displayName).toBe("Updated Name");
      expect(repo.update).toHaveBeenCalledWith(
        profileId,
        expect.objectContaining({ displayName: "Updated Name" }),
      );
    });

    it("throws ForbiddenError when actor does not own the profile", async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeProfile()); // owned by userAId
      await expect(
        service.update(actorB, profileId, { displayName: "Hack" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when the profile does not exist", async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(
        service.update(actorA, profileId, { displayName: "X" }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("only passes supplied fields to the repository", async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeProfile());
      vi.mocked(repo.update).mockResolvedValue(makeProfile({ bio: "New bio" }));

      await service.update(actorA, profileId, { bio: "New bio" });

      const updateArg = vi.mocked(repo.update).mock.calls[0]![1]!;
      expect(updateArg).toHaveProperty("bio", "New bio");
      expect(updateArg).not.toHaveProperty("displayName");
    });
  });

  // ── delete ───────────────────────────────────────────────────────────────────

  describe("delete", () => {
    it("deletes the profile when the actor owns it", async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeProfile());
      vi.mocked(repo.delete).mockResolvedValue(true);

      await expect(service.delete(actorA, profileId)).resolves.toBeUndefined();
      expect(repo.delete).toHaveBeenCalledWith(profileId);
    });

    it("throws ForbiddenError when actor does not own the profile", async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeProfile()); // owned by userAId
      await expect(
        service.delete(actorB, profileId),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when the profile does not exist", async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(
        service.delete(actorA, profileId),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  // ── replaceSpecialties ───────────────────────────────────────────────────────

  describe("replaceSpecialties", () => {
    it("replaces specialties and returns the updated profile", async () => {
      const updated = makeProfile({
        specialties: [makeSpecialty("Foundation Design")],
      });
      vi.mocked(repo.findById).mockResolvedValue(makeProfile());
      vi.mocked(repo.replaceSpecialties).mockResolvedValue(updated);

      const result = await service.replaceSpecialties(actorA, profileId, {
        names: ["Foundation Design"],
      });

      expect(result.specialties).toHaveLength(1);
      expect(repo.replaceSpecialties).toHaveBeenCalledWith(profileId, [
        "Foundation Design",
      ]);
    });

    it("throws ForbiddenError when actor does not own the profile", async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeProfile());
      await expect(
        service.replaceSpecialties(actorB, profileId, { names: ["X"] }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(repo.replaceSpecialties).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when the profile does not exist", async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(
        service.replaceSpecialties(actorA, profileId, { names: [] }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  // ── addCredential ────────────────────────────────────────────────────────────

  describe("addCredential", () => {
    it("adds a credential and returns the updated profile", async () => {
      const updated = makeProfile({ credentials: [makeCredential()] });
      vi.mocked(repo.findById).mockResolvedValue(makeProfile());
      vi.mocked(repo.addCredential).mockResolvedValue(updated);

      const result = await service.addCredential(actorA, profileId, {
        title: "BSc Civil Engineering",
        type: "EDUCATION",
        institution: "Addis Ababa University",
        yearObtained: 2015,
      });

      expect(result.credentials).toHaveLength(1);
      expect(repo.addCredential).toHaveBeenCalledWith(
        profileId,
        expect.objectContaining({ title: "BSc Civil Engineering" }),
      );
    });

    it("throws ForbiddenError when actor does not own the profile", async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeProfile());
      await expect(
        service.addCredential(actorB, profileId, { title: "X" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(repo.addCredential).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when the profile does not exist", async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(
        service.addCredential(actorA, profileId, { title: "X" }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  // ── updateCredential ─────────────────────────────────────────────────────────

  describe("updateCredential", () => {
    it("updates a credential the actor owns", async () => {
      const credential = makeCredential();
      const profile = makeProfile({ credentials: [credential] });
      const updatedCred = makeCredential({ title: "MSc Structural Engineering" });
      // First call: requireOwnership lookup; second call: profile re-read for credential membership check
      vi.mocked(repo.findById)
        .mockResolvedValueOnce(profile)
        .mockResolvedValueOnce(profile);
      vi.mocked(repo.updateCredential).mockResolvedValue(updatedCred);

      const result = await service.updateCredential(actorA, profileId, credId, {
        title: "MSc Structural Engineering",
      });

      expect(result.title).toBe("MSc Structural Engineering");
      expect(repo.updateCredential).toHaveBeenCalledWith(
        credId,
        expect.objectContaining({ title: "MSc Structural Engineering" }),
      );
    });

    it("throws ForbiddenError when actor does not own the profile", async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeProfile()); // owned by userAId
      await expect(
        service.updateCredential(actorB, profileId, credId, { title: "X" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(repo.updateCredential).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when the credential does not belong to the profile", async () => {
      const profile = makeProfile({ credentials: [] }); // no credentials
      vi.mocked(repo.findById)
        .mockResolvedValueOnce(profile) // requireOwnership
        .mockResolvedValueOnce(profile); // credential membership check
      await expect(
        service.updateCredential(actorA, profileId, credId, { title: "X" }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.updateCredential).not.toHaveBeenCalled();
    });
  });

  // ── deleteCredential ─────────────────────────────────────────────────────────

  describe("deleteCredential", () => {
    it("deletes a credential the actor owns", async () => {
      const credential = makeCredential();
      const profile = makeProfile({ credentials: [credential] });
      vi.mocked(repo.findById)
        .mockResolvedValueOnce(profile)
        .mockResolvedValueOnce(profile);
      vi.mocked(repo.deleteCredential).mockResolvedValue(true);

      await expect(
        service.deleteCredential(actorA, profileId, credId),
      ).resolves.toBeUndefined();
      expect(repo.deleteCredential).toHaveBeenCalledWith(credId);
    });

    it("throws ForbiddenError when actor does not own the profile", async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeProfile());
      await expect(
        service.deleteCredential(actorB, profileId, credId),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(repo.deleteCredential).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when the credential is not on the profile", async () => {
      const profile = makeProfile({ credentials: [] });
      vi.mocked(repo.findById)
        .mockResolvedValueOnce(profile)
        .mockResolvedValueOnce(profile);
      await expect(
        service.deleteCredential(actorA, profileId, credId),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.deleteCredential).not.toHaveBeenCalled();
    });
  });
});

// ── Validator schema tests ────────────────────────────────────────────────────

describe("Professional profile validators", () => {
  // ── createProfessionalProfileBodySchema ──────────────────────────────────────

  describe("createProfessionalProfileBodySchema", () => {
    it("accepts minimal valid input", () => {
      const result = createProfessionalProfileBodySchema.safeParse({
        displayName: "Abebe Bekele",
      });
      expect(result.success).toBe(true);
    });

    it("accepts all optional fields", () => {
      const result = createProfessionalProfileBodySchema.safeParse({
        displayName: "Abebe",
        headline: "Engineer",
        bio: "10 years experience",
        profession: "Civil Engineer",
        yearsExperience: 10,
        company: "Addis Structures",
        city: "Addis Ababa",
        region: "Addis Ababa Region",
        country: "Ethiopia",
        phone: "+251911000000",
        email: "abebe@example.com",
        website: "https://example.com",
        linkedinUrl: "https://linkedin.com/in/abebe",
        visibility: "PRIVATE",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty displayName", () => {
      const result = createProfessionalProfileBodySchema.safeParse({
        displayName: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects displayName over 200 characters", () => {
      const result = createProfessionalProfileBodySchema.safeParse({
        displayName: "a".repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative yearsExperience", () => {
      const result = createProfessionalProfileBodySchema.safeParse({
        displayName: "X",
        yearsExperience: -1,
      });
      expect(result.success).toBe(false);
    });

    it("rejects yearsExperience over 80", () => {
      const result = createProfessionalProfileBodySchema.safeParse({
        displayName: "X",
        yearsExperience: 81,
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid email", () => {
      const result = createProfessionalProfileBodySchema.safeParse({
        displayName: "X",
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid website URL", () => {
      const result = createProfessionalProfileBodySchema.safeParse({
        displayName: "X",
        website: "not-a-url",
      });
      expect(result.success).toBe(false);
    });

    it("rejects unknown fields (strict schema)", () => {
      const result = createProfessionalProfileBodySchema.safeParse({
        displayName: "X",
        unknownField: "bad",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid visibility value", () => {
      const result = createProfessionalProfileBodySchema.safeParse({
        displayName: "X",
        visibility: "FRIENDS_ONLY",
      });
      expect(result.success).toBe(false);
    });

    it("trims whitespace from displayName", () => {
      const result = createProfessionalProfileBodySchema.safeParse({
        displayName: "  Abebe  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.displayName).toBe("Abebe");
      }
    });
  });

  // ── updateProfessionalProfileBodySchema ──────────────────────────────────────

  describe("updateProfessionalProfileBodySchema", () => {
    it("accepts a single field update", () => {
      const result = updateProfessionalProfileBodySchema.safeParse({
        bio: "Updated bio.",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an empty object", () => {
      const result = updateProfessionalProfileBodySchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects unknown fields", () => {
      const result = updateProfessionalProfileBodySchema.safeParse({
        displayName: "X",
        rogue: "field",
      });
      expect(result.success).toBe(false);
    });
  });

  // ── replaceSpecialtiesBodySchema ─────────────────────────────────────────────

  describe("replaceSpecialtiesBodySchema", () => {
    it("accepts a valid names array", () => {
      const result = replaceSpecialtiesBodySchema.safeParse({
        names: ["Foundation Design", "Concrete Work"],
      });
      expect(result.success).toBe(true);
    });

    it("accepts an empty names array (clear all)", () => {
      const result = replaceSpecialtiesBodySchema.safeParse({ names: [] });
      expect(result.success).toBe(true);
    });

    it("rejects names array exceeding 50 entries", () => {
      const result = replaceSpecialtiesBodySchema.safeParse({
        names: Array.from({ length: 51 }, (_, i) => `Specialty ${i}`),
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty specialty name strings", () => {
      const result = replaceSpecialtiesBodySchema.safeParse({
        names: [""],
      });
      expect(result.success).toBe(false);
    });

    it("rejects specialty names over 150 characters", () => {
      const result = replaceSpecialtiesBodySchema.safeParse({
        names: ["a".repeat(151)],
      });
      expect(result.success).toBe(false);
    });
  });

  // ── createCredentialBodySchema ───────────────────────────────────────────────

  describe("createCredentialBodySchema", () => {
    it("accepts minimal valid input (title only)", () => {
      const result = createCredentialBodySchema.safeParse({
        title: "BSc Civil Engineering",
      });
      expect(result.success).toBe(true);
    });

    it("accepts all fields", () => {
      const result = createCredentialBodySchema.safeParse({
        type: "CERTIFICATION",
        title: "PMP Certification",
        institution: "PMI",
        yearObtained: 2020,
        description: "Project management professional.",
        credentialUrl: "https://pmi.org/cert/abc",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty title", () => {
      const result = createCredentialBodySchema.safeParse({ title: "" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid credential type", () => {
      const result = createCredentialBodySchema.safeParse({
        title: "X",
        type: "DEGREE",
      });
      expect(result.success).toBe(false);
    });

    it("rejects yearObtained in the future", () => {
      const result = createCredentialBodySchema.safeParse({
        title: "X",
        yearObtained: new Date().getFullYear() + 1,
      });
      expect(result.success).toBe(false);
    });

    it("rejects yearObtained before 1900", () => {
      const result = createCredentialBodySchema.safeParse({
        title: "X",
        yearObtained: 1899,
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid credentialUrl", () => {
      const result = createCredentialBodySchema.safeParse({
        title: "X",
        credentialUrl: "not-a-url",
      });
      expect(result.success).toBe(false);
    });
  });

  // ── updateCredentialBodySchema ───────────────────────────────────────────────

  describe("updateCredentialBodySchema", () => {
    it("accepts a single field update", () => {
      const result = updateCredentialBodySchema.safeParse({
        title: "Updated Title",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an empty object", () => {
      const result = updateCredentialBodySchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
