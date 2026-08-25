import { z } from "zod";

// ── Reusable field schemas ─────────────────────────────────────────────────────

const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name is required.")
  .max(200, "Display name must be 200 characters or fewer.");

const headlineSchema = z
  .string()
  .trim()
  .max(300, "Headline must be 300 characters or fewer.")
  .nullable()
  .optional();

const bioSchema = z
  .string()
  .trim()
  .max(2000, "Bio must be 2000 characters or fewer.")
  .nullable()
  .optional();

const avatarUrlSchema = z
  .string()
  .trim()
  .url("Avatar URL must be a valid URL.")
  .max(500, "Avatar URL must be 500 characters or fewer.")
  .nullable()
  .optional();

const professionSchema = z
  .string()
  .trim()
  .max(200, "Profession must be 200 characters or fewer.")
  .nullable()
  .optional();

const yearsExperienceSchema = z
  .number()
  .int("Years of experience must be a whole number.")
  .min(0, "Years of experience cannot be negative.")
  .max(80, "Years of experience must be 80 or fewer.")
  .nullable()
  .optional();

const companySchema = z
  .string()
  .trim()
  .max(200, "Company name must be 200 characters or fewer.")
  .nullable()
  .optional();

const citySchema = z
  .string()
  .trim()
  .max(100, "City must be 100 characters or fewer.")
  .nullable()
  .optional();

const regionSchema = z
  .string()
  .trim()
  .max(100, "Region must be 100 characters or fewer.")
  .nullable()
  .optional();

const countrySchema = z
  .string()
  .trim()
  .max(100, "Country must be 100 characters or fewer.")
  .nullable()
  .optional();

const phoneSchema = z
  .string()
  .trim()
  .max(30, "Phone must be 30 characters or fewer.")
  .nullable()
  .optional();

const emailSchema = z
  .string()
  .trim()
  .email("Email must be a valid email address.")
  .max(254, "Email must be 254 characters or fewer.")
  .nullable()
  .optional();

const websiteSchema = z
  .string()
  .trim()
  .url("Website must be a valid URL.")
  .max(500, "Website must be 500 characters or fewer.")
  .nullable()
  .optional();

const linkedinUrlSchema = z
  .string()
  .trim()
  .url("LinkedIn URL must be a valid URL.")
  .max(500, "LinkedIn URL must be 500 characters or fewer.")
  .nullable()
  .optional();

const visibilitySchema = z
  .enum(["PUBLIC", "PRIVATE"])
  .optional();

// ── Profile schemas ───────────────────────────────────────────────────────────

export const createProfessionalProfileBodySchema = z
  .object({
    displayName: displayNameSchema,
    headline: headlineSchema,
    bio: bioSchema,
    avatarUrl: avatarUrlSchema,
    profession: professionSchema,
    yearsExperience: yearsExperienceSchema,
    company: companySchema,
    city: citySchema,
    region: regionSchema,
    country: countrySchema,
    phone: phoneSchema,
    email: emailSchema,
    website: websiteSchema,
    linkedinUrl: linkedinUrlSchema,
    visibility: visibilitySchema,
  })
  .strict();

export const updateProfessionalProfileBodySchema = z
  .object({
    displayName: displayNameSchema.optional(),
    headline: headlineSchema,
    bio: bioSchema,
    avatarUrl: avatarUrlSchema,
    profession: professionSchema,
    yearsExperience: yearsExperienceSchema,
    company: companySchema,
    city: citySchema,
    region: regionSchema,
    country: countrySchema,
    phone: phoneSchema,
    email: emailSchema,
    website: websiteSchema,
    linkedinUrl: linkedinUrlSchema,
    visibility: visibilitySchema,
  })
  .strict()
  .refine(
    (body) => Object.keys(body).length > 0,
    "At least one field must be provided.",
  );

// ── Specialty schemas ─────────────────────────────────────────────────────────

const specialtyNameSchema = z
  .string()
  .trim()
  .min(1, "Specialty name is required.")
  .max(150, "Specialty name must be 150 characters or fewer.");

export const replaceSpecialtiesBodySchema = z
  .object({
    names: z
      .array(specialtyNameSchema)
      .max(50, "A profile may have at most 50 specialties."),
  })
  .strict();

// ── Credential schemas ────────────────────────────────────────────────────────

const credentialTypeSchema = z
  .enum(["EDUCATION", "CERTIFICATION", "TRAINING", "AWARD", "OTHER"])
  .optional();

const credentialTitleSchema = z
  .string()
  .trim()
  .min(1, "Title is required.")
  .max(300, "Title must be 300 characters or fewer.");

const institutionSchema = z
  .string()
  .trim()
  .max(300, "Institution must be 300 characters or fewer.")
  .nullable()
  .optional();

const yearObtainedSchema = z
  .number()
  .int("Year must be a whole number.")
  .min(1900, "Year must be 1900 or later.")
  .max(new Date().getFullYear(), `Year must not be in the future.`)
  .nullable()
  .optional();

const credentialDescriptionSchema = z
  .string()
  .trim()
  .max(1000, "Description must be 1000 characters or fewer.")
  .nullable()
  .optional();

const credentialUrlSchema = z
  .string()
  .trim()
  .url("Credential URL must be a valid URL.")
  .max(500, "Credential URL must be 500 characters or fewer.")
  .nullable()
  .optional();

export const createCredentialBodySchema = z
  .object({
    type: credentialTypeSchema,
    title: credentialTitleSchema,
    institution: institutionSchema,
    yearObtained: yearObtainedSchema,
    description: credentialDescriptionSchema,
    credentialUrl: credentialUrlSchema,
  })
  .strict();

export const updateCredentialBodySchema = z
  .object({
    type: credentialTypeSchema,
    title: credentialTitleSchema.optional(),
    institution: institutionSchema,
    yearObtained: yearObtainedSchema,
    description: credentialDescriptionSchema,
    credentialUrl: credentialUrlSchema,
  })
  .strict()
  .refine(
    (body) => Object.keys(body).length > 0,
    "At least one field must be provided.",
  );

// ── Directory (public list) query schema ──────────────────────────────────────

const positiveIntegerQuerySchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Must be a positive integer.");

const professionalSearchSchema = z
  .string()
  .max(200, "Search must be 200 characters or fewer.")
  .refine(
    (value) => value.trim().length > 0,
    "Search cannot contain only whitespace.",
  );

const professionFilterSchema = z
  .string()
  .trim()
  .min(1, "Profession filter cannot be empty.")
  .max(200, "Profession filter must be 200 characters or fewer.");

const specialtyFilterSchema = z
  .string()
  .trim()
  .min(1, "Specialty filter cannot be empty.")
  .max(150, "Specialty filter must be 150 characters or fewer.");

const cityFilterSchema = z
  .string()
  .trim()
  .min(1, "City filter cannot be empty.")
  .max(120, "City filter must be 120 characters or fewer.");

export const listProfessionalProfilesQuerySchema = z
  .object({
    page: positiveIntegerQuerySchema
      .refine((value) => Number(value) <= 1_000_000, "Page is too large.")
      .optional(),
    limit: positiveIntegerQuerySchema
      .refine(
        (value) => Number(value) <= 50,
        "Limit cannot exceed 50.",
      )
      .optional(),
    search: professionalSearchSchema.optional(),
    profession: professionFilterSchema.optional(),
    specialty: specialtyFilterSchema.optional(),
    city: cityFilterSchema.optional(),
    sortBy: z.enum(["newest", "oldest", "experience", "name"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  })
  .strict();

// ── Params schemas ────────────────────────────────────────────────────────────

export const profileIdParamsSchema = z
  .object({ profileId: z.string().uuid("Profile ID must be a valid UUID.") })
  .strict();

export const credentialIdParamsSchema = z
  .object({ credentialId: z.string().uuid("Credential ID must be a valid UUID.") })
  .strict();

export const emptyProfessionalProfileObjectSchema = z.object({}).strict();

// ── Inferred types ────────────────────────────────────────────────────────────

export type CreateProfessionalProfileBody = z.infer<
  typeof createProfessionalProfileBodySchema
>;
export type UpdateProfessionalProfileBody = z.infer<
  typeof updateProfessionalProfileBodySchema
>;
export type ReplaceSpecialtiesBody = z.infer<
  typeof replaceSpecialtiesBodySchema
>;
export type CreateCredentialBody = z.infer<typeof createCredentialBodySchema>;
export type UpdateCredentialBody = z.infer<typeof updateCredentialBodySchema>;
export type ListProfessionalProfilesQueryParams = z.infer<
  typeof listProfessionalProfilesQuerySchema
>;
export type ProfileIdParams = z.infer<typeof profileIdParamsSchema>;
export type CredentialIdParams = z.infer<typeof credentialIdParamsSchema>;
