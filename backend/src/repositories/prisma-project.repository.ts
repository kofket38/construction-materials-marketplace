import {
  ProjectStatus as PrismaProjectStatus,
  Prisma,
  type PrismaClient,
} from "../prisma/generated/client.js";
import { ProjectReorderOwnershipError } from "./project.errors.js";
import type {
  CreateProjectInput,
  ProjectEntity,
  ProjectStatus,
  PublishedProjectQuery,
  PublishedProjectResult,
  ProjectRepository,
  UpdateProjectInput,
} from "./project.repository.js";

// ── Prisma select shape ───────────────────────────────────────────────────────

const projectSelect = {
  id: true,
  ownerId: true,
  title: true,
  description: true,
  projectType: true,
  location: true,
  budget: true,
  startDate: true,
  endDate: true,
  images: true,
  displayOrder: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Deterministic owner listing order: explicit position first, newest projects
 * next within the same position, project ID as the stable tie-breaker.
 */
function projectOrderBy(): Prisma.ProjectOrderByWithRelationInput[] {
  return [
    { displayOrder: "asc" },
    { createdAt: "desc" },
    { id: "asc" },
  ];
}

// ── Published query helpers ───────────────────────────────────────────────────

function publishedProjectWhere(
  query: PublishedProjectQuery,
): Prisma.ProjectWhereInput {
  return {
    // Security-critical: only published projects are discoverable. This
    // filter lives at the database-query level so DRAFT and non-published
    // lifecycle states can never leak through search, filters, or pagination.
    status: PrismaProjectStatus.PUBLISHED,
    ...(query.projectType !== undefined
      ? {
          projectType: {
            contains: query.projectType,
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...(query.search !== undefined
      ? {
          OR: [
            {
              title: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            {
              description: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            {
              location: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };
}

/** Most recently published first, project ID as the stable tie-breaker. */
function publishedProjectOrderBy(): Prisma.ProjectOrderByWithRelationInput[] {
  return [{ publishedAt: "desc" }, { id: "asc" }];
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapProject(
  row: Prisma.ProjectGetPayload<{ select: typeof projectSelect }>,
): ProjectEntity {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    description: row.description,
    projectType: row.projectType,
    location: row.location,
    budget: row.budget !== null ? row.budget.toFixed(2) : null,
    startDate: row.startDate,
    endDate: row.endDate,
    images: [...row.images],
    displayOrder: row.displayOrder,
    status: row.status as ProjectStatus,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Error detection ───────────────────────────────────────────────────────────

function hasPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

// ── Repository implementation ─────────────────────────────────────────────────

export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(input: CreateProjectInput): Promise<ProjectEntity> {
    const row = await this.client.project.create({
      data: {
        ownerId: input.ownerId,
        title: input.title.trim(),
        description: input.description ?? null,
        projectType: input.projectType ?? null,
        location: input.location ?? null,
        budget:
          input.budget === undefined
            ? null
            : input.budget === null
              ? null
              : new Prisma.Decimal(input.budget),
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        images: input.images ?? [],
        displayOrder: input.displayOrder ?? 0,
      },
      select: projectSelect,
    });

    return mapProject(row);
  }

  async findById(projectId: string): Promise<ProjectEntity | null> {
    const row = await this.client.project.findUnique({
      where: { id: projectId },
      select: projectSelect,
    });

    return row ? mapProject(row) : null;
  }

  async findByOwnerId(ownerId: string): Promise<ProjectEntity[]> {
    // Scoped by ownerId so only the owner's projects are ever returned.
    const rows = await this.client.project.findMany({
      where: { ownerId },
      select: projectSelect,
      orderBy: projectOrderBy(),
    });

    return rows.map(mapProject);
  }

  async countByOwner(ownerId: string): Promise<number> {
    return this.client.project.count({
      where: { ownerId },
    });
  }

  async update(
    projectId: string,
    ownerId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectEntity | null> {
    try {
      // Scoped by ownerId so projects belonging to other owners can never be
      // read or modified through this method.
      const row = await this.client.project.update({
        where: { id: projectId, ownerId },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.projectType !== undefined
            ? { projectType: input.projectType }
            : {}),
          ...(input.location !== undefined
            ? { location: input.location }
            : {}),
          ...(input.budget !== undefined
            ? {
                budget:
                  input.budget === null
                    ? null
                    : new Prisma.Decimal(input.budget),
              }
            : {}),
          ...(input.startDate !== undefined
            ? { startDate: input.startDate }
            : {}),
          ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
          ...(input.images !== undefined ? { images: input.images } : {}),
          ...(input.displayOrder !== undefined
            ? { displayOrder: input.displayOrder }
            : {}),
          ...(input.status !== undefined
            ? { status: input.status as PrismaProjectStatus }
            : {}),
          ...(input.publishedAt !== undefined
            ? { publishedAt: input.publishedAt }
            : {}),
        },
        select: projectSelect,
      });

      return mapProject(row);
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        return null;
      }

      throw error;
    }
  }

  async delete(projectId: string, ownerId: string): Promise<boolean> {
    try {
      // Scoped by ownerId for the same ownership reason as update.
      await this.client.project.delete({
        where: { id: projectId, ownerId },
      });

      return true;
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        return false;
      }

      throw error;
    }
  }

  async reorder(
    ownerId: string,
    orderedIds: string[],
  ): Promise<ProjectEntity[]> {
    return this.client.$transaction(async (tx) => {
      // Validate that the supplied list exactly matches the owner's projects.
      // Foreign, unknown, and duplicate IDs are all rejected before any write.
      const owned = await tx.project.findMany({
        where: { ownerId },
        select: { id: true },
      });

      const ownedIds = new Set(owned.map((row) => row.id));
      const suppliedIds = new Set(orderedIds);

      if (
        orderedIds.length !== owned.length ||
        suppliedIds.size !== orderedIds.length ||
        !orderedIds.every((id) => ownedIds.has(id))
      ) {
        throw new ProjectReorderOwnershipError();
      }

      for (let index = 0; index < orderedIds.length; index += 1) {
        const id = orderedIds[index]!;
        await tx.project.update({
          where: { id },
          data: { displayOrder: index },
        });
      }

      const rows = await tx.project.findMany({
        where: { ownerId },
        select: projectSelect,
        orderBy: projectOrderBy(),
      });

      return rows.map(mapProject);
    }, { timeout: 30_000, maxWait: 10_000 });
  }

  async searchPublished(
    query: PublishedProjectQuery,
  ): Promise<PublishedProjectResult> {
    const where = publishedProjectWhere(query);

    const [totalItems, rows] = await this.client.$transaction(
      [
        this.client.project.count({ where }),
        this.client.project.findMany({
          where,
          select: projectSelect,
          orderBy: publishedProjectOrderBy(),
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
      ],
      { timeout: 30_000 },
    );

    const totalPages = Math.ceil(totalItems / query.limit);

    return {
      projects: rows.map(mapProject),
      totalItems,
      totalPages,
      currentPage: query.page,
      pageSize: query.limit,
      hasNextPage: query.page < totalPages,
      hasPreviousPage: query.page > 1,
    };
  }
}
