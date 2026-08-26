import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryProjectRepository } from "./helpers/in-memory-project.repository.js";
import { ProjectService } from "../src/services/project.service.js";
import type { AuthenticatedUser } from "../src/types/auth.js";
import { BadRequestError, NotFoundError } from "../src/utils/api-error.js";

// ── Fixed IDs / actors ────────────────────────────────────────────────────────
const ownerAId = "00000000-0000-4000-8000-000000000001";
const ownerBId = "00000000-0000-4000-8000-000000000002";

const ownerA: AuthenticatedUser = { userId: ownerAId, role: "CUSTOMER" };
const ownerB: AuthenticatedUser = { userId: ownerBId, role: "CUSTOMER" };

const validCreateBody = {
  title: "G+2 Villa Construction",
  description: "Full structural build.",
  projectType: "Residential",
  location: "Addis Ababa",
  budget: "250000.50",
  images: ["https://example.com/site.jpg"],
  displayOrder: 3,
};

describe("ProjectService", () => {
  let repo: InMemoryProjectRepository;
  let service: ProjectService;

  beforeEach(() => {
    repo = new InMemoryProjectRepository();
    service = new ProjectService(repo);
  });

  // ── createProject ───────────────────────────────────────────────────────────

  describe("createProject", () => {
    it("creates a project owned by the actor with supplied fields", async () => {
      const project = await service.createProject(ownerA, validCreateBody);

      expect(project.ownerId).toBe(ownerAId);
      expect(project.title).toBe("G+2 Villa Construction");
      expect(project.budget).toBe("250000.50");
      expect(project.displayOrder).toBe(3);
      expect(project.images).toEqual(["https://example.com/site.jpg"]);
    });

    it("creates new projects in DRAFT status without publishedAt", async () => {
      const project = await service.createProject(ownerA, validCreateBody);

      expect(project.status).toBe("DRAFT");
      expect(project.publishedAt).toBeNull();
    });
  });

  // ── Ownership ───────────────────────────────────────────────────────────────

  describe("ownership isolation", () => {
    it("lets the owner read their own project via getMyProject", async () => {
      const created = await service.createProject(ownerA, validCreateBody);

      const project = await service.getMyProject(ownerA, created.id);
      expect(project.id).toBe(created.id);
    });

    it("masks foreign projects as missing on privileged reads", async () => {
      const foreign = await service.createProject(ownerB, validCreateBody);

      await expect(service.getMyProject(ownerA, foreign.id)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("masks foreign updates as missing and never mutates them", async () => {
      const foreign = await service.createProject(ownerB, validCreateBody);

      await expect(
        service.updateProject(ownerA, foreign.id, { title: "Hijacked" }),
      ).rejects.toBeInstanceOf(NotFoundError);

      const untouched = await repo.findById(foreign.id);
      expect(untouched!.title).toBe("G+2 Villa Construction");
    });

    it("masks foreign deletes as missing and never removes them", async () => {
      const foreign = await service.createProject(ownerB, validCreateBody);

      await expect(
        service.deleteProject(ownerA, foreign.id),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(await repo.findById(foreign.id)).not.toBeNull();
    });

    it("reports unknown project IDs as missing", async () => {
      await expect(
        service.getMyProject(ownerA, "00000000-0000-4000-8000-000000000099"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  // ── Public detail visibility ────────────────────────────────────────────────

  describe("getProject visibility", () => {
    it("returns a PUBLISHED project to an anonymous caller", async () => {
      const project = repo.addProject(ownerAId, { status: "PUBLISHED" });

      const found = await service.getProject(null, project.id);
      expect(found.id).toBe(project.id);
    });

    it("returns a PUBLISHED project to a foreign authenticated user", async () => {
      const project = repo.addProject(ownerAId, { status: "PUBLISHED" });

      const found = await service.getProject(ownerB, project.id);
      expect(found.id).toBe(project.id);
    });

    it.each(["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const)(
      "hides a %s project from anonymous callers",
      async (status) => {
        const project = repo.addProject(ownerAId, { status });

        await expect(service.getProject(null, project.id)).rejects.toBeInstanceOf(
          NotFoundError,
        );
      },
    );

    it.each(["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const)(
      "hides a %s project from foreign authenticated users",
      async (status) => {
        const project = repo.addProject(ownerAId, { status });

        await expect(
          service.getProject(ownerB, project.id),
        ).rejects.toBeInstanceOf(NotFoundError);
      },
    );

    it("returns any-status projects to their owner", async () => {
      for (const status of [
        "DRAFT",
        "PUBLISHED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ] as const) {
        const project = repo.addProject(ownerAId, { status });
        const found = await service.getProject(ownerA, project.id);
        expect(found.status).toBe(status);
      }
    });
  });

  // ── Lifecycle state machine ─────────────────────────────────────────────────

  describe("changeProjectStatus lifecycle", () => {
    it.each([
      ["DRAFT", "PUBLISHED"],
      ["PUBLISHED", "DRAFT"],
      ["PUBLISHED", "IN_PROGRESS"],
      ["PUBLISHED", "CANCELLED"],
      ["IN_PROGRESS", "COMPLETED"],
      ["IN_PROGRESS", "CANCELLED"],
    ] as const)(
      "allows %s to %s",
      async (from, to) => {
        const project = repo.addProject(ownerAId, { status: from });

        const updated = await service.changeProjectStatus(ownerA, project.id, {
          status: to,
        });

        expect(updated.status).toBe(to);
      },
    );

    it.each([
      ["DRAFT", "IN_PROGRESS"],
      ["DRAFT", "COMPLETED"],
      ["DRAFT", "CANCELLED"],
      ["COMPLETED", "DRAFT"],
      ["COMPLETED", "PUBLISHED"],
      ["COMPLETED", "IN_PROGRESS"],
      ["COMPLETED", "CANCELLED"],
      ["CANCELLED", "DRAFT"],
      ["CANCELLED", "PUBLISHED"],
      ["CANCELLED", "IN_PROGRESS"],
      ["CANCELLED", "COMPLETED"],
      ["IN_PROGRESS", "DRAFT"],
      ["IN_PROGRESS", "PUBLISHED"],
    ] as const)(
      "rejects %s to %s",
      async (from, to) => {
        const project = repo.addProject(ownerAId, { status: from });

        await expect(
          service.changeProjectStatus(ownerA, project.id, { status: to }),
        ).rejects.toBeInstanceOf(BadRequestError);

        const unchanged = await repo.findById(project.id);
        expect(unchanged!.status).toBe(from);
      },
    );

    it("stamps publishedAt on first publication only", async () => {
      const project = repo.addProject(ownerAId, { status: "DRAFT" });
      expect(project.publishedAt).toBeNull();

      const before = Date.now() - 1;
      const published = await service.changeProjectStatus(
        ownerA,
        project.id,
        { status: "PUBLISHED" },
      );
      const after = Date.now() + 1;

      expect(published.publishedAt).not.toBeNull();
      expect(published.publishedAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(published.publishedAt!.getTime()).toBeLessThanOrEqual(after);
    });

    it("withdraws to DRAFT while preserving the original publishedAt", async () => {
      const original = new Date("2026-08-20T08:00:00.000Z");
      const project = repo.addProject(ownerAId, {
        status: "PUBLISHED",
        publishedAt: original,
      });

      const withdrawn = await service.changeProjectStatus(
        ownerA,
        project.id,
        { status: "DRAFT" },
      );
      expect(withdrawn.status).toBe("DRAFT");
      expect(withdrawn.publishedAt).toEqual(original);
    });

    it("keeps the original publishedAt when re-publishing a withdrawn project", async () => {
      const original = new Date("2026-08-20T08:00:00.000Z");
      const project = repo.addProject(ownerAId, {
        status: "DRAFT",
        publishedAt: original,
      });

      const republished = await service.changeProjectStatus(
        ownerA,
        project.id,
        { status: "PUBLISHED" },
      );

      expect(republished.publishedAt).toEqual(original);
    });

    it("preserves publishedAt through PUBLISHED to IN_PROGRESS", async () => {
      const original = new Date("2026-08-20T08:00:00.000Z");
      const project = repo.addProject(ownerAId, {
        status: "PUBLISHED",
        publishedAt: original,
      });

      const updated = await service.changeProjectStatus(
        ownerA,
        project.id,
        { status: "IN_PROGRESS" },
      );

      expect(updated.publishedAt).toEqual(original);
    });

    it("masks foreign status changes as missing", async () => {
      const foreign = repo.addProject(ownerBId, { status: "DRAFT" });

      await expect(
        service.changeProjectStatus(ownerA, foreign.id, {
          status: "PUBLISHED",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);

      const unchanged = await repo.findById(foreign.id);
      expect(unchanged!.status).toBe("DRAFT");
    });
  });

  // ── Reorder ─────────────────────────────────────────────────────────────────

  describe("reorderProjects", () => {
    let alpha: ReturnType<InMemoryProjectRepository["addProject"]>;
    let beta: ReturnType<InMemoryProjectRepository["addProject"]>;

    beforeEach(() => {
      alpha = repo.addProject(ownerAId, { title: "Alpha", displayOrder: 0 });
      beta = repo.addProject(ownerAId, { title: "Beta", displayOrder: 1 });
    });

    it("reorders own projects and persists the new order", async () => {
      const reordered = await service.reorderProjects(ownerA, {
        projectIds: [beta.id, alpha.id],
      });

      expect(reordered.map((p) => p.id)).toEqual([beta.id, alpha.id]);
      expect(reordered.map((p) => p.displayOrder)).toEqual([0, 1]);
    });

    it("rejects incomplete ID lists without changing anything", async () => {
      await expect(
        service.reorderProjects(ownerA, { projectIds: [alpha.id] }),
      ).rejects.toBeInstanceOf(BadRequestError);

      const projects = await service.getMyProjects(ownerA);
      expect(projects.map((p) => p.displayOrder)).toEqual([0, 1]);
    });

    it("rejects foreign IDs", async () => {
      const foreign = repo.addProject(ownerBId, { title: "Foreign" });

      await expect(
        service.reorderProjects(ownerA, {
          projectIds: [alpha.id, beta.id, foreign.id],
        }),
      ).rejects.toBeInstanceOf(BadRequestError);
    });

    it("rejects duplicate IDs", async () => {
      await expect(
        service.reorderProjects(ownerA, {
          projectIds: [alpha.id, alpha.id],
        }),
      ).rejects.toBeInstanceOf(BadRequestError);
    });
  });

  // ── Lists and search ────────────────────────────────────────────────────────

  describe("lists and search", () => {
    it("returns all own statuses ordered by displayOrder", async () => {
      repo.addProject(ownerAId, { title: "Late", displayOrder: 5 });
      repo.addProject(ownerAId, {
        title: "Early",
        displayOrder: 1,
        status: "COMPLETED",
      });
      repo.addProject(ownerBId, { title: "Foreign", displayOrder: 0 });

      const projects = await service.getMyProjects(ownerA);

      expect(projects.map((p) => p.title)).toEqual(["Early", "Late"]);
    });

    it("defaults public search pagination and forwards filters", async () => {
      repo.addProject(ownerAId, {
        title: "Villa",
        status: "PUBLISHED",
      });
      repo.addProject(ownerAId, { title: "Secret Draft", status: "DRAFT" });

      const result = await service.searchPublishedProjects({});

      expect(result.totalItems).toBe(1);
      expect(result.projects[0]!.title).toBe("Villa");
    });

    it("cannot leak drafts through public search filters", async () => {
      repo.addProject(ownerAId, {
        title: "Secret Villa Draft",
        status: "DRAFT",
      });

      const result = await service.searchPublishedProjects({
        search: "secret villa draft",
      });

      expect(result.projects).toHaveLength(0);
    });
  });

  // ── CRUD passthrough ────────────────────────────────────────────────────────

  describe("update and delete", () => {
    it("updates scalar fields and replaces image arrays", async () => {
      const created = await service.createProject(ownerA, validCreateBody);

      const updated = await service.updateProject(ownerA, created.id, {
        title: "Renamed Villa",
        budget: null,
        images: ["https://example.com/new.jpg"],
      });

      expect(updated.title).toBe("Renamed Villa");
      expect(updated.budget).toBeNull();
      expect(updated.images).toEqual(["https://example.com/new.jpg"]);
      expect(updated.status).toBe("DRAFT");
    });

    it("deletes own projects; deleted projects become inaccessible", async () => {
      const created = await service.createProject(ownerA, validCreateBody);

      await service.deleteProject(ownerA, created.id);

      await expect(
        service.getMyProject(ownerA, created.id),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        service.getProject(null, created.id),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
