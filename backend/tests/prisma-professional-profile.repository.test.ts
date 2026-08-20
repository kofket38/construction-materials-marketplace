import type { PrismaClient } from "../src/prisma/generated/client.js";
import {
  DuplicateProfessionalProfileError,
} from "../src/repositories/professional-profile.errors.js";
import { PrismaProfessionalProfileRepository } from "../src/repositories/prisma-professional-profile.repository.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Fixed IDs ─────────────────────────────────────────────────────────────────
const userId    = "00000000-0000-4000-8000-000000000001";
const profileId = "00000000-0000-4000-8000-000000000002";
const credId    = "00000000-0000-4000-8000-000000000003";
const specId    = "00000000-0000-4000-8000-000000000004";

// ── Helpers ───────────────────────────────────────────────────────────────────
function prismaError(code: string): Error & { code: string } {
  return Object.assign(new Error(`Prisma error ${code}`), { code });
}

function baseProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: profileId,
    userId,
    displayName: "Abebe Bekele",
    headline: "Senior Structural Engineer",
    bio: "10 years in construction.",
    avatarUrl: null,
    profession: "Structural Engineer",
    yearsExperience: 10,
    company: "Addis Structures PLC",
    city: "Addis Ababa",
    region: "Addis Ababa",
    country: "Ethiopia",
    phone: "+251911000000",
    email: "abebe@example.com",
    website: null,
    linkedinUrl: null,
    visibility: "PUBLIC",
    specialties: [],
    credentials: [],
    createdAt: new Date("2026-08-20T10:00:00.000Z"),
    updatedAt: new Date("2026-08-20T10:00:00.000Z"),
    ...overrides,
  };
}

function baseSpecialtyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: specId,
    profileId,
    name: "Foundation Design",
    createdAt: new Date("2026-08-20T10:00:00.000Z"),
    ...overrides,
  };
}

function baseCredentialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: credId,
    profileId,
    type: "EDUCATION",
    title: "BSc Civil Engineering",
    institution: "Addis Ababa University",
    yearObtained: 2014,
    description: null,
    credentialUrl: null,
    createdAt: new Date("2026-08-20T10:00:00.000Z"),
    updatedAt: new Date("2026-08-20T10:00:00.000Z"),
    ...overrides,
  };
}

// ── Mock factory ──────────────────────────────────────────────────────────────
function createMock() {
  const mock = {
    professionalProfile: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    professionalSpecialty: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    professionalCredential: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  // Default $transaction delegates to the callback with the mock itself.
  mock.$transaction.mockImplementation(
    async (
      operation: (tx: typeof mock) => unknown,
      _options?: unknown,
    ) => operation(mock),
  );

  return mock;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("PrismaProfessionalProfileRepository", () => {
  let mock: ReturnType<typeof createMock>;
  let repo: PrismaProfessionalProfileRepository;

  beforeEach(() => {
    mock = createMock();
    repo = new PrismaProfessionalProfileRepository(
      mock as unknown as PrismaClient,
    );
  });

  // ── findByUserId ────────────────────────────────────────────────────────────

  it("returns null when no profile exists for the user", async () => {
    mock.professionalProfile.findUnique.mockResolvedValue(null);
    expect(await repo.findByUserId(userId)).toBeNull();
    expect(mock.professionalProfile.findUnique).toHaveBeenCalledWith({
      where: { userId },
      include: expect.objectContaining({ specialties: expect.any(Object), credentials: expect.any(Object) }),
    });
  });

  it("returns the profile with specialties and credentials", async () => {
    const row = baseProfileRow({
      specialties: [baseSpecialtyRow()],
      credentials: [baseCredentialRow()],
    });
    mock.professionalProfile.findUnique.mockResolvedValue(row);

    const profile = await repo.findByUserId(userId);

    expect(profile).not.toBeNull();
    expect(profile!.displayName).toBe("Abebe Bekele");
    expect(profile!.specialties).toHaveLength(1);
    expect(profile!.specialties[0]!.name).toBe("Foundation Design");
    expect(profile!.credentials).toHaveLength(1);
    expect(profile!.credentials[0]!.title).toBe("BSc Civil Engineering");
  });

  // ── findById ────────────────────────────────────────────────────────────────

  it("finds a profile by its own ID", async () => {
    mock.professionalProfile.findUnique.mockResolvedValue(baseProfileRow());
    const profile = await repo.findById(profileId);
    expect(profile).not.toBeNull();
    expect(profile!.id).toBe(profileId);
    expect(mock.professionalProfile.findUnique).toHaveBeenCalledWith({
      where: { id: profileId },
      include: expect.any(Object),
    });
  });

  it("returns null when profile ID does not exist", async () => {
    mock.professionalProfile.findUnique.mockResolvedValue(null);
    expect(await repo.findById(profileId)).toBeNull();
  });

  // ── create ──────────────────────────────────────────────────────────────────

  it("creates a profile with required fields and PUBLIC visibility default", async () => {
    mock.professionalProfile.create.mockResolvedValue(baseProfileRow());

    const result = await repo.create({
      userId,
      displayName: "Abebe Bekele",
    });

    expect(result.userId).toBe(userId);
    expect(result.displayName).toBe("Abebe Bekele");
    expect(result.visibility).toBe("PUBLIC");
    expect(mock.professionalProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          displayName: "Abebe Bekele",
          visibility: "PUBLIC",
        }),
      }),
    );
  });

  it("creates a profile with all optional fields", async () => {
    const row = baseProfileRow({ visibility: "PRIVATE" });
    mock.professionalProfile.create.mockResolvedValue(row);

    const result = await repo.create({
      userId,
      displayName: "Abebe Bekele",
      profession: "Structural Engineer",
      yearsExperience: 10,
      city: "Addis Ababa",
      visibility: "PRIVATE",
    });

    expect(result.visibility).toBe("PRIVATE");
  });

  it("trims whitespace from displayName on create", async () => {
    mock.professionalProfile.create.mockResolvedValue(baseProfileRow());
    await repo.create({ userId, displayName: "  Abebe Bekele  " });
    expect(mock.professionalProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ displayName: "Abebe Bekele" }),
      }),
    );
  });

  it("throws DuplicateProfessionalProfileError when user already has a profile", async () => {
    mock.professionalProfile.create.mockRejectedValue(
      prismaError("P2002"),
    );
    await expect(
      repo.create({ userId, displayName: "Second Profile" }),
    ).rejects.toBeInstanceOf(DuplicateProfessionalProfileError);
  });

  // ── update ──────────────────────────────────────────────────────────────────

  it("updates only the supplied fields", async () => {
    const updated = baseProfileRow({ displayName: "Updated Name", bio: "New bio." });
    mock.professionalProfile.update.mockResolvedValue(updated);

    const result = await repo.update(profileId, {
      displayName: "Updated Name",
      bio: "New bio.",
    });

    expect(result).not.toBeNull();
    expect(result!.displayName).toBe("Updated Name");
    expect(result!.bio).toBe("New bio.");
    expect(mock.professionalProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: profileId },
        data: expect.objectContaining({
          displayName: "Updated Name",
          bio: "New bio.",
        }),
      }),
    );
  });

  it("allows setting optional fields to null via update", async () => {
    mock.professionalProfile.update.mockResolvedValue(
      baseProfileRow({ bio: null, phone: null }),
    );
    const result = await repo.update(profileId, { bio: null, phone: null });
    expect(result!.bio).toBeNull();
    expect(result!.phone).toBeNull();
  });

  it("returns null when updating a non-existent profile", async () => {
    mock.professionalProfile.update.mockRejectedValue(prismaError("P2025"));
    expect(await repo.update(profileId, { displayName: "X" })).toBeNull();
  });

  // ── delete ──────────────────────────────────────────────────────────────────

  it("deletes a profile and returns true", async () => {
    mock.professionalProfile.delete.mockResolvedValue({});
    expect(await repo.delete(profileId)).toBe(true);
    expect(mock.professionalProfile.delete).toHaveBeenCalledWith({
      where: { id: profileId },
    });
  });

  it("returns false when deleting a non-existent profile", async () => {
    mock.professionalProfile.delete.mockRejectedValue(prismaError("P2025"));
    expect(await repo.delete(profileId)).toBe(false);
  });

  // ── replaceSpecialties ──────────────────────────────────────────────────────

  it("replaces all specialties atomically", async () => {
    const updatedRow = baseProfileRow({
      specialties: [
        baseSpecialtyRow({ name: "Foundation Design" }),
        baseSpecialtyRow({ id: "00000000-0000-4000-8000-000000000099", name: "Concrete Work" }),
      ],
    });
    // First call is the existence check; second is the read inside the transaction.
    mock.professionalProfile.findUnique
      .mockResolvedValueOnce({ id: profileId })
      .mockResolvedValueOnce(updatedRow);
    mock.professionalSpecialty.deleteMany.mockResolvedValue({ count: 1 });
    mock.professionalSpecialty.createMany.mockResolvedValue({ count: 2 });

    const result = await repo.replaceSpecialties(profileId, [
      "Foundation Design",
      "Concrete Work",
    ]);

    expect(result).not.toBeNull();
    expect(result!.specialties).toHaveLength(2);
    expect(mock.professionalSpecialty.deleteMany).toHaveBeenCalledWith({
      where: { profileId },
    });
    expect(mock.professionalSpecialty.createMany).toHaveBeenCalledWith({
      data: [
        { profileId, name: "Foundation Design" },
        { profileId, name: "Concrete Work" },
      ],
    });
  });

  it("deduplicates specialty names before replacing", async () => {
    mock.professionalProfile.findUnique
      .mockResolvedValueOnce({ id: profileId })
      .mockResolvedValueOnce(baseProfileRow({
        specialties: [baseSpecialtyRow({ name: "Foundation Design" })],
      }));
    mock.professionalSpecialty.deleteMany.mockResolvedValue({ count: 0 });
    mock.professionalSpecialty.createMany.mockResolvedValue({ count: 1 });

    await repo.replaceSpecialties(profileId, [
      "Foundation Design",
      "Foundation Design",
      "  Foundation Design  ",
    ]);

    expect(mock.professionalSpecialty.createMany).toHaveBeenCalledWith({
      data: [{ profileId, name: "Foundation Design" }],
    });
  });

  it("clears all specialties when an empty list is supplied", async () => {
    mock.professionalProfile.findUnique
      .mockResolvedValueOnce({ id: profileId })
      .mockResolvedValueOnce(baseProfileRow({ specialties: [] }));
    mock.professionalSpecialty.deleteMany.mockResolvedValue({ count: 2 });

    const result = await repo.replaceSpecialties(profileId, []);

    expect(result!.specialties).toHaveLength(0);
    expect(mock.professionalSpecialty.createMany).not.toHaveBeenCalled();
  });

  it("returns null when replacing specialties for a non-existent profile", async () => {
    mock.professionalProfile.findUnique.mockResolvedValue(null);
    expect(
      await repo.replaceSpecialties(profileId, ["Foundation Design"]),
    ).toBeNull();
    expect(mock.professionalSpecialty.deleteMany).not.toHaveBeenCalled();
  });

  // ── addCredential ───────────────────────────────────────────────────────────

  it("adds a credential and returns the updated profile", async () => {
    const updatedRow = baseProfileRow({
      credentials: [baseCredentialRow()],
    });
    mock.professionalProfile.findUnique
      .mockResolvedValueOnce({ id: profileId })  // existence check
      .mockResolvedValueOnce(updatedRow);          // read after create
    mock.professionalCredential.create.mockResolvedValue(baseCredentialRow());

    const result = await repo.addCredential(profileId, {
      type: "EDUCATION",
      title: "BSc Civil Engineering",
      institution: "Addis Ababa University",
      yearObtained: 2014,
    });

    expect(result).not.toBeNull();
    expect(result!.credentials).toHaveLength(1);
    expect(mock.professionalCredential.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profileId,
          type: "EDUCATION",
          title: "BSc Civil Engineering",
        }),
      }),
    );
  });

  it("defaults credential type to EDUCATION when not supplied", async () => {
    mock.professionalProfile.findUnique
      .mockResolvedValueOnce({ id: profileId })
      .mockResolvedValueOnce(baseProfileRow({ credentials: [baseCredentialRow()] }));
    mock.professionalCredential.create.mockResolvedValue(baseCredentialRow());

    await repo.addCredential(profileId, { title: "Some Certificate" });

    expect(mock.professionalCredential.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "EDUCATION" }),
      }),
    );
  });

  it("returns null when adding a credential to a non-existent profile", async () => {
    mock.professionalProfile.findUnique.mockResolvedValue(null);
    expect(
      await repo.addCredential(profileId, { title: "BSc Civil Engineering" }),
    ).toBeNull();
    expect(mock.professionalCredential.create).not.toHaveBeenCalled();
  });

  // ── updateCredential ────────────────────────────────────────────────────────

  it("updates a credential's fields", async () => {
    const updated = baseCredentialRow({ title: "MSc Structural Engineering", yearObtained: 2017 });
    mock.professionalCredential.update.mockResolvedValue(updated);

    const result = await repo.updateCredential(credId, {
      title: "MSc Structural Engineering",
      yearObtained: 2017,
    });

    expect(result).not.toBeNull();
    expect(result!.title).toBe("MSc Structural Engineering");
    expect(result!.yearObtained).toBe(2017);
    expect(mock.professionalCredential.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: credId },
        data: expect.objectContaining({
          title: "MSc Structural Engineering",
          yearObtained: 2017,
        }),
      }),
    );
  });

  it("allows clearing optional credential fields to null", async () => {
    mock.professionalCredential.update.mockResolvedValue(
      baseCredentialRow({ institution: null, yearObtained: null }),
    );
    const result = await repo.updateCredential(credId, {
      institution: null,
      yearObtained: null,
    });
    expect(result!.institution).toBeNull();
    expect(result!.yearObtained).toBeNull();
  });

  it("returns null when updating a non-existent credential", async () => {
    mock.professionalCredential.update.mockRejectedValue(
      prismaError("P2025"),
    );
    expect(
      await repo.updateCredential(credId, { title: "New" }),
    ).toBeNull();
  });

  // ── deleteCredential ────────────────────────────────────────────────────────

  it("deletes a credential and returns true", async () => {
    mock.professionalCredential.delete.mockResolvedValue({});
    expect(await repo.deleteCredential(credId)).toBe(true);
    expect(mock.professionalCredential.delete).toHaveBeenCalledWith({
      where: { id: credId },
    });
  });

  it("returns false when deleting a non-existent credential", async () => {
    mock.professionalCredential.delete.mockRejectedValue(
      prismaError("P2025"),
    );
    expect(await repo.deleteCredential(credId)).toBe(false);
  });

  // ── ownership / cascade verification ────────────────────────────────────────

  it("profile entity exposes the owning userId for authorization checks", async () => {
    mock.professionalProfile.findUnique.mockResolvedValue(
      baseProfileRow({ userId }),
    );
    const profile = await repo.findByUserId(userId);
    expect(profile!.userId).toBe(userId);
  });

  it("credential entity exposes the parent profileId", async () => {
    mock.professionalProfile.findUnique.mockResolvedValue(
      baseProfileRow({ credentials: [baseCredentialRow({ profileId })] }),
    );
    const profile = await repo.findById(profileId);
    expect(profile!.credentials[0]!.profileId).toBe(profileId);
  });

  it("specialty entity exposes the parent profileId", async () => {
    mock.professionalProfile.findUnique.mockResolvedValue(
      baseProfileRow({ specialties: [baseSpecialtyRow({ profileId })] }),
    );
    const profile = await repo.findById(profileId);
    expect(profile!.specialties[0]!.profileId).toBe(profileId);
  });
});
