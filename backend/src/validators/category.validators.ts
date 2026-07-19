import { z } from "zod";

const categoryNameSchema = z.string().trim().min(1).max(100);

const createDescriptionSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(1000).optional(),
);

const updateDescriptionSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(1000).nullable().optional(),
);

export const createCategoryBodySchema = z
  .object({
    name: categoryNameSchema,
    description: createDescriptionSchema,
  })
  .strict();

export const updateCategoryBodySchema = z
  .object({
    name: categoryNameSchema.optional(),
    description: updateDescriptionSchema,
  })
  .strict()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: "At least one category field must be provided.",
      path: ["body"],
    },
  );

export const categoryIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const emptyCategoryObjectSchema = z.object({}).strict();

export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategoryBodySchema>;
export type CategoryIdParams = z.infer<typeof categoryIdParamsSchema>;
