import { z } from "zod";

export const wishlistProductIdParamsSchema = z
  .object({
    productId: z.string().uuid(),
  })
  .strict();

export const emptyWishlistObjectSchema = z.object({}).strict();

export type WishlistProductIdParams = z.infer<
  typeof wishlistProductIdParamsSchema
>;
