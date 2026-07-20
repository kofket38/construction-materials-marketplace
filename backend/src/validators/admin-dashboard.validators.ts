import { z } from "zod";

const positiveIntegerQuerySchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Must be a positive integer.");

const pageSchema = positiveIntegerQuerySchema.refine(
  (value) => Number(value) <= 1_000_000,
  "Page is too large.",
);

const limitSchema = positiveIntegerQuerySchema.refine(
  (value) => Number(value) <= 100,
  "Limit cannot exceed 100.",
);

const searchSchema = z
  .string()
  .max(200)
  .refine(
    (value) => value.trim().length > 0,
    "Search cannot contain only whitespace.",
  );

export const adminUsersQuerySchema = z
  .object({
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
    search: searchSchema.optional(),
    role: z.enum(["CUSTOMER", "SELLER", "ADMIN"]).optional(),
  })
  .strict();

export const adminSellersQuerySchema = z
  .object({
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
    search: searchSchema.optional(),
  })
  .strict();

export const adminProductsQuerySchema = z
  .object({
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
    search: searchSchema.optional(),
    categoryId: z.string().uuid().optional(),
    sellerId: z.string().uuid().optional(),
  })
  .strict();

export const adminUserIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const adminProductIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const updateAdminUserStatusBodySchema = z
  .object({
    status: z.enum(["ACTIVE", "DISABLED"]),
  })
  .strict();

export const emptyAdminObjectSchema = z.object({}).strict();

export type AdminUsersQueryParams = z.infer<
  typeof adminUsersQuerySchema
>;
export type AdminSellersQueryParams = z.infer<
  typeof adminSellersQuerySchema
>;
export type AdminProductsQueryParams = z.infer<
  typeof adminProductsQuerySchema
>;
export type AdminUserIdParams = z.infer<
  typeof adminUserIdParamsSchema
>;
export type AdminProductIdParams = z.infer<
  typeof adminProductIdParamsSchema
>;
export type UpdateAdminUserStatusBody = z.infer<
  typeof updateAdminUserStatusBodySchema
>;
