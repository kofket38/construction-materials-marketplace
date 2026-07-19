import { z } from "zod";

const productNameSchema = z.string().trim().min(1).max(200);
const productDescriptionSchema = z.string().trim().min(1).max(5000);
const categoryIdSchema = z.string().uuid();
const sellerIdSchema = z.string().uuid();

const productPriceSchema = z
  .union([z.string().trim(), z.number().finite()])
  .transform((value) => String(value))
  .refine(
    (value) => /^\d{1,10}(?:\.\d{1,2})?$/.test(value),
    "Price must be a positive amount with at most two decimal places.",
  )
  .refine(
    (value) => Number(value) > 0,
    "Price must be greater than zero.",
  )
  .transform((value) => Number(value).toFixed(2));

const productQuantitySchema = z
  .union([
    z.number().int(),
    z
      .string()
      .trim()
      .regex(/^\d+$/, "Quantity must be a non-negative integer.")
      .transform(Number),
  ])
  .pipe(z.number().int().min(0).max(2_147_483_647));

const createImageUrlSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().url().max(2048).optional(),
);

const updateImageUrlSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().url().max(2048).nullable().optional(),
);

const positiveIntegerQuerySchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Must be a positive integer.");

const productQueryPriceSchema = z
  .string()
  .regex(
    /^\d{1,10}(?:\.\d{1,2})?$/,
    "Price must be a non-negative amount with at most two decimal places.",
  );

const productSearchSchema = z
  .string()
  .max(200)
  .refine(
    (value) => value.trim().length > 0,
    "Search cannot contain only whitespace.",
  );

export const createProductBodySchema = z
  .object({
    name: productNameSchema,
    description: productDescriptionSchema,
    price: productPriceSchema,
    quantity: productQuantitySchema,
    categoryId: categoryIdSchema,
    imageUrl: createImageUrlSchema,
  })
  .strict();

export const updateProductBodySchema = z
  .object({
    name: productNameSchema.optional(),
    description: productDescriptionSchema.optional(),
    price: productPriceSchema.optional(),
    quantity: productQuantitySchema.optional(),
    categoryId: categoryIdSchema.optional(),
    imageUrl: updateImageUrlSchema,
  })
  .strict()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: "At least one product field must be provided.",
      path: ["body"],
    },
  );

export const productIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const productDiscoveryQuerySchema = z
  .object({
    page: positiveIntegerQuerySchema
      .refine(
        (value) => Number(value) <= 1_000_000,
        "Page is too large.",
      )
      .optional(),
    limit: positiveIntegerQuerySchema
      .refine(
        (value) => Number(value) <= 100,
        "Limit cannot exceed 100.",
      )
      .optional(),
    search: productSearchSchema.optional(),
    categoryId: categoryIdSchema.optional(),
    sellerId: sellerIdSchema.optional(),
    minPrice: productQueryPriceSchema.optional(),
    maxPrice: productQueryPriceSchema.optional(),
    stock: z.enum(["in_stock", "out_of_stock"]).optional(),
    sortBy: z
      .enum(["newest", "oldest", "price", "name", "popularity"])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  })
  .strict()
  .refine(
    (query) =>
      query.minPrice === undefined ||
      query.maxPrice === undefined ||
      Number(query.minPrice) <= Number(query.maxPrice),
    {
      path: ["maxPrice"],
      message: "maxPrice must be greater than or equal to minPrice.",
    },
  );

export const emptyProductObjectSchema = z.object({}).strict();

export type CreateProductBody = z.infer<typeof createProductBodySchema>;
export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;
export type ProductIdParams = z.infer<typeof productIdParamsSchema>;
export type ProductDiscoveryQueryParams = z.infer<
  typeof productDiscoveryQuerySchema
>;
