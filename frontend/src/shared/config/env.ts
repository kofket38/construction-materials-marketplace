import { z } from "zod";

const frontendEnvironmentSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .url()
   .default("http://localhost:3055/api")
    .transform((value) => value.replace(/\/+$/, "")),
  VITE_API_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(120_000)
    .default(15_000),
});

const parsedEnvironment = frontendEnvironmentSchema.safeParse(import.meta.env);

if (!parsedEnvironment.success) {
  const details = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid frontend environment configuration: ${details}`);
}

export const env = parsedEnvironment.data;
