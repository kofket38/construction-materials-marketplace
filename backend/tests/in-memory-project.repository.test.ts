import { beforeEach, describe, expect, it } from "vitest";
import { ProjectReorderOwnershipError } from "../src/repositories/project.errors.js";
import type { ProjectEntity } from "../src/repositories/project.repository.js";
import { InMemoryProjectRepository } from "./helpers/in-memory-project.repository.js";

// ── Fixed IDs ─────────────────────────────────────────────────────────────────
const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";

describe("InMemoryProjectRepository", () => {
  let repo: InMemoryProjectRepository;

  beforeEach(() => {
    repo = new InMemoryProjectRepository();
  });

  // ── A. Creation ─────────────────────────────────────────────────────────────

  describe("creation", () => {
    it("creates a project owned by the supplied user", async () => {
      const project = await repo.create({
        ownerId: ownerA,
        title: "G+2 Villa Construction",
      });

      expect(project.id).toBeTruthy();
      expect(project.ownerId).toBe(ownerA);
      expect(project.title).toBe("G+2 Villa Construction");
    });

    it("defaults new projects to DRAFT status", async () => {
      const project = await repo.create({
        ownerId: ownerA,
        title: "Warehouse Build",
      });

      expect(project.status).toBe("DRAFT");
      expect(project.publishedAt).toBeNull();
    });

    it("defaults displayOrder to 0 and images to an empty array", async () => {
      const project = await repo.create({
        ownerId: ownerA,
        title: "Road Works",
      });

      expect(project.displayOrder).toBe(0);
      expect(project.images).toEqual([]);
    });

    it("trims whitespace from title on create", async () => {
      const project = await repo.create({
        ownerId: ownerA,
        title: "  Bridge Repair  ",
      });

      expect(project.title).toBe("Bridge Repair");
    });
  });

  // ── B. Ownership ────────────────────────────────────────────────────────────

  describe("ownership scoping", () => {
    it("lets the owner retrieve their own project", async () => {
      const created = await repo.create({
        ownerId: ownerA,
        title: "Owned Project",
      });

      const found = await repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.ownerId).toBe(ownerA);
    });

    it("returns null for a project ID that does not exist", async () => {
      expect(
        await repo.findById("00000000-0000-4000-8000-000000000099"),
      ).toBeNull();
    });

    it("refuses to mutate another owner's project", async () => {
      const created = await repo.create({
        ownerId: ownerA,
        title: "Not Yours",
      });

      const result = await repo.update(created.id, ownerB, {
        title: "Hijacked",
      });

      expect(result).toBeNull();

      const untouched = await repo.findById(created.id);
      expect(untouched!.title).toBe("Not Yours");
    });

    it("applies scoped updates for the owning user", async () => {
      const created = await repo.create({
        ownerId: ownerA,
        title: "Original",
        description: "Before",
      });

      const updated = await repo.update(created.id, ownerA, {
        title: "Renamed",
        description: null,
      });

      expect(updated).not.toBeNull();
      expect(updated!.title).toBe("Renamed");
      expect(updated!.description).toBeNull();
    });

    it("refuses to delete another owner's project", async () => {
      const created = await repo.create({
        ownerId: ownerA,
        title: "Still There",
      });

      expect(await repo.delete(created.id, ownerB)).toBe(false);

      const stillThere = await repo.findById(created.id);
      expect(stillThere).not.toBeNull();
    });

    it("deletes scoped to the owning user", async () => {
      const created = await repo.create({
        ownerId: ownerA,
        title: "Doomed",
      });

      expect(await repo.delete(created.id, ownerA)).toBe(true);
      expect(await repo.findById(created.id)).toBeNull();
    });

    it("isolates counts per owner", async () => {
      await repo.create({ ownerId: ownerA, title: "A1" });
      await repo.create({ ownerId: ownerA, title: "A2" });
      await repo.create({ ownerId: ownerB, title: "B1" });

      expect(await repo.countByOwner(ownerA)).toBe(2);
      expect(await repo.countByOwner(ownerB)).toBe(1);
    });
  });

  // ── C. Ordering ─────────────────────────────────────────────────────────────

  describe("owner listing order", () => {
    it("orders by displayOrder ascending", async () => {
      await repo.addProject(ownerA, { title: "Late", displayOrder: 5 });
      await repo.addProject(ownerA, { title: "Early", displayOrder: 1 });

      const projects = await repo.findByOwnerId(ownerA);

      expect(projects.map((p) => p.title)).toEqual(["Early", "Late"]);
    });

    it("breaks displayOrder ties with newest first", async () => {
      await repo.addProject(ownerA, {
        title: "Older",
        displayOrder: 0,
        createdAt: new Date("2026-08-01T10:00:00.000Z"),
      });
      await repo.addProject(ownerA, {
        title: "Newer",
        displayOrder: 0,
        createdAt: new Date("2026-08-02T10:00:00.000Z"),
      });

      const projects = await repo.findByOwnerId(ownerA);

      expect(projects.map((p) => p.title)).toEqual(["Newer", "Older"]);
    });

    it("uses the project ID as the final deterministic tie-breaker", async () => {
      const sameTime = new Date("2026-08-01T10:00:00.000Z");
      const first = repo.addProject(ownerA, {
        title: "First",
        createdAt: sameTime,
        updatedAt: sameTime,
      });
      const second = repo.addProject(ownerA, {
        title: "Second",
        createdAt: sameTime,
        updatedAt: sameTime,
      });

      const expected = [first.id, second.id].sort();
      const projects = await repo.findByOwnerId(ownerA);

      expect(projects.map((p) => p.id)).toEqual(expected);
    });

    it("never returns another owner's projects", async () => {
      repo.addProject(ownerB, { title: "Foreign" });
      repo.addProject(ownerA, { title: "Mine" });

      const projects = await repo.findByOwnerId(ownerA);

      expect(projects).toHaveLength(1);
      expect(projects[0]!.title).toBe("Mine");
    });
  });

  // ── D. Reorder ──────────────────────────────────────────────────────────────

  describe("reorder", () => {
    let first: ProjectEntity;
    let second: ProjectEntity;
    let third: ProjectEntity;

    beforeEach(() => {
      first = repo.addProject(ownerA, { title: "First", displayOrder: 0 });
      second = repo.addProject(ownerA, { title: "Second", displayOrder: 1 });
      third = repo.addProject(ownerA, { title: "Third", displayOrder: 2 });
    });

    it("applies the supplied order for a valid owner", async () => {
      const reordered = await repo.reorder(ownerA, [
        third.id,
        first.id,
        second.id,
      ]);

      expect(reordered.map((p) => p.id)).toEqual([
        third.id,
        first.id,
        second.id,
      ]);
      expect(reordered.map((p) => p.displayOrder)).toEqual([0, 1, 2]);
    });

    it("rejects IDs belonging to another owner", async () => {
      const foreign = repo.addProject(ownerB, { title: "Foreign" });

      await expect(
        repo.reorder(ownerA, [third.id, second.id, foreign.id]),
      ).rejects.toBeInstanceOf(ProjectReorderOwnershipError);
    });

    it("leaves ordering completely untouched when the reorder is rejected", async () => {
      const foreign = repo.addProject(ownerB, { title: "Foreign" });

      await expect(
        repo.reorder(ownerA, [foreign.id, second.id, third.id]),
      ).rejects.toBeInstanceOf(ProjectReorderOwnershipError);

      const projects = await repo.findByOwnerId(ownerA);
      expect(projects.map((p) => p.displayOrder)).toEqual([0, 1, 2]);
    });

    it("rejects unknown IDs", async () => {
      await expect(
        repo.reorder(ownerA, [
          first.id,
          second.id,
          "00000000-0000-4000-8000-000000000099",
        ]),
      ).rejects.toBeInstanceOf(ProjectReorderOwnershipError);
    });

    it("rejects duplicate IDs within the supplied list", async () => {
      await expect(
        repo.reorder(ownerA, [first.id, second.id, second.id]),
      ).rejects.toBeInstanceOf(ProjectReorderOwnershipError);
    });

    it("rejects partial lists that do not cover every owned project", async () => {
      await expect(repo.reorder(ownerA, [third.id])).rejects.toBeInstanceOf(
        ProjectReorderOwnershipError,
      );
    });

    it("accepts an empty list only when the owner has no projects", async () => {
      await expect(
        repo.reorder(ownerA, []),
      ).rejects.toBeInstanceOf(ProjectReorderOwnershipError);
      await expect(repo.reorder(ownerB, [])).resolves.toEqual([]);
    });
  });

  // ── E. Published search ─────────────────────────────────────────────────────

  describe("searchPublished", () => {
    beforeEach(() => {
      repo.addProject(ownerA, {
        title: "Villa Complex",
        description: "Luxury residential build",
        location: "Addis Ababa",
        projectType: "Residential",
        status: "PUBLISHED",
        publishedAt: new Date("2026-08-20T09:00:00.000Z"),
      });
      repo.addProject(ownerB, {
        title: "Office Tower",
        description: "Commercial high-rise",
        location: "Hawassa",
        projectType: "Commercial",
        status: "PUBLISHED",
        publishedAt: new Date("2026-08-25T09:00:00.000Z"),
      });
      repo.addProject(ownerA, {
        title: "Secret Villa Draft",
        description: "Match me if you can",
        status: "DRAFT",
      });
      repo.addProject(ownerB, {
        title: "Bridge Job",
        status: "IN_PROGRESS",
      });
      repo.addProject(ownerA, {
        title: "Old Shed",
        status: "COMPLETED",
      });
      repo.addProject(ownerB, {
        title: "Cancelled Depot",
        status: "CANCELLED",
      });
    });

    it("returns only PUBLISHED projects", async () => {
      const result = await repo.searchPublished({ page: 1, limit: 10 });

      expect(result.totalItems).toBe(2);
      expect(result.projects.map((p) => p.status)).toEqual([
        "PUBLISHED",
        "PUBLISHED",
      ]);
    });

    it("never exposes DRAFT projects even when filters match them", async () => {
      const result = await repo.searchPublished({
        page: 1,
        limit: 10,
        search: "match me if you can",
      });

      expect(result.projects).toHaveLength(0);
      expect(result.totalItems).toBe(0);
    });

    it("excludes IN_PROGRESS, COMPLETED, and CANCELLED projects", async () => {
      const result = await repo.searchPublished({
        page: 1,
        limit: 10,
        search: "bridge job old shed cancelled depot",
      });

      expect(result.projects).toHaveLength(0);
    });

    it("filters by search across title, description, and location", async () => {
      const byTitle = await repo.searchPublished({
        page: 1,
        limit: 10,
        search: "villa complex",
      });
      const byDescription = await repo.searchPublished({
        page: 1,
        limit: 10,
        search: "high-rise",
      });
      const byLocation = await repo.searchPublished({
        page: 1,
        limit: 10,
        search: "hawassa",
      });

      expect(byTitle.projects.map((p) => p.title)).toEqual(["Villa Complex"]);
      expect(byDescription.projects.map((p) => p.title)).toEqual([
        "Office Tower",
      ]);
      expect(byLocation.projects.map((p) => p.title)).toEqual([
        "Office Tower",
      ]);
    });

    it("filters by projectType case-insensitively", async () => {
      const result = await repo.searchPublished({
        page: 1,
        limit: 10,
        projectType: "commercial",
      });

      expect(result.projects.map((p) => p.title)).toEqual(["Office Tower"]);
    });

    it("paginates with most recently published first", async () => {
      const page1 = await repo.searchPublished({ page: 1, limit: 1 });
      const page2 = await repo.searchPublished({ page: 2, limit: 1 });

      expect(page1.projects.map((p) => p.title)).toEqual(["Office Tower"]);
      expect(page2.projects.map((p) => p.title)).toEqual(["Villa Complex"]);
      expect(page1.hasNextPage).toBe(true);
      expect(page1.hasPreviousPage).toBe(false);
      expect(page2.hasNextPage).toBe(false);
      expect(page2.hasPreviousPage).toBe(true);
      expect(page1.totalPages).toBe(2);
      expect(page1.currentPage).toBe(1);
      expect(page1.pageSize).toBe(1);
    });
  });

  // ── G. Image arrays ─────────────────────────────────────────────────────────

  describe("image array defensiveness", () => {
    it("does not retain the caller-supplied array on create", async () => {
      const source = ["https://example.com/a.jpg"];
      const project = await repo.create({
        ownerId: ownerA,
        title: "Snapshot Isolation",
        images: source,
      });

      source.push("https://example.com/late.jpg");

      expect(project.images).toEqual(["https://example.com/a.jpg"]);
      expect((await repo.findById(project.id))!.images).toEqual([
        "https://example.com/a.jpg",
      ]);
    });

    it("does not retain the caller-supplied array on update", async () => {
      const project = await repo.create({
        ownerId: ownerA,
        title: "Update Isolation",
      });
      const replacement = ["https://example.com/new.jpg"];

      await repo.update(project.id, ownerA, { images: replacement });
      replacement.push("https://example.com/sneaky.jpg");

      expect((await repo.findById(project.id))!.images).toEqual([
        "https://example.com/new.jpg",
      ]);
    });

    it("returns defensive copies so reads cannot corrupt stored state", async () => {
      const project = await repo.create({
        ownerId: ownerA,
        title: "Read Isolation",
        images: ["https://example.com/keep.jpg"],
      });

      const firstRead = await repo.findById(project.id);
      firstRead!.images.push("https://example.com/mutated.jpg");

      const secondRead = await repo.findById(project.id);
      expect(secondRead!.images).toEqual(["https://example.com/keep.jpg"]);

      const listed = await repo.findByOwnerId(ownerA);
      expect(listed[0]!.images).toEqual(["https://example.com/keep.jpg"]);
    });

    it("isolates projects created from the same source array", async () => {
      const shared = ["https://example.com/shared.jpg"];
      const alpha = await repo.create({
        ownerId: ownerA,
        title: "Alpha",
        images: shared,
      });
      const beta = await repo.create({
        ownerId: ownerA,
        title: "Beta",
        images: shared,
      });

      await repo.update(alpha.id, ownerA, {
        images: [...alpha.images, "https://example.com/only-alpha.jpg"],
      });

      expect((await repo.findById(beta.id))!.images).toEqual([
        "https://example.com/shared.jpg",
      ]);
    });
  });
});
