import { z } from "zod";

// ── Shared primitives ──────────────────────────────────────────────────────────

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

const citySchema = z
  .string()
  .trim()
  .min(1, "City is required.")
  .max(120, "City must be 120 characters or fewer.");

const priceSchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,10}(?:\.\d{1,2})?$/,
    "Price must be a positive number with up to two decimal places.",
  )
  .refine(
    (value) => Number(value) > 0,
    "Price must be greater than zero.",
  );

const quantitySchema = z
  .number()
  .int("Quantity must be a whole number.")
  .min(0, "Quantity must be zero or greater.")
  .max(2_147_483_647, "Quantity is too large.");

// ── List ───────────────────────────────────────────────────────────────────────

export const listSellerInventoryQuerySchema = z
  .object({
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
    search: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),
    city: citySchema.optional(),
  })
  .strict();

// ── Create ─────────────────────────────────────────────────────────────────────

export const createSellerInventoryBodySchema = z
  .object({
    productId: z.string().uuid("productId must be a valid UUID."),
    city: citySchema,
    region: z.string().trim().max(120).optional(),
    price: priceSchema,
    quantity: quantitySchema,
    deliveryAvailable: z.boolean().optional().default(false),
  })
  .strict();

// ── Update ─────────────────────────────────────────────────────────────────────

export const updateSellerInventoryBodySchema = z
  .object({
    city: citySchema.optional(),
    region: z.string().trim().max(120).nullable().optional(),
    price: priceSchema.optional(),
    quantity: quantitySchema.optional(),
    deliveryAvailable: z.boolean().optional(),
  })
  .strict()
  .refine(
    (body) => Object.keys(body).length > 0,
    "At least one field must be provided.",
  );

// ── Params ─────────────────────────────────────────────────────────────────────

export const sellerInventoryIdParamsSchema = z
  .object({ id: z.string().uuid() })
  .strict();

export const emptySellerInventoryObjectSchema = z.object({}).strict();

// ── Inferred types ─────────────────────────────────────────────────────────────

export type ListSellerInventoryQuery = z.infer<
  typeof listSellerInventoryQuerySchema
>;
export type CreateSellerInventoryBody = z.infer<
  typeof createSellerInventoryBodySchema
>;
export type UpdateSellerInventoryBody = z.infer<
  typeof updateSellerInventoryBodySchema
>;
export type SellerInventoryIdParams = z.infer<
  typeof sellerInventoryIdParamsSchema
>;
