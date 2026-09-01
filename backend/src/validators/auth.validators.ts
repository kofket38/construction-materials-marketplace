import { z } from "zod";

const optionalTrimmedString = (maxLength: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? undefined
        : value,
    z.string().trim().max(maxLength).optional(),
  );

const optionalNamePart = (maxLength: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? undefined
        : value,
    z.string().trim().min(1).max(maxLength).optional(),
  );

const passwordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters.")
  .max(72, "Password must contain at most 72 characters.")
  .regex(/[a-z]/, "Password must contain a lowercase letter.")
  .regex(/[A-Z]/, "Password must contain an uppercase letter.")
  .regex(/[0-9]/, "Password must contain a number.");

const registrationRoleSchema = z.preprocess(
  (value) => (value === "BUYER" ? "CUSTOMER" : value),
  z.enum(["CUSTOMER", "SELLER", "PROFESSIONAL"]).default("CUSTOMER"),
);

export const registerBodySchema = z
  .object({
    name: optionalNamePart(160),
    firstName: optionalNamePart(80),
    lastName: optionalNamePart(80),
    email: z.string().trim().toLowerCase().email().max(254),
    password: passwordSchema,
    phone: optionalTrimmedString(30),
    company: optionalTrimmedString(150),
    role: registrationRoleSchema,
  })
  .strict()
  .superRefine((input, context) => {
    const hasName = input.name !== undefined;
    const hasFirstName = input.firstName !== undefined;
    const hasLastName = input.lastName !== undefined;

    if (!hasName && !(hasFirstName && hasLastName)) {
      context.addIssue({
        code: "custom",
        path: ["name"],
        message: "Provide name or both firstName and lastName.",
      });
    }

    if (hasFirstName !== hasLastName) {
      context.addIssue({
        code: "custom",
        path: [hasFirstName ? "lastName" : "firstName"],
        message: "firstName and lastName must be provided together.",
      });
    }

    if (input.name && input.firstName && input.lastName) {
      const legacyName = `${input.firstName} ${input.lastName}`;
      if (input.name.localeCompare(legacyName, undefined, { sensitivity: "base" }) !== 0) {
        context.addIssue({
          code: "custom",
          path: ["name"],
          message: "name must match firstName and lastName when both are provided.",
        });
      }
    }
  })
  .transform((input) => ({
    name: input.name ?? `${input.firstName} ${input.lastName}`,
    email: input.email,
    password: input.password,
    role: input.role,
    ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
    ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.company !== undefined ? { company: input.company } : {}),
  }));

export const loginBodySchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(72),
  })
  .strict();

export const emptyObjectSchema = z.object({}).strict();

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
