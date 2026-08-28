import { z } from "zod";

// ── Reusable field schemas ─────────────────────────────────────────────────────

const titleSchema = z
  .string()
  .trim()
  .min(1, "Title is required.")
  .max(200, "Title must be 200 characters or fewer.");

const descriptionSchema = z
  .string()
  .trim()
  .max(2000, "Description must be 2000 characters or fewer.")
  .nullable()
  .optional();

const projectTypeSchema = z
  .string()
  .trim()
  .max(150, "Project type must be 150 characters or fewer.")
  .nullable()
  .optional();

const locationSchema = z
  .string()
  .trim()
  .max(200, "Location must be 200 characters or fewer.")
  .nullable()
  .optional();

/**
 * Non-negative monetary amount matching the repository's Decimal(14,2) budget
 * column. Accepts numbers or numeric strings and normalises to a fixed
 * two-decimal string, mirroring product price validation.
 */
const budgetSchema = z
  .union([z.string().trim(), z.number().finite()])
  .transform((value) => String(value))
  .refine(
    (value) => /^\d{1,12}(?:\.\d{1,2})?$/.test(value),
    "Budget must be a non-negative amount with at most two decimal places.",
  )
  .transform((value) => Number(value).toFixed(2));

const budgetNullableSchema = z.union([budgetSchema, z.null()]).optional();

const startDateSchema = z.coerce
  .date({ message: "Start date must be a valid date." })
  .nullable()
  .optional();

const endDateSchema = z.coerce
  .date({ message: "End date must be a valid date." })
  .nullable()
  .optional();

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const imagesSchema = z
  .array(
    z
      .string()
      .trim()
      .url("Each image must be a valid URL.")
      .max(500, "Each image URL must be 500 characters or fewer.")
      .refine(isHttpUrl, "Each image URL must use HTTP or HTTPS."),
  )
  .max(8, "A project may have at most 8 images.")
  .optional();

const displayOrderSchema = z
  .number()
  .int("Display order must be a whole number.")
  .min(0, "Display order cannot be negative.")
  .max(1_000_000, "Display order is too large.")
  .optional();

// ── Status transition ─────────────────────────────────────────────────────────

export const projectStatusSchema = z.enum([
  "DRAFT",
  "PUBLISHED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const changeProjectStatusBodySchema = z
  .object({ status: projectStatusSchema })
  .strict();

// ── Reorder ───────────────────────────────────────────────────────────────────

export const reorderProjectsBodySchema = z
  .object({
    projectIds: z
      .array(z.string().uuid("Each project ID must be a valid UUID."))
      .max(10_000, "Too many project IDs supplied."),
  })
  .strict();

// ── Project schemas ───────────────────────────────────────────────────────────

export const createProjectBodySchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema,
    projectType: projectTypeSchema,
    location: locationSchema,
    budget: budgetNullableSchema,
    startDate: startDateSchema,
    endDate: endDateSchema,
    images: imagesSchema,
    displayOrder: displayOrderSchema,
  })
  .strict();

export const updateProjectBodySchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema,
    projectType: projectTypeSchema,
    location: locationSchema,
    budget: budgetNullableSchema,
    startDate: startDateSchema,
    endDate: endDateSchema,
    images: imagesSchema,
    displayOrder: displayOrderSchema,
  })
  .strict()
  .refine(
    (body) => Object.keys(body).length > 0,
    "At least one field must be provided.",
  );

// ── Public search query schema ────────────────────────────────────────────────

const positiveIntegerQuerySchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Must be a positive integer.");

const projectSearchSchema = z
  .string()
  .max(200, "Search must be 200 characters or fewer.")
  .refine(
    (value) => value.trim().length > 0,
    "Search cannot contain only whitespace.",
  );

const projectTypeFilterSchema = z
  .string()
  .trim()
  .min(1, "Project type filter cannot be empty.")
  .max(150, "Project type filter must be 150 characters or fewer.");

const locationFilterSchema = z
  .string()
  .trim()
  .min(1, "Location filter cannot be empty.")
  .max(200, "Location filter must be 200 characters or fewer.");

const ownerIdFilterSchema = z
  .string()
  .uuid("ownerId must be a valid UUID.");

export const listPublishedProjectsQuerySchema = z
  .object({
    page: positiveIntegerQuerySchema
      .refine((value) => Number(value) <= 1_000_000, "Page is too large.")
      .optional(),
    limit: positiveIntegerQuerySchema
      .refine(
        (value) => Number(value) <= 50,
        "Limit cannot exceed 50.",
      )
      .optional(),
    search: projectSearchSchema.optional(),
    projectType: projectTypeFilterSchema.optional(),
    location: locationFilterSchema.optional(),
    ownerId: ownerIdFilterSchema.optional(),
  })
  .strict();

// ── Params schemas ────────────────────────────────────────────────────────────

export const projectIdParamsSchema = z
  .object({
    projectId: z.string().uuid("Project ID must be a valid UUID."),
  })
  .strict();

export const emptyProjectObjectSchema = z.object({}).strict();

// ── Inferred types ────────────────────────────────────────────────────────────

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;
export type ChangeProjectStatusBody = z.infer<
  typeof changeProjectStatusBodySchema
>;
export type ReorderProjectsBody = z.infer<typeof reorderProjectsBodySchema>;
export type ListPublishedProjectsQueryParams = z.infer<
  typeof listPublishedProjectsQuerySchema
>;
export type ProjectIdParams = z.infer<typeof projectIdParamsSchema>;
