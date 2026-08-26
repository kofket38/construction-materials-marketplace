import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { ProjectStatus } from "../src/repositories/project.repository.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemoryProjectRepository } from "./helpers/in-memory-project.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

// ── Fixed IDs ──────────────────────────────────────────────────────────────────

const userAId = randomUUID();
const userBId = randomUUID();

// ── Valid request bodies ───────────────────────────────────────────────────────

const validCreateBody = {
  title: "G+2 Villa Construction",
  description: "Full structural build.",
  projectType: "Residential",
  location: "Addis Ababa",
  budget: "250000.50",
};

const validImagesBody = {
  title: "Warehouse Build",
  images: ["https://example.com/site-1.jpg", "https://example.com/site-2.jpg"],
};

// ── Test suite ─────────────────────────────────────────────────────────────────

describe("Projects API", () => {
  const tokenService = new JwtTokenService();
  let projects: InMemoryProjectRepository;
  let users: InMemoryUserRepository;
  let app: ReturnType<typeof createApp>;
  let tokenA: string;
  let tokenB: string;

  beforeEach(() => {
    projects = new InMemoryProjectRepository();
    users = new InMemoryUserRepository();

    users.addUser({ id: userAId, role: "CUSTOMER" });
    users.addUser({ id: userBId, role: "CUSTOMER" });

    app = createApp({
      projectRepository: projects,
      userRepository: users,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    tokenA = tokenService.createAccessToken({ userId: userAId, role: "CUSTOMER" });
    tokenB = tokenService.createAccessToken({ userId: userBId, role: "CUSTOMER" });
  });

  // ── POST /api/projects ───────────────────────────────────────────────────────

  describe("POST /api/projects", () => {
    it("creates a project for the authenticated owner and returns 201", async () => {
      const res = await post("/api/projects", tokenA, validCreateBody).expect(
        201,
      );

      expect(res.body.success).toBe(true);
      const p = res.body.data.project;
      expect(p.ownerId).toBe(userAId);
      expect(p.title).toBe("G+2 Villa Construction");
      expect(p.budget).toBe("250000.50");
      expect(p.location).toBe("Addis Ababa");
    });

    it("defaults new projects to DRAFT with displayOrder 0", async () => {
      const res = await post("/api/projects", tokenA, validCreateBody).expect(
        201,
      );

      const p = res.body.data.project;
      expect(p.status).toBe("DRAFT");
      expect(p.publishedAt).toBeNull();
      expect(p.displayOrder).toBe(0);
      expect(p.images).toEqual([]);
    });

    it("returns 401 when unauthenticated", async () => {
      await request(app)
        .post("/api/projects")
        .send(validCreateBody)
        .expect(401);
    });

    it("returns 400 when title is missing", async () => {
      const res = await post("/api/projects", tokenA, {
        description: "No title.",
      }).expect(400);

      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "body.title" }),
        ]),
      );
    });

    it("returns 400 for unknown fields", async () => {
      await post("/api/projects", tokenA, {
        ...validCreateBody,
        status: "PUBLISHED",
      }).expect(400);
    });

    it("rejects direct status or publishedAt manipulation on create", async () => {
      await post("/api/projects", tokenA, {
        ...validCreateBody,
        publishedAt: new Date().toISOString(),
      }).expect(400);
    });

    it("returns 400 for a non-numeric budget", async () => {
      await post("/api/projects", tokenA, {
        ...validCreateBody,
        budget: "lots of money",
      }).expect(400);
    });

    it("returns 400 for a negative budget", async () => {
      await post("/api/projects", tokenA, {
        ...validCreateBody,
        budget: "-100",
      }).expect(400);
    });

    it("normalises budgets to two decimal places", async () => {
      const res = await post("/api/projects", tokenA, {
        ...validCreateBody,
        budget: 5000,
      }).expect(201);

      expect(res.body.data.project.budget).toBe("5000.00");
    });

    it("returns 400 for invalid date fields", async () => {
      await post("/api/projects", tokenA, {
        ...validCreateBody,
        startDate: "not-a-date",
      }).expect(400);
    });

    it("returns 400 for invalid image URLs", async () => {
      await post("/api/projects", tokenA, {
        ...validCreateBody,
        images: ["not-a-url"],
      }).expect(400);
    });

    it("returns 400 for more than eight images", async () => {
      const nineImages = Array.from(
        { length: 9 },
        (_, i) => `https://example.com/img-${i}.jpg`,
      );

      await post("/api/projects", tokenA, {
        ...validCreateBody,
        images: nineImages,
      }).expect(400);
    });

    it("creates a project with valid images and displayOrder", async () => {
      const res = await post("/api/projects", tokenA, validImagesBody).expect(
        201,
      );

      expect(res.body.data.project.images).toEqual([
        "https://example.com/site-1.jpg",
        "https://example.com/site-2.jpg",
      ]);
    });
  });

  // ── GET /api/projects/me ─────────────────────────────────────────────────────

  describe("GET /api/projects/me", () => {
    it("returns an empty list when the user owns no projects", async () => {
      const res = await get("/api/projects/me", tokenA).expect(200);
      expect(res.body.data.projects).toEqual([]);
    });

    it("returns every own project regardless of status", async () => {
      seedOwnerAStatuses();
      repo_addProjectForB();

      const res = await get("/api/projects/me", tokenA).expect(200);

      const statuses = res.body.data.projects.map(
        (p: { status: string }) => p.status,
      );
      expect(statuses).toContain("DRAFT");
      expect(statuses).toContain("PUBLISHED");
      expect(statuses).toContain("IN_PROGRESS");
      expect(statuses).toContain("COMPLETED");
      expect(statuses).toHaveLength(5);
    });

    it("never returns another owner's projects", async () => {
      repo_addProjectForB();

      const res = await get("/api/projects/me", tokenA).expect(200);
      expect(res.body.data.projects).toHaveLength(0);
    });

    it("orders by displayOrder ascending", async () => {
      projects.addProject(userAId, { title: "Late", displayOrder: 5 });
      projects.addProject(userAId, { title: "Early", displayOrder: 1 });

      const res = await get("/api/projects/me", tokenA).expect(200);
      expect(res.body.data.projects.map((p: { title: string }) => p.title)).toEqual([
        "Early",
        "Late",
      ]);
    });

    it("returns 401 when unauthenticated", async () => {
      await request(app).get("/api/projects/me").expect(401);
    });
  });

  // ── PUT /api/projects/me/reorder ─────────────────────────────────────────────

  describe("PUT /api/projects/me/reorder", () => {
    let alpha: ReturnType<InMemoryProjectRepository["addProject"]>;
    let beta: ReturnType<InMemoryProjectRepository["addProject"]>;

    beforeEach(() => {
      alpha = projects.addProject(userAId, { title: "Alpha", displayOrder: 0 });
      beta = projects.addProject(userAId, { title: "Beta", displayOrder: 1 });
    });

    it("reorders the owner's projects and persists the order", async () => {
      const res = await put("/api/projects/me/reorder", tokenA, {
        projectIds: [beta.id, alpha.id],
      }).expect(200);

      expect(res.body.data.projects.map((p: { id: string }) => p.id)).toEqual([
        beta.id,
        alpha.id,
      ]);

      const list = await get("/api/projects/me", tokenA).expect(200);
      expect(list.body.data.projects.map((p: { id: string }) => p.id)).toEqual([
        beta.id,
        alpha.id,
      ]);
    });

    it("rejects incomplete ID lists without changing anything", async () => {
      await put("/api/projects/me/reorder", tokenA, {
        projectIds: [alpha.id],
      }).expect(400);

      const list = await get("/api/projects/me", tokenA).expect(200);
      expect(
        list.body.data.projects.map((p: { displayOrder: number }) => p.displayOrder),
      ).toEqual([0, 1]);
    });

    it("rejects foreign IDs", async () => {
      const foreign = projects.addProject(userBId, {});

      await put("/api/projects/me/reorder", tokenA, {
        projectIds: [alpha.id, beta.id, foreign.id],
      }).expect(400);
    });

    it("rejects duplicate IDs", async () => {
      await put("/api/projects/me/reorder", tokenA, {
        projectIds: [alpha.id, alpha.id],
      }).expect(400);
    });

    it("returns 400 for non-UUID entries", async () => {
      await put("/api/projects/me/reorder", tokenA, {
        projectIds: ["not-a-uuid"],
      }).expect(400);
    });

    it("returns 401 when unauthenticated", async () => {
      await request(app)
        .put("/api/projects/me/reorder")
        .send({ projectIds: [alpha.id, beta.id] })
        .expect(401);
    });
  });

  // ── GET /api/projects (public search) ────────────────────────────────────────

  describe("GET /api/projects", () => {
    beforeEach(() => {
      projects.addProject(userAId, {
        title: "Villa Complex",
        projectType: "Residential",
        status: "PUBLISHED",
        publishedAt: new Date("2026-08-20T09:00:00.000Z"),
      });
      projects.addProject(userBId, {
        title: "Office Tower",
        projectType: "Commercial",
        status: "PUBLISHED",
        publishedAt: new Date("2026-08-25T09:00:00.000Z"),
      });
      seedOwnerAStatuses({ skipPublished: true });
      projects.addProject(userAId, {
        title: "Hidden Villa Draft",
        status: "DRAFT",
      });
    });

    it("returns only PUBLISHED projects to anonymous callers", async () => {
      const res = await request(app).get("/api/projects").expect(200);

      expect(res.body.data.totalItems).toBe(2);
      for (const p of res.body.data.projects) {
        expect(p.status).toBe("PUBLISHED");
      }
    });

    it("cannot leak drafts through search filters", async () => {
      const res = await request(app)
        .get("/api/projects")
        .query({ search: "hidden villa draft" })
        .expect(200);

      expect(res.body.data.projects).toHaveLength(0);
      expect(res.body.data.totalItems).toBe(0);
    });

    it("filters by projectType case-insensitively", async () => {
      const res = await request(app)
        .get("/api/projects")
        .query({ projectType: "residential" })
        .expect(200);

      expect(res.body.data.projects.map((p: { title: string }) => p.title)).toEqual([
        "Villa Complex",
      ]);
    });

    it("paginates with correct metadata", async () => {
      const page1 = await request(app)
        .get("/api/projects")
        .query({ page: 1, limit: 1 })
        .expect(200);

      expect(page1.body.data.totalItems).toBe(2);
      expect(page1.body.data.totalPages).toBe(2);
      expect(page1.body.data.hasNextPage).toBe(true);
      expect(page1.body.data.hasPreviousPage).toBe(false);
      expect(page1.body.data.projects[0].title).toBe("Office Tower");

      const page2 = await request(app)
        .get("/api/projects")
        .query({ page: 2, limit: 1 })
        .expect(200);

      expect(page2.body.data.hasNextPage).toBe(false);
      expect(page2.body.data.hasPreviousPage).toBe(true);
    });

    it("rejects unknown query parameters", async () => {
      await request(app).get("/api/projects").query({ rogue: "1" }).expect(400);
    });

    it("rejects non-positive page values", async () => {
      await request(app).get("/api/projects").query({ page: "0" }).expect(400);
    });
  });

  // ── GET /api/projects/:projectId ─────────────────────────────────────────────

  describe("GET /api/projects/:projectId", () => {
    it("returns a PUBLISHED project to an anonymous caller", async () => {
      const project = projects.addProject(userAId, { status: "PUBLISHED" });

      const res = await request(app)
        .get(`/api/projects/${project.id}`)
        .expect(200);

      expect(res.body.data.project.id).toBe(project.id);
    });

    it("returns any-status project to its owner", async () => {
      const draft = projects.addProject(userAId, { status: "DRAFT" });

      const res = await get(`/api/projects/${draft.id}`, tokenA).expect(200);
      expect(res.body.data.project.status).toBe("DRAFT");
    });

    it.each(["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const)(
      "returns 404 publicly for a %s project",
      async (status) => {
        const project = projects.addProject(userAId, { status });

        await request(app).get(`/api/projects/${project.id}`).expect(404);
        await get(`/api/projects/${project.id}`, tokenB).expect(404);
      },
    );

    it("does not expose existence of a foreign DRAFT project", async () => {
      const draft = projects.addProject(userAId, { status: "DRAFT" });
      const missingRes = await request(app)
        .get(`/api/projects/${randomUUID()}`)
        .expect(404);
      const foreignRes = await get(`/api/projects/${draft.id}`, tokenB).expect(
        404,
      );

      expect(foreignRes.body.message).toBe(missingRes.body.message);
    });

    it("returns 404 when the project does not exist", async () => {
      await request(app).get(`/api/projects/${randomUUID()}`).expect(404);
    });

    it("returns 400 for a non-UUID project ID", async () => {
      await request(app).get("/api/projects/not-a-uuid").expect(400);
    });
  });

  // ── PATCH /api/projects/:projectId ───────────────────────────────────────────

  describe("PATCH /api/projects/:projectId", () => {
    it("updates the owner's scalar fields and returns 200", async () => {
      const project = projects.addProject(userAId, { title: "Original" });

      const res = await patch(`/api/projects/${project.id}`, tokenA, {
        title: "Renamed",
        location: "Hawassa",
        budget: "1200.5",
      }).expect(200);

      expect(res.body.data.project.title).toBe("Renamed");
      expect(res.body.data.project.location).toBe("Hawassa");
      expect(res.body.data.project.budget).toBe("1200.50");
    });

    it("replaces the full images array on update", async () => {
      const project = projects.addProject(userAId, {
        images: ["https://example.com/old.jpg"],
      });

      const res = await patch(`/api/projects/${project.id}`, tokenA, {
        images: ["https://example.com/new-1.jpg"],
      }).expect(200);

      expect(res.body.data.project.images).toEqual([
        "https://example.com/new-1.jpg",
      ]);
    });

    it("allows clearing optional fields via null", async () => {
      const project = projects.addProject(userAId, {
        description: "Before",
        budget: "100.00",
      });

      const res = await patch(`/api/projects/${project.id}`, tokenA, {
        description: null,
        budget: null,
      }).expect(200);

      expect(res.body.data.project.description).toBeNull();
      expect(res.body.data.project.budget).toBeNull();
    });

    it("returns 400 for an empty update body", async () => {
      const project = projects.addProject(userAId, {});
      await patch(`/api/projects/${project.id}`, tokenA, {}).expect(400);
    });

    it("returns 401 when unauthenticated", async () => {
      const project = projects.addProject(userAId, {});
      await request(app)
        .patch(`/api/projects/${project.id}`)
        .send({ title: "X" })
        .expect(401);
    });

    it("prevents a foreign user from updating (404, no leak)", async () => {
      const project = projects.addProject(userAId, { title: "Not yours" });

      await patch(`/api/projects/${project.id}`, tokenB, {
        title: "Hijacked",
      }).expect(404);

      const untouched = await get(`/api/projects/${project.id}`, tokenA).expect(
        200,
      );
      expect(untouched.body.data.project.title).toBe("Not yours");
    });

    it("returns 404 when the project does not exist", async () => {
      await patch(`/api/projects/${randomUUID()}`, tokenA, {
        title: "Ghost",
      }).expect(404);
    });

    it("returns 400 for unknown body fields", async () => {
      const project = projects.addProject(userAId, {});
      await patch(`/api/projects/${project.id}`, tokenA, {
        ownerId: userBId,
      }).expect(400);
    });
  });

  // ── PATCH /api/projects/:projectId/status ────────────────────────────────────

  describe("PATCH /api/projects/:projectId/status", () => {
    it("publishes a DRAFT project and stamps publishedAt", async () => {
      const project = projects.addProject(userAId, { status: "DRAFT" });

      const res = await patchStatus(project.id, tokenA, "PUBLISHED").expect(
        200,
      );

      expect(res.body.data.project.status).toBe("PUBLISHED");
      expect(res.body.data.project.publishedAt).not.toBeNull();
    });

    it("withdraws a PUBLISHED project back to DRAFT, preserving publishedAt", async () => {
      const original = new Date("2026-08-20T08:00:00.000Z");
      const project = projects.addProject(userAId, {
        status: "PUBLISHED",
        publishedAt: original,
      });

      const res = await patchStatus(project.id, tokenA, "DRAFT").expect(200);

      expect(res.body.data.project.status).toBe("DRAFT");
      expect(res.body.data.project.publishedAt).toBe(original.toISOString());
    });

    it.each([
      ["PUBLISHED", "IN_PROGRESS"],
      ["PUBLISHED", "CANCELLED"],
      ["IN_PROGRESS", "COMPLETED"],
      ["IN_PROGRESS", "CANCELLED"],
    ] as const)("transitions %s to %s", async (from, to) => {
      const project = projects.addProject(userAId, { status: from });

      const res = await patchStatus(project.id, tokenA, to).expect(200);
      expect(res.body.data.project.status).toBe(to);
    });

    it.each([
      ["DRAFT", "IN_PROGRESS"],
      ["DRAFT", "COMPLETED"],
      ["DRAFT", "CANCELLED"],
      ["COMPLETED", "PUBLISHED"],
      ["COMPLETED", "CANCELLED"],
      ["CANCELLED", "PUBLISHED"],
      ["IN_PROGRESS", "PUBLISHED"],
      ["IN_PROGRESS", "DRAFT"],
    ] as const)("rejects %s to %s with 400", async (from, to) => {
      const project = projects.addProject(userAId, { status: from });

      await patchStatus(project.id, tokenA, to).expect(400);

      const unchanged = await get(`/api/projects/${project.id}`, tokenA).expect(
        200,
      );
      expect(unchanged.body.data.project.status).toBe(from);
    });

    it("returns 401 when unauthenticated", async () => {
      const project = projects.addProject(userAId, { status: "DRAFT" });
      await request(app)
        .patch(`/api/projects/${project.id}/status`)
        .send({ status: "PUBLISHED" })
        .expect(401);
    });

    it("returns 404 for a foreign project without leaking existence", async () => {
      const foreign = projects.addProject(userBId, { status: "DRAFT" });

      await patchStatus(foreign.id, tokenA, "PUBLISHED").expect(404);
    });

    it("returns 400 for an unknown status value", async () => {
      const project = projects.addProject(userAId, { status: "DRAFT" });

      await patchStatus(project.id, tokenA, "ARCHIVED").expect(400);
    });

    it("returns 400 for a missing status field", async () => {
      const project = projects.addProject(userAId, { status: "DRAFT" });

      await request(app)
        .patch(`/api/projects/${project.id}/status`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({})
        .expect(400);
    });
  });

  // ── DELETE /api/projects/:projectId ──────────────────────────────────────────

  describe("DELETE /api/projects/:projectId", () => {
    it("deletes the owner's project; it becomes inaccessible everywhere", async () => {
      const project = projects.addProject(userAId, { status: "PUBLISHED" });

      await del(`/api/projects/${project.id}`, tokenA).expect(200);

      await get(`/api/projects/${project.id}`, tokenA).expect(404);
      await request(app).get(`/api/projects/${project.id}`).expect(404);
      const list = await get("/api/projects/me", tokenA).expect(200);
      expect(list.body.data.projects).toHaveLength(0);
    });

    it("removes deleted projects from the public search index", async () => {
      const project = projects.addProject(userAId, {
        title: "Doomed Villa",
        status: "PUBLISHED",
      });

      const before = await request(app)
        .get("/api/projects")
        .query({ search: "doomed villa" })
        .expect(200);
      expect(before.body.data.totalItems).toBe(1);

      await del(`/api/projects/${project.id}`, tokenA).expect(200);

      const after = await request(app)
        .get("/api/projects")
        .query({ search: "doomed villa" })
        .expect(200);
      expect(after.body.data.totalItems).toBe(0);
    });

    it("returns 401 when unauthenticated", async () => {
      const project = projects.addProject(userAId, {});
      await request(app).delete(`/api/projects/${project.id}`).expect(401);
    });

    it("prevents a foreign user from deleting (404, no leak)", async () => {
      const project = projects.addProject(userAId, {});

      await del(`/api/projects/${project.id}`, tokenB).expect(404);

      await get(`/api/projects/${project.id}`, tokenA).expect(200);
    });

    it("returns 404 when the project does not exist", async () => {
      await del(`/api/projects/${randomUUID()}`, tokenA).expect(404);
    });

    it("returns 400 for a non-UUID project ID", async () => {
      await del("/api/projects/not-a-uuid", tokenA).expect(400);
    });
  });

  // ── Seed helpers ──────────────────────────────────────────────────────────────

  /** Seeds all five statuses for owner A. */
  function seedOwnerAStatuses(options: { skipPublished?: boolean } = {}) {
    const statuses: ProjectStatus[] = [
      "DRAFT",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
    ];
    if (!options.skipPublished) {
      statuses.unshift("PUBLISHED");
    }
    for (const status of statuses) {
      projects.addProject(userAId, { status });
    }
  }

  function repo_addProjectForB() {
    return projects.addProject(userBId, { title: "Foreign Project" });
  }

  // ── Helper request functions ─────────────────────────────────────────────────

  function get(path: string, token: string) {
    return request(app).get(path).set("Authorization", `Bearer ${token}`);
  }

  function post(path: string, token: string, body: object) {
    return request(app)
      .post(path)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  function put(path: string, token: string, body: object) {
    return request(app)
      .put(path)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  function patch(path: string, token: string, body: object) {
    return request(app)
      .patch(path)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  function patchStatus(projectId: string, token: string, status: string) {
    return patch(`/api/projects/${projectId}/status`, token, { status });
  }

  function del(path: string, token: string) {
    return request(app)
      .delete(path)
      .set("Authorization", `Bearer ${token}`);
  }
});
