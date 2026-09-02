import {
  ProjectStatus as PrismaProjectStatus,
  RfqStatus as PrismaRfqStatus,
  Prisma,
  type PrismaClient,
} from "../prisma/generated/client.js";
import {
  ProjectHasProcurementError,
  ProjectReorderOwnershipError,
} from "./project.errors.js";
import type { OrderStatus } from "./order.repository.js";
import type { RfqStatus } from "./rfq.repository.js";
import { SETTLED_ORDER_STATUSES } from "./project.repository.js";
import type {
  CreateProjectInput,
  ProjectEntity,
  ProjectOrderSummary,
  ProjectProcurementLoad,
  ProjectProcurementSummary,
  ProjectRfqSummary,
  ProjectStatus,
  PublicOwnerDetailInfo,
  PublicOwnerInfo,
  PublicProjectDetail,
  PublicProjectItem,
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
 * Public select for list cards: includes owner → professionalProfile via the
 * users relation. Deliberately excludes ownerId, displayOrder, updatedAt,
 * createdAt, and every private User/ProfessionalProfile field.
 */
const publicProjectCardSelect = {
  id: true,
  title: true,
  description: true,
  projectType: true,
  location: true,
  budget: true,
  startDate: true,
  endDate: true,
  images: true,
  status: true,
  publishedAt: true,
  owner: {
    select: {
      professionalProfile: {
        select: {
          id: true,
          displayName: true,
          headline: true,
          profession: true,
          avatarUrl: true,
          city: true,
          country: true,
          visibility: true,
        },
      },
    },
  },
} as const;

/**
 * Public select for the detail page: includes the richer professional
 * profile fields (region, website, linkedinUrl, specialties).
 */
const publicProjectDetailSelect = {
  id: true,
  title: true,
  description: true,
  projectType: true,
  location: true,
  budget: true,
  startDate: true,
  endDate: true,
  images: true,
  status: true,
  publishedAt: true,
  owner: {
    select: {
      professionalProfile: {
        select: {
          id: true,
          displayName: true,
          headline: true,
          profession: true,
          avatarUrl: true,
          city: true,
          region: true,
          country: true,
          website: true,
          linkedinUrl: true,
          yearsExperience: true,
          company: true,
          visibility: true,
          specialties: {
            select: { name: true },
            orderBy: { name: "asc" as const },
          },
        },
      },
    },
  },
} as const;

/**
 * Owner-private procurement selects. Only summary columns are read — no
 * quote pricing, no shipping details, no seller identities — because this
 * view exists to list and link, not to replace the RFQ/order detail
 * endpoints that apply their own authorization.
 */
const projectRfqSummarySelect = {
  id: true,
  title: true,
  status: true,
  deliveryLocation: true,
  expiresAt: true,
  createdAt: true,
  _count: { select: { items: true, quotes: true } },
} as const;

const projectOrderSummarySelect = {
  id: true,
  status: true,
  totalAmount: true,
  createdAt: true,
  _count: { select: { items: true } },
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
    ...(query.ownerId !== undefined ? { ownerId: query.ownerId } : {}),
    ...(query.projectType !== undefined
      ? {
          projectType: {
            contains: query.projectType,
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...(query.location !== undefined
      ? {
          location: {
            contains: query.location,
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

// ── Public mappers ────────────────────────────────────────────────────────────

type PublicCardRow = Prisma.ProjectGetPayload<{
  select: typeof publicProjectCardSelect;
}>;
type PublicDetailRow = Prisma.ProjectGetPayload<{
  select: typeof publicProjectDetailSelect;
}>;

function mapPublicCardBase(row: PublicCardRow | PublicDetailRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    projectType: row.projectType,
    location: row.location,
    budget: row.budget !== null ? row.budget.toFixed(2) : null,
    startDate: row.startDate,
    endDate: row.endDate,
    images: [...row.images],
    status: row.status as ProjectStatus,
    publishedAt: row.publishedAt,
  };
}

function mapPublicOwnerCard(
  profile: PublicCardRow["owner"]["professionalProfile"],
): PublicOwnerInfo | null {
  if (!profile || profile.visibility !== "PUBLIC") return null;
  return {
    profileId: profile.id,
    displayName: profile.displayName,
    headline: profile.headline,
    profession: profile.profession,
    avatarUrl: profile.avatarUrl,
    city: profile.city,
    country: profile.country,
  };
}

function mapPublicOwnerDetail(
  profile: PublicDetailRow["owner"]["professionalProfile"],
): PublicOwnerDetailInfo | null {
  if (!profile || profile.visibility !== "PUBLIC") return null;
  return {
    profileId: profile.id,
    displayName: profile.displayName,
    headline: profile.headline,
    profession: profile.profession,
    avatarUrl: profile.avatarUrl,
    city: profile.city,
    region: profile.region,
    country: profile.country,
    website: profile.website,
    linkedinUrl: profile.linkedinUrl,
    yearsExperience: profile.yearsExperience,
    company: profile.company,
    specialties: profile.specialties.map((s) => s.name),
  };
}

function mapPublicCard(row: PublicCardRow): PublicProjectItem {
  return {
    ...mapPublicCardBase(row),
    owner: mapPublicOwnerCard(row.owner.professionalProfile),
  };
}

function mapPublicDetail(row: PublicDetailRow): PublicProjectDetail {
  return {
    ...mapPublicCardBase(row),
    owner: mapPublicOwnerDetail(row.owner.professionalProfile),
  };
}

// ── Procurement summary helpers ───────────────────────────────────────────────

/**
 * Presents an OPEN-but-past-expiry RFQ as EXPIRED. The RFQ repository flips
 * the stored status lazily on its next read (expireOpenRfqs), so a
 * procurement summary read before that sweep would otherwise report a stale
 * OPEN. The in-memory repository mirrors this rule.
 */
function effectiveRfqStatus(status: RfqStatus, expiresAt: Date): RfqStatus {
  return status === "OPEN" && expiresAt.getTime() <= Date.now()
    ? "EXPIRED"
    : status;
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

      // The procurement foreign keys are ON DELETE RESTRICT, so PostgreSQL
      // refuses the delete while an RFQ or order still points at the project.
      if (hasPrismaCode(error, "P2003")) {
        throw new ProjectHasProcurementError();
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
          select: publicProjectCardSelect,
          orderBy: publishedProjectOrderBy(),
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
      ],
      { timeout: 30_000 },
    );

    const totalPages = Math.ceil(totalItems / query.limit);

    return {
      projects: rows.map(mapPublicCard),
      totalItems,
      totalPages,
      currentPage: query.page,
      pageSize: query.limit,
      hasNextPage: query.page < totalPages,
      hasPreviousPage: query.page > 1,
    };
  }

  async findPublicById(projectId: string): Promise<PublicProjectDetail | null> {
    const row = await this.client.project.findUnique({
      where: {
        id: projectId,
        // Security: only return PUBLISHED projects through this method.
        // Non-published projects are invisible to public consumers.
        status: PrismaProjectStatus.PUBLISHED,
      },
      select: publicProjectDetailSelect,
    });

    return row ? mapPublicDetail(row) : null;
  }

  async findProcurement(
    projectId: string,
  ): Promise<ProjectProcurementSummary> {
    // Both lists are keyed on projectId and ordered newest first, which is
    // exactly the shape of the (projectId, createdAt) indexes added for this
    // read path. Read-only, so no transaction is needed.
    const [rfqRows, orderRows] = await Promise.all([
      this.client.requestForQuote.findMany({
        where: { projectId },
        select: projectRfqSummarySelect,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
      this.client.order.findMany({
        where: { projectId },
        select: projectOrderSummarySelect,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
    ]);

    return {
      rfqs: rfqRows.map(
        (row): ProjectRfqSummary => ({
          id: row.id,
          title: row.title,
          status: effectiveRfqStatus(row.status as RfqStatus, row.expiresAt),
          deliveryLocation: row.deliveryLocation,
          itemCount: row._count.items,
          quoteCount: row._count.quotes,
          expiresAt: row.expiresAt,
          createdAt: row.createdAt,
        }),
      ),
      orders: orderRows.map(
        (row): ProjectOrderSummary => ({
          id: row.id,
          status: row.status as OrderStatus,
          totalAmount: row.totalAmount.toFixed(2),
          itemCount: row._count.items,
          createdAt: row.createdAt,
        }),
      ),
    };
  }

  async countActiveProcurement(
    projectId: string,
  ): Promise<ProjectProcurementLoad> {
    const [openRfqs, activeOrders] = await Promise.all([
      this.client.requestForQuote.count({
        where: {
          projectId,
          status: PrismaRfqStatus.OPEN,
          // An OPEN RFQ past its expiry is domain-expired; the RFQ repository
          // flips it lazily on its next read. Excluding it here keeps a stale
          // row from blocking project completion forever.
          expiresAt: { gt: new Date() },
        },
      }),
      this.client.order.count({
        where: {
          projectId,
          status: { notIn: [...SETTLED_ORDER_STATUSES] },
        },
      }),
    ]);

    return { openRfqs, activeOrders };
  }

  async detachRfq(projectId: string, rfqId: string): Promise<boolean> {
    // updateMany with both keys in the predicate: an RFQ attached to a
    // different project (or to none) matches nothing, so a project owner can
    // only ever clear links that belong to the project they proved they own.
    const { count } = await this.client.requestForQuote.updateMany({
      where: { id: rfqId, projectId },
      data: { projectId: null },
    });

    return count > 0;
  }

  async detachOrder(projectId: string, orderId: string): Promise<boolean> {
    const { count } = await this.client.order.updateMany({
      where: { id: orderId, projectId },
      data: { projectId: null },
    });

    return count > 0;
  }
}
