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

    users.addUser({ id: userAId, role: "CUSTOMER" });
    users.addUser({ id: userBId, role: "CUSTOMER" });

    app = createApp({
      professionalProfileRepository: profiles,
      userRepository: users,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    tokenA = tokenService.createAccessToken({ userId: userAId, role: "CUSTOMER" });
    tokenB = tokenService.createAccessToken({ userId: userBId, role: "CUSTOMER" });
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
