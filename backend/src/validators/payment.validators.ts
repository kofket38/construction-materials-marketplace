import { z } from "zod";

export const checkoutPaymentOptionsBodySchema = z
  .object({
    productIds: z
      .array(z.string().uuid())
      .min(1)
      .max(50)
      .refine(
        (productIds) => new Set(productIds).size === productIds.length,
        "Product IDs must be unique.",
      ),
  })
  .strict();

export const submitManualPaymentBodySchema = z
  .object({
    orderId: z.string().uuid(),
  })
  .strict();

export const paymentOrderIdParamsSchema = z
  .object({
    orderId: z.string().uuid(),
  })
  .strict();

export const emptyPaymentObjectSchema = z.object({}).strict();

export type SubmitManualPaymentBody = z.infer<
  typeof submitManualPaymentBodySchema
>;
export type CheckoutPaymentOptionsBody = z.infer<
  typeof checkoutPaymentOptionsBodySchema
>;
export type PaymentOrderIdParams = z.infer<
  typeof paymentOrderIdParamsSchema
>;
