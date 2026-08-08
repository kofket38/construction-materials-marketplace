import "dotenv/config";
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
    PAYMENT_PROOF_UPLOAD_DIR: z
      .string()
      .trim()
      .min(1)
      .default("uploads/payment-proofs"),
  })
  .refine(
    (values) => values.JWT_ACCESS_SECRET !== values.JWT_REFRESH_SECRET,
    {
      message: "JWT access and refresh secrets must be different.",
      path: ["JWT_REFRESH_SECRET"],
    },
  );

export const env = environmentSchema.parse(process.env);
export type Environment = z.infer<typeof environmentSchema>;
