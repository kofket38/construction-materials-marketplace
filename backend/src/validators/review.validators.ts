import { z } from "zod";

const ratingSchema = z.number().int().min(1).max(5);
const commentSchema = z.string().trim().min(1).max(5000);

const createCommentSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === ""
      ? undefined
      : value,
  commentSchema.optional(),
);

const updateCommentSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? null : value,
  commentSchema.nullable().optional(),
);

export const createReviewBodySchema = z
  .object({
    rating: ratingSchema,
    comment: createCommentSchema,
  })
  .strict();

export const updateReviewBodySchema = z
  .object({
    rating: ratingSchema.optional(),
    comment: updateCommentSchema,
  })
  .strict()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: "At least one review field must be provided.",
      path: ["body"],
    },
  );

export const reviewProductIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const reviewIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const emptyReviewObjectSchema = z.object({}).strict();

export type CreateReviewBody = z.infer<typeof createReviewBodySchema>;
export type UpdateReviewBody = z.infer<typeof updateReviewBodySchema>;
export type ReviewProductIdParams = z.infer<
  typeof reviewProductIdParamsSchema
>;
export type ReviewIdParams = z.infer<typeof reviewIdParamsSchema>;
