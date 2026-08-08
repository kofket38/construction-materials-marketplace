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

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const dateQuerySchema = z
  .string()
  .refine(isCalendarDate, "Date must use a valid YYYY-MM-DD value.");

export const sellerProductsQuerySchema = z
  .object({
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
    search: searchSchema.optional(),
    sortBy: z
      .enum(["createdAt", "name", "price", "quantity"])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    categoryId: z.string().uuid().optional(),
    stock: z
      .enum(["in_stock", "low_stock", "out_of_stock"])
      .optional(),
  })
  .strict();

export const sellerOrdersQuerySchema = z
  .object({
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
    status: z
      .enum([
        "PENDING_PAYMENT",
        "PENDING_PAYMENT_VERIFICATION",
        "PAYMENT_VERIFIED",
        "PAYMENT_REJECTED",
        "PENDING_CONFIRMATION",
        "PROCESSING",
        "READY_FOR_DELIVERY",
        "OUT_FOR_DELIVERY",
        "REJECTED",
        "PENDING",
        "CONFIRMED",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
      ])
      .optional(),
    dateFrom: dateQuerySchema.optional(),
    dateTo: dateQuerySchema.optional(),
    customerSearch: searchSchema.optional(),
  })
  .strict()
  .refine(
    (query) =>
      query.dateFrom === undefined ||
      query.dateTo === undefined ||
      query.dateFrom <= query.dateTo,
    {
      path: ["dateTo"],
      message: "dateTo must be on or after dateFrom.",
    },
  );

export const emptySellerDashboardObjectSchema = z.object({}).strict();

export const sellerOrderIdParamsSchema = z
  .object({
    orderId: z.string().uuid(),
  })
  .strict();

export const sellerPaymentDecisionBodySchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
  })
  .strict();

export const sellerOrderStatusBodySchema = z
  .object({
    status: z.enum([
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ]),
  })
  .strict();

export type SellerProductsQueryParams = z.infer<
  typeof sellerProductsQuerySchema
>;
export type SellerOrdersQueryParams = z.infer<
  typeof sellerOrdersQuerySchema
>;
export type SellerOrderIdParams = z.infer<
  typeof sellerOrderIdParamsSchema
>;
export type SellerPaymentDecisionBody = z.infer<
  typeof sellerPaymentDecisionBodySchema
>;
export type SellerOrderStatusBody = z.infer<
  typeof sellerOrderStatusBodySchema
>;
