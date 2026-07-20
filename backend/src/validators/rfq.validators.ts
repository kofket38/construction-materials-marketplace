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

const requestedQuantitySchema = z
  .union([z.string().trim(), z.number().finite()])
  .transform((value) => String(value))
  .refine(
    (value) => /^\d{1,11}(?:\.\d{1,3})?$/.test(value),
    "Requested quantity must have at most three decimal places.",
  )
  .refine(
    (value) => Number(value) > 0,
    "Requested quantity must be greater than zero.",
  );

const offeredQuantitySchema = z
  .union([
    z.number().int(),
    z
      .string()
      .trim()
      .regex(/^\d+$/, "Offered quantity must be a positive integer.")
      .transform(Number),
  ])
  .pipe(z.number().int().min(1).max(2_147_483_647));

const unitPriceSchema = z
  .union([z.string().trim(), z.number().finite()])
  .transform((value) => String(value))
  .refine(
    (value) => /^\d{1,10}(?:\.\d{1,2})?$/.test(value),
    "Unit price must have at most two decimal places.",
  )
  .refine(
    (value) => Number(value) > 0,
    "Unit price must be greater than zero.",
  )
  .transform((value) => Number(value).toFixed(2));

const rfqUnitSchema = z.enum([
  "BAG",
  "KG",
  "TONNE",
  "LITRE",
  "METRE",
  "SQUARE_METRE",
  "CUBIC_METRE",
  "PIECE",
  "ROLL",
  "PALLET",
  "LOAD",
  "OTHER",
]);

const rfqItemSchema = z
  .object({
    categoryId: z.string().uuid(),
    preferredProductId: z.string().uuid().optional(),
    materialName: z.string().trim().min(1).max(200),
    specifications: z.string().trim().min(1).max(5000).optional(),
    requestedQuantity: requestedQuantitySchema,
    requestedUnit: rfqUnitSchema,
    customUnit: z.string().trim().min(1).max(50).optional(),
  })
  .strict()
  .superRefine((item, context) => {
    if (item.requestedUnit === "OTHER" && item.customUnit === undefined) {
      context.addIssue({
        code: "custom",
        path: ["customUnit"],
        message: "customUnit is required when requestedUnit is OTHER.",
      });
    }
    if (item.requestedUnit !== "OTHER" && item.customUnit !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["customUnit"],
        message: "customUnit is allowed only when requestedUnit is OTHER.",
      });
    }
  });

const rfqFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  deliveryLocation: z.string().trim().min(1).max(500),
  notes: z.string().trim().min(1).max(5000).optional(),
  expiresAt: z.string().datetime({ offset: true }),
  items: z.array(rfqItemSchema).min(1).max(20),
});

export const createRfqBodySchema = rfqFieldsSchema.strict();
export const updateRfqBodySchema = rfqFieldsSchema.strict();

const quoteItemSchema = z
  .object({
    rfqItemId: z.string().uuid(),
    productId: z.string().uuid(),
    offeredQuantity: offeredQuantitySchema,
    unitPrice: unitPriceSchema,
  })
  .strict();

const quoteFieldsSchema = z
  .object({
    validUntil: z.string().datetime({ offset: true }),
    leadTimeDays: z
      .union([
        z.number().int(),
        z
          .string()
          .trim()
          .regex(/^\d+$/, "Lead time must be a non-negative integer.")
          .transform(Number),
      ])
      .pipe(z.number().int().min(0).max(365)),
    terms: z.string().trim().min(1).max(5000).optional(),
    items: z.array(quoteItemSchema).min(1).max(20),
  })
  .strict()
  .superRefine((quote, context) => {
    const rfqItemIds = new Set<string>();
    const productIds = new Set<string>();

    quote.items.forEach((item, index) => {
      if (rfqItemIds.has(item.rfqItemId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "rfqItemId"],
          message: "Each RFQ item may appear only once in a quotation.",
        });
      }
      if (productIds.has(item.productId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "productId"],
          message: "Each product may appear only once in a quotation.",
        });
      }
      rfqItemIds.add(item.rfqItemId);
      productIds.add(item.productId);
    });
  });

export const createSupplierQuoteBodySchema = quoteFieldsSchema;
export const updateSupplierQuoteBodySchema = quoteFieldsSchema;

export const rfqListQuerySchema = z
  .object({
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
    status: z
      .enum(["OPEN", "AWARDED", "CANCELLED", "EXPIRED"])
      .optional(),
    categoryId: z.string().uuid().optional(),
  })
  .strict();

export const sellerRfqListQuerySchema = rfqListQuerySchema
  .extend({
    view: z.enum(["available", "participating"]).optional(),
  })
  .strict();

export const rfqIdParamsSchema = z
  .object({ id: z.string().uuid() })
  .strict();

export const quoteIdParamsSchema = z
  .object({ id: z.string().uuid() })
  .strict();

export const emptyRfqObjectSchema = z.object({}).strict();

export type CreateRfqBody = z.infer<typeof createRfqBodySchema>;
export type UpdateRfqBody = z.infer<typeof updateRfqBodySchema>;
export type CreateSupplierQuoteBody = z.infer<
  typeof createSupplierQuoteBodySchema
>;
export type UpdateSupplierQuoteBody = z.infer<
  typeof updateSupplierQuoteBodySchema
>;
export type RfqListQueryParams = z.infer<typeof rfqListQuerySchema>;
export type SellerRfqListQueryParams = z.infer<
  typeof sellerRfqListQuerySchema
>;
export type RfqIdParams = z.infer<typeof rfqIdParamsSchema>;
export type QuoteIdParams = z.infer<typeof quoteIdParamsSchema>;
