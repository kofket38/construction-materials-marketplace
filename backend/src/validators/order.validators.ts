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

export const createOrderBodySchema = z
  .object({
    items: z.array(orderItemSchema).min(1).max(100),
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
