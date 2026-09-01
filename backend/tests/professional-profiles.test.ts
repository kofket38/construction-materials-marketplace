import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemoryProfessionalProfileRepository } from "./helpers/in-memory-professional-profile.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

// ── Fixed IDs ──────────────────────────────────────────────────────────────────

const userAId = randomUUID();
const userBId = randomUUID();

// ── Valid request bodies ───────────────────────────────────────────────────────

const validCreateBody = {
  displayName: "Abebe Bekele",
  headline: "Senior Structural Engineer",
  profession: "Structural Engineer",
  yearsExperience: 10,
  company: "Addis Structures PLC",
  city: "Addis Ababa",
  country: "Ethiopia",
};

const validCredentialBody = {
  type: "EDUCATION",
  title: "BSc Civil Engineering",
  institution: "Addis Ababa University",
  yearObtained: 2014,
};

// ── Test suite ─────────────────────────────────────────────────────────────────

describe("Professional Profiles API", () => {
  const tokenService = new JwtTokenService();
  let profiles: InMemoryProfessionalProfileRepository;
  let users: InMemoryUserRepository;
  let app: ReturnType<typeof createApp>;
  let tokenA: string;
  let tokenB: string;

  beforeEach(() => {
    profiles = new InMemoryProfessionalProfileRepository();
    users = new InMemoryUserRepository();

    // M1: professional profile mutations require the real PROFESSIONAL role.
    users.addUser({ id: userAId, role: "PROFESSIONAL" });
    users.addUser({ id: userBId, role: "PROFESSIONAL" });

    app = createApp({
      professionalProfileRepository: profiles,
      userRepository: users,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    tokenA = tokenService.createAccessToken({ userId: userAId, role: "PROFESSIONAL" });
    tokenB = tokenService.createAccessToken({ userId: userBId, role: "PROFESSIONAL" });
  });

  // ── Role authorization (M1) ──────────────────────────────────────────────────

  describe("role authorization", () => {
    const customerId = randomUUID();
    const sellerId = randomUUID();
    const adminId = randomUUID();
    let customerToken: string;
    let sellerToken: string;
    let adminToken: string;

    beforeEach(() => {
      users.addUser({ id: customerId, role: "CUSTOMER" });
      users.addUser({ id: sellerId, role: "SELLER" });
      users.addUser({ id: adminId, role: "ADMIN" });

      customerToken = tokenService.createAccessToken({ userId: customerId, role: "CUSTOMER" });
      sellerToken = tokenService.createAccessToken({ userId: sellerId, role: "SELLER" });
      adminToken = tokenService.createAccessToken({ userId: adminId, role: "ADMIN" });
    });

    it("rejects CUSTOMER profile creation with 403", async () => {
      await post("/api/professional-profiles", customerToken, validCreateBody)
        .expect(403);
    });

    it("rejects SELLER profile creation with 403", async () => {
      await post("/api/professional-profiles", sellerToken, validCreateBody)
        .expect(403);
    });

    it("rejects ADMIN profile creation with 403", async () => {
      await post("/api/professional-profiles", adminToken, validCreateBody)
        .expect(403);
    });

    it("rejects CUSTOMER portfolio creation on an existing profile with 403", async () => {
      const profile = profiles.addProfile(userAId);

      await post(
        `/api/professional-profiles/${profile.id}/portfolio`,
        customerToken,
        { title: "Bridge retrofit" },
      ).expect(403);
    });

    it("rejects SELLER profile update with 403", async () => {
      const profile = profiles.addProfile(userAId);

      await patch(`/api/professional-profiles/${profile.id}`, sellerToken, {
        headline: "Hijacked headline",
      }).expect(403);
    });

    it("rejects ADMIN profile deletion with 403", async () => {
      const profile = profiles.addProfile(userAId);

      await del(`/api/professional-profiles/${profile.id}`, adminToken).expect(
        403,
      );
    });

    // M1 Task 4: own-profile reads are PROFESSIONAL-only. Other roles cannot
    // own a professional profile, so they receive 403 rather than a null body.
    it("rejects CUSTOMER own-profile reads with 403", async () => {
      await get("/api/professional-profiles/me", customerToken).expect(403);
    });

    it("rejects SELLER own-profile reads with 403", async () => {
      await get("/api/professional-profiles/me", sellerToken).expect(403);
    });

    it("rejects ADMIN own-profile reads with 403", async () => {
      await get("/api/professional-profiles/me", adminToken).expect(403);
    });

    it("keeps public directory access anonymous and unchanged", async () => {
      profiles.addProfile(userAId, { displayName: "Public Pro" });

      await request(app).get("/api/professional-profiles").expect(200);
    });
  });

  // ── POST /api/professional-profiles ──────────────────────────────────────────

  describe("POST /api/professional-profiles", () => {
    it("creates a profile for the authenticated user and returns 201", async () => {
      const res = await post("/api/professional-profiles", tokenA, validCreateBody)
        .expect(201);

      expect(res.body.success).toBe(true);
      const p = res.body.data.profile;
      expect(p.userId).toBe(userAId);
      expect(p.displayName).toBe("Abebe Bekele");
      expect(p.profession).toBe("Structural Engineer");
      expect(p.visibility).toBe("PUBLIC");
      expect(p.specialties).toEqual([]);
      expect(p.credentials).toEqual([]);
    });

    it("returns 401 when unauthenticated", async () => {
      await request(app)
        .post("/api/professional-profiles")
        .send(validCreateBody)
        .expect(401);
    });

    it("returns 409 when the user already has a profile", async () => {
      profiles.addProfile(userAId);

      const res = await post("/api/professional-profiles", tokenA, validCreateBody)
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it("returns 400 when displayName is missing", async () => {
      const res = await post("/api/professional-profiles", tokenA, {
        profession: "Engineer",
      }).expect(400);

      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "body.displayName" }),
        ]),
      );
    });

    it("returns 400 for an invalid email", async () => {
      const res = await post("/api/professional-profiles", tokenA, {
        ...validCreateBody,
        email: "not-an-email",
      }).expect(400);

      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "body.email" }),
        ]),
      );
    });

    it("returns 400 for unknown fields", async () => {
      await post("/api/professional-profiles", tokenA, {
        ...validCreateBody,
        rogue: "field",
      }).expect(400);
    });

    it("creates a PRIVATE profile when visibility is PRIVATE", async () => {
      const res = await post("/api/professional-profiles", tokenA, {
        ...validCreateBody,
        visibility: "PRIVATE",
      }).expect(201);

      expect(res.body.data.profile.visibility).toBe("PRIVATE");
    });
  });

  // ── GET /api/professional-profiles/me ────────────────────────────────────────

  describe("GET /api/professional-profiles/me", () => {
    it("returns null when the user has no profile yet", async () => {
      const res = await get("/api/professional-profiles/me", tokenA).expect(200);
      expect(res.body.data.profile).toBeNull();
    });

    it("returns the authenticated user's own profile", async () => {
      profiles.addProfile(userAId, { displayName: "User A Professional" });

      const res = await get("/api/professional-profiles/me", tokenA).expect(200);
      expect(res.body.data.profile.displayName).toBe("User A Professional");
      expect(res.body.data.profile.userId).toBe(userAId);
    });

    it("returns 401 when unauthenticated", async () => {
      await request(app).get("/api/professional-profiles/me").expect(401);
    });

    it("does not return user B's profile to user A", async () => {
      profiles.addProfile(userAId, { displayName: "User A" });
      profiles.addProfile(userBId, { displayName: "User B" });

      const res = await get("/api/professional-profiles/me", tokenA).expect(200);
      expect(res.body.data.profile.displayName).toBe("User A");
    });
  });

  // ── GET /api/professional-profiles/:profileId ─────────────────────────────────

  describe("GET /api/professional-profiles/:profileId", () => {
    it("returns a PUBLIC profile to an unauthenticated caller", async () => {
      const profile = profiles.addProfile(userAId, {
        displayName: "Public Professional",
        visibility: "PUBLIC",
      });

      const res = await request(app)
        .get(`/api/professional-profiles/${profile.id}`)
        .expect(200);

      expect(res.body.data.profile.displayName).toBe("Public Professional");
    });

    it("returns a PUBLIC profile to a different authenticated user", async () => {
      const profile = profiles.addProfile(userAId, { visibility: "PUBLIC" });

      const res = await get(
        `/api/professional-profiles/${profile.id}`,
        tokenB,
      ).expect(200);

      expect(res.body.data.profile.id).toBe(profile.id);
    });

    it("returns a PRIVATE profile to its owner", async () => {
      const profile = profiles.addProfile(userAId, { visibility: "PRIVATE" });

      const res = await get(
        `/api/professional-profiles/${profile.id}`,
        tokenA,
      ).expect(200);

      expect(res.body.data.profile.visibility).toBe("PRIVATE");
    });

    it("returns 403 for a PRIVATE profile when requested by another user", async () => {
      const profile = profiles.addProfile(userAId, { visibility: "PRIVATE" });

      await get(`/api/professional-profiles/${profile.id}`, tokenB).expect(403);
    });

    it("returns 403 for a PRIVATE profile when unauthenticated", async () => {
      const profile = profiles.addProfile(userAId, { visibility: "PRIVATE" });

      await request(app)
        .get(`/api/professional-profiles/${profile.id}`)
        .expect(403);
    });

    it("returns 404 when the profile does not exist", async () => {
      await request(app)
        .get(`/api/professional-profiles/${randomUUID()}`)
        .expect(404);
    });

    it("returns 400 for a non-UUID profile ID", async () => {
      await request(app)
        .get("/api/professional-profiles/not-a-uuid")
        .expect(400);
    });
  });

  // ── PATCH /api/professional-profiles/:profileId ───────────────────────────────

  describe("PATCH /api/professional-profiles/:profileId", () => {
    it("updates the owner's profile and returns 200", async () => {
      const profile = profiles.addProfile(userAId);

      const res = await patch(
        `/api/professional-profiles/${profile.id}`,
        tokenA,
        { displayName: "Updated Name", city: "Dire Dawa" },
      ).expect(200);

      expect(res.body.data.profile.displayName).toBe("Updated Name");
      expect(res.body.data.profile.city).toBe("Dire Dawa");
    });

    it("returns 401 when unauthenticated", async () => {
      const profile = profiles.addProfile(userAId);
      await request(app)
        .patch(`/api/professional-profiles/${profile.id}`)
        .send({ displayName: "X" })
        .expect(401);
    });

    it("returns 403 when a different user tries to update", async () => {
      const profile = profiles.addProfile(userAId);

      await patch(
        `/api/professional-profiles/${profile.id}`,
        tokenB,
        { displayName: "Hack" },
      ).expect(403);
    });

    it("returns 404 when the profile does not exist", async () => {
      await patch(
        `/api/professional-profiles/${randomUUID()}`,
        tokenA,
        { displayName: "X" },
      ).expect(404);
    });

    it("returns 400 for an empty update body", async () => {
      const profile = profiles.addProfile(userAId);
      await patch(`/api/professional-profiles/${profile.id}`, tokenA, {}).expect(400);
    });

    it("returns 400 for unknown fields", async () => {
      const profile = profiles.addProfile(userAId);
      await patch(`/api/professional-profiles/${profile.id}`, tokenA, {
        displayName: "OK",
        hack: "field",
      }).expect(400);
    });
  });

  // ── DELETE /api/professional-profiles/:profileId ──────────────────────────────

  describe("DELETE /api/professional-profiles/:profileId", () => {
    it("deletes the owner's profile and returns 200", async () => {
      const profile = profiles.addProfile(userAId);

      const res = await del(
        `/api/professional-profiles/${profile.id}`,
        tokenA,
      ).expect(200);

      expect(res.body.success).toBe(true);
      // Profile is gone.
      expect(await profiles.findById(profile.id)).toBeNull();
    });

    it("returns 401 when unauthenticated", async () => {
      const profile = profiles.addProfile(userAId);
      await request(app)
        .delete(`/api/professional-profiles/${profile.id}`)
        .expect(401);
    });

    it("returns 403 when a different user tries to delete", async () => {
      const profile = profiles.addProfile(userAId);
      await del(`/api/professional-profiles/${profile.id}`, tokenB).expect(403);
    });

    it("returns 404 when the profile does not exist", async () => {
      await del(`/api/professional-profiles/${randomUUID()}`, tokenA).expect(404);
    });
  });

  // ── PUT /api/professional-profiles/:profileId/specialties ─────────────────────

  describe("PUT /api/professional-profiles/:profileId/specialties", () => {
    it("replaces all specialties and returns the updated profile", async () => {
      const profile = profiles.addProfile(userAId);

      const res = await request(app)
        .put(`/api/professional-profiles/${profile.id}/specialties`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ names: ["Foundation Design", "Concrete Work"] })
        .expect(200);

      expect(res.body.data.profile.specialties).toHaveLength(2);
      const names = res.body.data.profile.specialties.map(
        (s: { name: string }) => s.name,
      );
      expect(names).toContain("Foundation Design");
      expect(names).toContain("Concrete Work");
    });

    it("clears all specialties when an empty array is supplied", async () => {
      const profile = profiles.addProfile(userAId, {
        specialties: [],
      });

      const res = await request(app)
        .put(`/api/professional-profiles/${profile.id}/specialties`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ names: [] })
        .expect(200);

      expect(res.body.data.profile.specialties).toHaveLength(0);
    });

    it("returns 403 when a different user tries to replace specialties", async () => {
      const profile = profiles.addProfile(userAId);
      await request(app)
        .put(`/api/professional-profiles/${profile.id}/specialties`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ names: ["X"] })
        .expect(403);
    });

    it("returns 400 when names is missing from the body", async () => {
      const profile = profiles.addProfile(userAId);
      await request(app)
        .put(`/api/professional-profiles/${profile.id}/specialties`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({})
        .expect(400);
    });

    it("returns 400 when a specialty name is empty", async () => {
      const profile = profiles.addProfile(userAId);
      await request(app)
        .put(`/api/professional-profiles/${profile.id}/specialties`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ names: [""] })
        .expect(400);
    });
  });

  // ── POST /api/professional-profiles/:profileId/credentials ───────────────────

  describe("POST /api/professional-profiles/:profileId/credentials", () => {
    it("adds a credential and returns the updated profile with 201", async () => {
      const profile = profiles.addProfile(userAId);

      const res = await post(
        `/api/professional-profiles/${profile.id}/credentials`,
        tokenA,
        validCredentialBody,
      ).expect(201);

      expect(res.body.data.profile.credentials).toHaveLength(1);
      expect(res.body.data.profile.credentials[0].title).toBe(
        "BSc Civil Engineering",
      );
    });

    it("returns 401 when unauthenticated", async () => {
      const profile = profiles.addProfile(userAId);
      await request(app)
        .post(`/api/professional-profiles/${profile.id}/credentials`)
        .send(validCredentialBody)
        .expect(401);
    });

    it("returns 403 when another user tries to add a credential", async () => {
      const profile = profiles.addProfile(userAId);
      await post(
        `/api/professional-profiles/${profile.id}/credentials`,
        tokenB,
        validCredentialBody,
      ).expect(403);
    });

    it("returns 404 when the profile does not exist", async () => {
      await post(
        `/api/professional-profiles/${randomUUID()}/credentials`,
        tokenA,
        validCredentialBody,
      ).expect(404);
    });

    it("returns 400 when title is missing", async () => {
      const profile = profiles.addProfile(userAId);
      const res = await post(
        `/api/professional-profiles/${profile.id}/credentials`,
        tokenA,
        { type: "EDUCATION" },
      ).expect(400);

      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "body.title" }),
        ]),
      );
    });

    it("returns 400 for an invalid credential type", async () => {
      const profile = profiles.addProfile(userAId);
      await post(
        `/api/professional-profiles/${profile.id}/credentials`,
        tokenA,
        { title: "X", type: "DEGREE" },
      ).expect(400);
    });
  });

  // ── PATCH /api/professional-profiles/:profileId/credentials/:credentialId ─────

  describe("PATCH .../credentials/:credentialId", () => {
    it("updates a credential and returns 200", async () => {
      const profile = profiles.addProfile(userAId);
      // Seed via the addCredential repository method.
      await profiles.addCredential(profile.id, {
        type: "EDUCATION",
        title: "Original Title",
        institution: null,
        yearObtained: null,
        description: null,
        credentialUrl: null,
      });
      const credId = (await profiles.findById(profile.id))!.credentials[0]!.id;

      const res = await patch(
        `/api/professional-profiles/${profile.id}/credentials/${credId}`,
        tokenA,
        { title: "Updated Title" },
      ).expect(200);

      expect(res.body.data.credential.title).toBe("Updated Title");
    });

    it("returns 403 when a different user tries to update the credential", async () => {
      const profile = profiles.addProfile(userAId);
      await profiles.addCredential(profile.id, {
        title: "Title",
        institution: null,
        yearObtained: null,
        description: null,
        credentialUrl: null,
      });
      const credId = (await profiles.findById(profile.id))!.credentials[0]!.id;

      await patch(
        `/api/professional-profiles/${profile.id}/credentials/${credId}`,
        tokenB,
        { title: "Hack" },
      ).expect(403);
    });

    it("returns 404 when the credential does not belong to the given profile", async () => {
      // Profile A has no credentials; supply a random credentialId.
      const profile = profiles.addProfile(userAId);

      await patch(
        `/api/professional-profiles/${profile.id}/credentials/${randomUUID()}`,
        tokenA,
        { title: "X" },
      ).expect(404);
    });

    it("returns 400 for an empty update body", async () => {
      const profile = profiles.addProfile(userAId);
      await profiles.addCredential(profile.id, {
        title: "Title",
        institution: null,
        yearObtained: null,
        description: null,
        credentialUrl: null,
      });
      const credId = (await profiles.findById(profile.id))!.credentials[0]!.id;

      await patch(
        `/api/professional-profiles/${profile.id}/credentials/${credId}`,
        tokenA,
        {},
      ).expect(400);
    });

    it("returns 400 for a non-UUID credential ID in params", async () => {
      const profile = profiles.addProfile(userAId);
      await patch(
        `/api/professional-profiles/${profile.id}/credentials/not-a-uuid`,
        tokenA,
        { title: "X" },
      ).expect(400);
    });
  });

  // ── DELETE /api/professional-profiles/:profileId/credentials/:credentialId ────

  describe("DELETE .../credentials/:credentialId", () => {
    it("deletes a credential and returns 200", async () => {
      const profile = profiles.addProfile(userAId);
      await profiles.addCredential(profile.id, {
        title: "Title",
        institution: null,
        yearObtained: null,
        description: null,
        credentialUrl: null,
      });
      const credId = (await profiles.findById(profile.id))!.credentials[0]!.id;

      const res = await del(
        `/api/professional-profiles/${profile.id}/credentials/${credId}`,
        tokenA,
      ).expect(200);

      expect(res.body.success).toBe(true);
      // Credential is gone.
      expect(
        (await profiles.findById(profile.id))!.credentials,
      ).toHaveLength(0);
    });

    it("returns 403 when a different user tries to delete the credential", async () => {
      const profile = profiles.addProfile(userAId);
      await profiles.addCredential(profile.id, {
        title: "Title",
        institution: null,
        yearObtained: null,
        description: null,
        credentialUrl: null,
      });
      const credId = (await profiles.findById(profile.id))!.credentials[0]!.id;

      await del(
        `/api/professional-profiles/${profile.id}/credentials/${credId}`,
        tokenB,
      ).expect(403);
    });

    it("returns 404 when the credential is not on the profile", async () => {
      const profile = profiles.addProfile(userAId);

      await del(
        `/api/professional-profiles/${profile.id}/credentials/${randomUUID()}`,
        tokenA,
      ).expect(404);
    });
  });

  // ── GET /api/professional-profiles (public directory) ────────────────────────

  describe("GET /api/professional-profiles", () => {
    const privateUserId = randomUUID();
    const day = (offset: number): Date =>
      new Date(Date.UTC(2026, 0, 1 + offset));

    beforeEach(() => {
      users.addUser({ id: privateUserId, role: "PROFESSIONAL" });

      const abebe = profiles.addProfile(userAId, {
        displayName: "Abebe Bekele",
        headline: "Structural engineer",
        profession: "Structural Engineer",
        yearsExperience: 10,
        city: "Addis Ababa",
        createdAt: day(3),
      });
      void profiles.replaceSpecialties(abebe.id, [
        "Foundation Design",
        "Concrete",
      ]);

      const sara = profiles.addProfile(userBId, {
        displayName: "Sara Tesfaye",
        headline: "Site supervisor",
        profession: "Civil Engineer",
        yearsExperience: 6,
        city: "Dire Dawa",
        country: "Ethiopia",
        createdAt: day(1),
      });
      void profiles.replaceSpecialties(sara.id, ["Road Works"]);
      // PRIVATE profile that matches nearly every query — must never appear.
      profiles.addProfile(privateUserId, {
        displayName: "Hidden Professional",
        headline: "secret structural consultant",
        profession: "Structural Engineer",
        yearsExperience: 30,
        city: "Addis Ababa",
        visibility: "PRIVATE",
        bio: "confidential",
        email: "hidden@cmm.test",
        phone: "+251900000000",
        credentials: [
          {
            id: randomUUID(),
            profileId: "",
            type: "EDUCATION",
            title: "PhD",
            institution: null,
            yearObtained: null,
            description: null,
            credentialUrl: null,
            createdAt: day(0),
            updatedAt: day(0),
          },
        ],
        createdAt: day(10),
      });
    });

    it("allows an anonymous directory request and returns the standard envelope", async () => {
      const res = await request(app)
        .get("/api/professional-profiles")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.professionals).toHaveLength(2);
      expect(res.body.data.totalItems).toBe(2);
      expect(res.body.data.currentPage).toBe(1);
      expect(res.body.data.pageSize).toBe(20);
      expect(res.body.data.totalPages).toBe(1);
      expect(res.body.data.hasNextPage).toBe(false);
      expect(res.body.data.hasPreviousPage).toBe(false);
    });

    it("returns only PUBLIC profiles and never leaks PRIVATE ones", async () => {
      const res = await request(app).get("/api/professional-profiles").expect(200);

      const names = res.body.data.professionals.map(
        (p: { displayName: string }) => p.displayName,
      );
      expect(names).toContain("Abebe Bekele");
      expect(names).toContain("Sara Tesfaye");
      expect(names).not.toContain("Hidden Professional");
    });

    it("never returns PRIVATE profiles even when they match the search term", async () => {
      const res = await request(app)
        .get("/api/professional-profiles?search=structural")
        .expect(200);

      const names = res.body.data.professionals.map(
        (p: { displayName: string }) => p.displayName,
      );
      expect(names).toEqual(["Abebe Bekele"]);
    });

    it("searches across display name, headline, profession, and specialty names", async () => {
      const byName = await request(app)
        .get("/api/professional-profiles?search=Sara")
        .expect(200);
      expect(byName.body.data.totalItems).toBe(1);

      const byHeadline = await request(app)
        .get("/api/professional-profiles?search=supervisor")
        .expect(200);
      expect(byHeadline.body.data.totalItems).toBe(1);

      const byProfession = await request(app)
        .get("/api/professional-profiles?search=civil%20engineer")
        .expect(200);
      expect(byProfession.body.data.totalItems).toBe(1);

      const bySpecialty = await request(app)
        .get("/api/professional-profiles?search=foundation")
        .expect(200);
      expect(bySpecialty.body.data.totalItems).toBe(1);
    });

    it("filters by profession", async () => {
      const res = await request(app)
        .get("/api/professional-profiles?profession=civil")
        .expect(200);

      expect(res.body.data.totalItems).toBe(1);
      expect(res.body.data.professionals[0].displayName).toBe("Sara Tesfaye");
    });

    it("filters by specialty", async () => {
      const res = await request(app)
        .get("/api/professional-profiles?specialty=concrete")
        .expect(200);

      expect(res.body.data.totalItems).toBe(1);
      expect(res.body.data.professionals[0].displayName).toBe("Abebe Bekele");
    });

    it("filters by city", async () => {
      const res = await request(app)
        .get("/api/professional-profiles?city=dire%20dawa")
        .expect(200);

      expect(res.body.data.totalItems).toBe(1);
      expect(res.body.data.professionals[0].displayName).toBe("Sara Tesfaye");
    });

    it("combines multiple filters correctly", async () => {
      // All three filters match only Abebe.
      const both = await request(app)
        .get(
          "/api/professional-profiles?profession=structural&city=addis&specialty=foundation",
        )
        .expect(200);
      expect(both.body.data.totalItems).toBe(1);
      expect(both.body.data.professionals[0].displayName).toBe("Abebe Bekele");

      // A conflicting combination returns nothing — not a broader match.
      const conflicting = await request(app)
        .get(
          "/api/professional-profiles?profession=structural&city=dire%20dawa",
        )
        .expect(200);
      expect(conflicting.body.data.totalItems).toBe(0);
      expect(conflicting.body.data.professionals).toEqual([]);
    });

    it("paginates results and reports pagination metadata", async () => {
      profiles.addProfile(randomUUID(), { displayName: "Extra One" });
      profiles.addProfile(randomUUID(), { displayName: "Extra Two" });
      users.addUser({ id: randomUUID(), role: "PROFESSIONAL" });

      const page1 = await request(app)
        .get("/api/professional-profiles?page=1&limit=2")
        .expect(200);
      expect(page1.body.data.professionals).toHaveLength(2);
      expect(page1.body.data.totalItems).toBe(4);
      expect(page1.body.data.totalPages).toBe(2);
      expect(page1.body.data.hasNextPage).toBe(true);
      expect(page1.body.data.hasPreviousPage).toBe(false);

      const page2 = await request(app)
        .get("/api/professional-profiles?page=2&limit=2")
        .expect(200);
      expect(page2.body.data.professionals).toHaveLength(2);
      expect(page2.body.data.hasNextPage).toBe(false);
      expect(page2.body.data.hasPreviousPage).toBe(true);

      // No overlap between pages.
      const p1Ids = page1.body.data.professionals.map((p: { id: string }) => p.id);
      const p2Ids = page2.body.data.professionals.map((p: { id: string }) => p.id);
      expect(p1Ids.filter((id: string) => p2Ids.includes(id))).toEqual([]);
    });

    it("sorts deterministically by name and experience", async () => {
      const byNameAsc = await request(app)
        .get("/api/professional-profiles?sortBy=name&sortOrder=asc")
        .expect(200);
      expect(byNameAsc.body.data.professionals.map((p: { displayName: string }) => p.displayName)).toEqual([
        "Abebe Bekele",
        "Sara Tesfaye",
      ]);

      const byNameDesc = await request(app)
        .get("/api/professional-profiles?sortBy=name&sortOrder=desc")
        .expect(200);
      expect(byNameDesc.body.data.professionals.map((p: { displayName: string }) => p.displayName)).toEqual([
        "Sara Tesfaye",
        "Abebe Bekele",
      ]);

      const byExperience = await request(app)
        .get("/api/professional-profiles?sortBy=experience&sortOrder=desc")
        .expect(200);
      expect(byExperience.body.data.professionals[0].yearsExperience).toBe(10);

      // Default sort is newest first.
      const byNewest = await request(app)
        .get("/api/professional-profiles")
        .expect(200);
      expect(byNewest.body.data.professionals[0].displayName).toBe(
        "Abebe Bekele",
      );
    });

    it("rejects invalid query parameters with 400", async () => {
      await request(app).get("/api/professional-profiles?page=0").expect(400);
      await request(app).get("/api/professional-profiles?page=-1").expect(400);
      await request(app).get("/api/professional-profiles?limit=0").expect(400);
      await request(app).get("/api/professional-profiles?limit=51").expect(400);
      await request(app)
        .get("/api/professional-profiles?sortBy=bogus")
        .expect(400);
      await request(app)
        .get("/api/professional-profiles?sortOrder=sideways")
        .expect(400);
      await request(app)
        .get("/api/professional-profiles?rogue=value")
        .expect(400);
      await request(app)
        .get("/api/professional-profiles?search=%20%20")
        .expect(400);
    });

    it("does not leak PRIVATE profiles through pagination windows", async () => {
      profiles.addProfile(randomUUID(), { displayName: "Pub Three" });
      profiles.addProfile(randomUUID(), { displayName: "Pub Four" });

      const allIds: string[] = [];
      let page = 1;
      for (; page <= 5; page += 1) {
        const res = await request(app)
          .get(`/api/professional-profiles?page=${page}&limit=2`)
          .expect(200);
        allIds.push(
          ...res.body.data.professionals.map((p: { id: string }) => p.id),
        );
        if (!res.body.data.hasNextPage) break;
      }

      // Every returned profile must be one of the seeded PUBLIC profiles.
      const publicProfiles = [...profiles.values()].filter(
        (p) => p.visibility === "PUBLIC",
      );
      expect(allIds.length).toBe(publicProfiles.length);
      for (const profile of publicProfiles) {
        expect(allIds).toContain(profile.id);
      }
    });

    it("returns card data without sensitive or heavy fields", async () => {
      const res = await request(app).get("/api/professional-profiles").expect(200);

      const card = res.body.data.professionals.find(
        (p: { displayName: string }) => p.displayName === "Abebe Bekele",
      );
      expect(card).toBeDefined();
      expect(card).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          displayName: "Abebe Bekele",
          headline: "Structural engineer",
          profession: "Structural Engineer",
          yearsExperience: 10,
          city: "Addis Ababa",
          region: null,
          country: null,
          avatarUrl: null,
          specialties: ["Concrete", "Foundation Design"],
        }),
      );
      expect(card).not.toHaveProperty("bio");
      expect(card).not.toHaveProperty("credentials");
      expect(card).not.toHaveProperty("email");
      expect(card).not.toHaveProperty("phone");
      expect(card.specialties.length).toBeLessThanOrEqual(5);
    });

    it("returns an empty directory in the standard shape when nothing matches", async () => {
      const res = await request(app)
        .get("/api/professional-profiles?search=nobody-matches-this")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.professionals).toEqual([]);
      expect(res.body.data.totalItems).toBe(0);
      expect(res.body.data.totalPages).toBe(0);
      expect(res.body.data.hasNextPage).toBe(false);
      expect(res.body.data.hasPreviousPage).toBe(false);
    });
  });

  // ── POST /api/professional-profiles/:profileId/portfolio ─────────────────────

  describe("POST /api/professional-profiles/:profileId/portfolio", () => {
    const validPortfolioBody = {
      title: "G+2 Residential Villa",
      description: "Full structural design and supervision.",
      projectType: "Residential",
      location: "Addis Ababa",
      completionDate: "2025-06-15T00:00:00.000Z",
      images: ["https://example.com/work-1.jpg"],
    };

    it("creates a portfolio item for the owner and returns 201", async () => {
      const profile = profiles.addProfile(userAId);

      const res = await post(
        `/api/professional-profiles/${profile.id}/portfolio`,
        tokenA,
        validPortfolioBody,
      ).expect(201);

      expect(res.body.success).toBe(true);
      const item = res.body.data.item;
      expect(item.title).toBe("G+2 Residential Villa");
      expect(item.projectType).toBe("Residential");
      expect(item.images).toEqual(["https://example.com/work-1.jpg"]);
      // Defaults for omitted fields.
      expect(item.displayOrder).toBe(0);
      expect(item.completionDate).toBeDefined();
      expect(item.profileId).toBe(profile.id);
    });

    it("returns 401 when unauthenticated", async () => {
      const profile = profiles.addProfile(userAId);

      await request(app)
        .post(`/api/professional-profiles/${profile.id}/portfolio`)
        .send(validPortfolioBody)
        .expect(401);
    });

    it("returns 403 when a different user tries to add an item", async () => {
      const profile = profiles.addProfile(userAId);

      await post(
        `/api/professional-profiles/${profile.id}/portfolio`,
        tokenB,
        validPortfolioBody,
      ).expect(403);
    });

    it("returns 404 when the profile does not exist", async () => {
      await post(
        `/api/professional-profiles/${randomUUID()}/portfolio`,
        tokenA,
        validPortfolioBody,
      ).expect(404);
    });

    it("returns 400 when title is missing", async () => {
      const profile = profiles.addProfile(userAId);

      const res = await post(
        `/api/professional-profiles/${profile.id}/portfolio`,
        tokenA,
        { description: "No title here." },
      ).expect(400);

      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "body.title" }),
        ]),
      );
    });

    it("returns 400 for more than 8 images", async () => {
      const profile = profiles.addProfile(userAId);

      await post(
        `/api/professional-profiles/${profile.id}/portfolio`,
        tokenA,
        {
          title: "X",
          images: Array.from(
            { length: 9 },
            (_, i) => `https://example.com/${i}.jpg`,
          ),
        },
      ).expect(400);
    });

    it("returns 400 for an invalid image URL", async () => {
      const profile = profiles.addProfile(userAId);

      await post(
        `/api/professional-profiles/${profile.id}/portfolio`,
        tokenA,
        { title: "X", images: ["not-a-url"] },
      ).expect(400);
    });

    it("returns 400 for an invalid completion date", async () => {
      const profile = profiles.addProfile(userAId);

      await post(
        `/api/professional-profiles/${profile.id}/portfolio`,
        tokenA,
        { title: "X", completionDate: "not-a-date" },
      ).expect(400);
    });

    it("returns 400 for unknown fields", async () => {
      const profile = profiles.addProfile(userAId);

      await post(
        `/api/professional-profiles/${profile.id}/portfolio`,
        tokenA,
        { ...validPortfolioBody, rogue: "field" },
      ).expect(400);
    });
  });

  // ── GET /api/professional-profiles/:profileId/portfolio ──────────────────────

  describe("GET /api/professional-profiles/:profileId/portfolio", () => {
    it("returns an empty item list in the standard shape", async () => {
      const profile = profiles.addProfile(userAId);

      const res = await request(app)
        .get(`/api/professional-profiles/${profile.id}/portfolio`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
    });

    it("returns portfolio items to an unauthenticated caller for a PUBLIC profile", async () => {
      const profile = profiles.addProfile(userAId, { visibility: "PUBLIC" });
      profiles.addItem(profile.id, {
        title: "Warehouse Build",
        displayOrder: 1,
      });
      profiles.addItem(profile.id, {
        title: "Villa Extension",
        displayOrder: 0,
      });

      const res = await request(app)
        .get(`/api/professional-profiles/${profile.id}/portfolio`)
        .expect(200);

      const items = res.body.data.items;
      expect(items).toHaveLength(2);
      // Ordered by displayOrder ascending regardless of insertion order.
      expect(items[0].title).toBe("Villa Extension");
      expect(items[1].title).toBe("Warehouse Build");
    });

    it("breaks displayOrder ties newest-first", async () => {
      const profile = profiles.addProfile(userAId);
      profiles.addItem(profile.id, {
        title: "Older project",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      profiles.addItem(profile.id, {
        title: "Newer project",
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      });

      const res = await request(app)
        .get(`/api/professional-profiles/${profile.id}/portfolio`)
        .expect(200);

      const titles = res.body.data.items.map(
        (i: { title: string }) => i.title,
      );
      expect(titles).toEqual(["Newer project", "Older project"]);
    });

    it("returns portfolio items to the owner of a PRIVATE profile", async () => {
      const profile = profiles.addProfile(userAId, { visibility: "PRIVATE" });
      profiles.addItem(profile.id, { title: "Private project" });

      const res = await get(
        `/api/professional-profiles/${profile.id}/portfolio`,
        tokenA,
      ).expect(200);

      expect(res.body.data.items).toHaveLength(1);
    });

    it("returns 403 for a PRIVATE profile portfolio when unauthenticated", async () => {
      const profile = profiles.addProfile(userAId, { visibility: "PRIVATE" });
      profiles.addItem(profile.id, { title: "Secret project" });

      await request(app)
        .get(`/api/professional-profiles/${profile.id}/portfolio`)
        .expect(403);
    });

    it("returns 403 for a PRIVATE profile portfolio when requested by another user", async () => {
      const profile = profiles.addProfile(userAId, { visibility: "PRIVATE" });
      profiles.addItem(profile.id, { title: "Secret project" });

      await get(
        `/api/professional-profiles/${profile.id}/portfolio`,
        tokenB,
      ).expect(403);
    });

    it("never exposes private data through a public portfolio listing", async () => {
      const profile = profiles.addProfile(userAId, { visibility: "PUBLIC" });
      profiles.addItem(profile.id, {
        title: "Public project",
        images: ["https://example.com/pub.jpg"],
      });

      const res = await request(app)
        .get(`/api/professional-profiles/${profile.id}/portfolio`)
        .expect(200);

      const item = res.body.data.items[0];
      expect(item).toMatchObject({
        title: "Public project",
        images: ["https://example.com/pub.jpg"],
      });
    });

    it("returns 404 when the profile does not exist", async () => {
      await request(app)
        .get(`/api/professional-profiles/${randomUUID()}/portfolio`)
        .expect(404);
    });

    it("returns 400 for a non-UUID profile ID", async () => {
      await request(app)
        .get("/api/professional-profiles/not-a-uuid/portfolio")
        .expect(400);
    });
  });

  // ── PATCH /api/professional-profiles/:profileId/portfolio/:itemId ────────────

  describe("PATCH /api/professional-profiles/:profileId/portfolio/:itemId", () => {
    it("updates the owner's portfolio item and returns 200", async () => {
      const profile = profiles.addProfile(userAId);
      const item = profiles.addItem(profile.id, { title: "Original" });

      const res = await patch(
        `/api/professional-profiles/${profile.id}/portfolio/${item.id}`,
        tokenA,
        { title: "Renovated Villa", displayOrder: 3 },
      ).expect(200);

      expect(res.body.data.item.title).toBe("Renovated Villa");
      expect(res.body.data.item.displayOrder).toBe(3);
    });

    it("replaces the full images array on update", async () => {
      const profile = profiles.addProfile(userAId);
      const item = profiles.addItem(profile.id, {
        images: ["https://example.com/old.jpg"],
      });

      const res = await patch(
        `/api/professional-profiles/${profile.id}/portfolio/${item.id}`,
        tokenA,
        { images: ["https://example.com/new-1.jpg", "https://example.com/new-2.jpg"] },
      ).expect(200);

      expect(res.body.data.item.images).toEqual([
        "https://example.com/new-1.jpg",
        "https://example.com/new-2.jpg",
      ]);
    });

    it("returns 401 when unauthenticated", async () => {
      const profile = profiles.addProfile(userAId);
      const item = profiles.addItem(profile.id);

      await request(app)
        .patch(`/api/professional-profiles/${profile.id}/portfolio/${item.id}`)
        .send({ title: "X" })
        .expect(401);
    });

    it("returns 403 when a different user tries to update the item", async () => {
      const profile = profiles.addProfile(userAId);
      const item = profiles.addItem(profile.id);

      await patch(
        `/api/professional-profiles/${profile.id}/portfolio/${item.id}`,
        tokenB,
        { title: "Hijacked" },
      ).expect(403);
    });

    it("returns 404 when the item belongs to another profile", async () => {
      const profileB = profiles.addProfile(userBId);
      const foreignItem = profiles.addItem(profileB.id, { title: "Not yours" });

      const profileA = profiles.addProfile(userAId);
      await patch(
        `/api/professional-profiles/${profileA.id}/portfolio/${foreignItem.id}`,
        tokenA,
        { title: "Cross-profile write" },
      ).expect(404);
    });

    it("returns 404 when the item does not exist", async () => {
      const profile = profiles.addProfile(userAId);

      await patch(
        `/api/professional-profiles/${profile.id}/portfolio/${randomUUID()}`,
        tokenA,
        { title: "Ghost" },
      ).expect(404);
    });

    it("returns 400 for an empty update body", async () => {
      const profile = profiles.addProfile(userAId);
      const item = profiles.addItem(profile.id);

      await patch(
        `/api/professional-profiles/${profile.id}/portfolio/${item.id}`,
        tokenA,
        {},
      ).expect(400);
    });

    it("returns 400 for a non-UUID item ID in params", async () => {
      const profile = profiles.addProfile(userAId);

      await patch(
        `/api/professional-profiles/${profile.id}/portfolio/not-a-uuid`,
        tokenA,
        { title: "X" },
      ).expect(400);
    });
  });

  // ── DELETE /api/professional-profiles/:profileId/portfolio/:itemId ───────────

  describe("DELETE /api/professional-profiles/:profileId/portfolio/:itemId", () => {
    it("deletes the owner's portfolio item and returns 200", async () => {
      const profile = profiles.addProfile(userAId);
      const kept = profiles.addItem(profile.id, { title: "Keep me" });
      const dropped = profiles.addItem(profile.id, { title: "Drop me" });

      await del(
        `/api/professional-profiles/${profile.id}/portfolio/${dropped.id}`,
        tokenA,
      ).expect(200);

      const res = await get(
        `/api/professional-profiles/${profile.id}/portfolio`,
        tokenA,
      ).expect(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].id).toBe(kept.id);
    });

    it("returns 401 when unauthenticated", async () => {
      const profile = profiles.addProfile(userAId);
      const item = profiles.addItem(profile.id);

      await request(app)
        .delete(
          `/api/professional-profiles/${profile.id}/portfolio/${item.id}`,
        )
        .expect(401);
    });

    it("returns 403 when a different user tries to delete the item", async () => {
      const profile = profiles.addProfile(userAId);
      const item = profiles.addItem(profile.id);

      await del(
        `/api/professional-profiles/${profile.id}/portfolio/${item.id}`,
        tokenB,
      ).expect(403);
    });

    it("returns 404 when the item belongs to another profile", async () => {
      const profileB = profiles.addProfile(userBId);
      const foreignItem = profiles.addItem(profileB.id, { title: "Not yours" });

      const profileA = profiles.addProfile(userAId);
      await del(
        `/api/professional-profiles/${profileA.id}/portfolio/${foreignItem.id}`,
        tokenA,
      ).expect(404);
    });

    it("returns 404 when the item does not exist", async () => {
      const profile = profiles.addProfile(userAId);

      await del(
        `/api/professional-profiles/${profile.id}/portfolio/${randomUUID()}`,
        tokenA,
      ).expect(404);
    });
  });

  // ── Helper request functions ───────────────────────────────────────────────────

  function get(path: string, token: string) {
    return request(app).get(path).set("Authorization", `Bearer ${token}`);
  }

  function post(path: string, token: string, body: object) {
    return request(app)
      .post(path)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  function patch(path: string, token: string, body: object) {
    return request(app)
      .patch(path)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  function del(path: string, token: string) {
    return request(app)
      .delete(path)
      .set("Authorization", `Bearer ${token}`);
  }
});
