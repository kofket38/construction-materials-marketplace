import dotenv from "dotenv";
dotenv.config();
import { z } from "zod";

const jwtDurationSchema = z
  .string()
  .regex(/^\d+(ms|s|m|h|d|w|y)$/, "JWT duration must include a time unit.");

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    ACCESS_TOKEN_EXPIRES: jwtDurationSchema.default("15m"),
    REFRESH_TOKEN_EXPIRES: jwtDurationSchema.default("7d"),
    CLIENT_URL: z.string().url().default("http://localhost:5173"),
    // Local filesystem upload directory — used in development/test only.
    // In production on Render, use Supabase Storage instead.
    PAYMENT_PROOF_UPLOAD_DIR: z
      .string()
      .trim()
      .min(1)
      .default("uploads/payment-proofs"),
    // ── Supabase Storage ────────────────────────────────────────────────────
    // When all three are present the backend uses SupabasePaymentProofStorage.
    // In production all three are REQUIRED — the local filesystem fallback is
    // ephemeral on Render and would silently lose payment-proof files on
    // every redeploy. The service-role key must NEVER appear in any VITE_*
    // variable.
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    SUPABASE_STORAGE_BUCKET: z.string().min(1).optional(),
  })
  .refine(
    (values) => values.JWT_ACCESS_SECRET !== values.JWT_REFRESH_SECRET,
    {
      message: "JWT access and refresh secrets must be different.",
      path: ["JWT_REFRESH_SECRET"],
    },
  )
  .refine(
    (values) =>
      values.NODE_ENV !== "production" ||
      (Boolean(values.SUPABASE_URL) &&
        Boolean(values.SUPABASE_SERVICE_ROLE_KEY) &&
        Boolean(values.SUPABASE_STORAGE_BUCKET)),
    {
      message:
        "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET " +
        "are required in production. The local filesystem fallback is not " +
        "suitable for production on Render because the filesystem is ephemeral.",
      path: ["SUPABASE_URL"],
    },
  );

export const env = environmentSchema.parse(process.env);
export type Environment = z.infer<typeof environmentSchema>;
