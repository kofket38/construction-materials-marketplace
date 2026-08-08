import { z } from "zod";

const orderQuantitySchema = z
  .union([
    z.number().int(),
    z
      .string()
      .trim()
      .regex(/^\d+$/, "Quantity must be a positive integer.")
      .transform(Number),
  ])
  .pipe(z.number().int().min(1).max(2_147_483_647));

const orderItemSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: orderQuantitySchema,
  })
  .strict();

const shippingSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Shipping full name is required.")
      .max(160),
    phone: z
      .string()
      .trim()
      .min(1, "Shipping phone is required.")
      .max(30),
    city: z
      .string()
      .trim()
      .min(1, "Shipping city is required.")
      .max(120),
    address: z
      .string()
      .trim()
      .min(1, "Shipping address is required.")
      .max(300),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const createOrderBodySchema = z
  .object({
    items: z.array(orderItemSchema).min(1).max(100),
    shipping: shippingSchema,
    paymentMethod: z.enum([
      "CASH_ON_DELIVERY",
      "TELEBIRR",
      "CBE_BIRR",
      "AWASH_BIRR",
      "BANK_TRANSFER",
      "CBE_BANK",
      "AWASH_BANK",
      "DASHEN_BANK",
      "E_BIRR",
    ]),
  })
  .strict()
  .superRefine((input, context) => {
    const productIds = new Set<string>();

    input.items.forEach((item, index) => {
      if (productIds.has(item.productId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "productId"],
          message: "Each product may appear only once in an order.",
        });
      }
      productIds.add(item.productId);
    });
  });

export const updateOrderStatusBodySchema = z
  .object({
    status: z.enum([
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
    ]),
  })
  .strict();

export const orderIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const emptyOrderObjectSchema = z.object({}).strict();

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type UpdateOrderStatusBody = z.infer<
  typeof updateOrderStatusBodySchema
>;
export type OrderIdParams = z.infer<typeof orderIdParamsSchema>;
