import { z } from "zod";

// ── Reusable field schemas ─────────────────────────────────────────────────────

const shopNameSchema = z.string().trim().min(1, "Shop name is required.").max(200);
const phoneSchema = z.string().trim().min(1, "Phone is required.").max(30);
const addressSchema = z.string().trim().min(1, "Address is required.").max(500);

// Payment fields are optional strings; empty strings are treated as null.
const optionalPaymentField = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(60).nullable().optional(),
);

// ── Upsert (PUT — create or fully replace) ────────────────────────────────────

export const upsertSellerProfileBodySchema = z
  .object({
    shopName: shopNameSchema,
    phone: phoneSchema,
    address: addressSchema,
    paymentAccountName: optionalPaymentField,
    telebirrNumber: optionalPaymentField,
    cbeBirrNumber: optionalPaymentField,
    cbeBankAccountNumber: optionalPaymentField,
    awashBankAccountNumber: optionalPaymentField,
    dashenBankAccountNumber: optionalPaymentField,
    eBirrNumber: optionalPaymentField,
  })
  .strict();

// ── Patch (PATCH — partial update) ────────────────────────────────────────────

export const patchSellerProfileBodySchema = z
  .object({
    shopName: shopNameSchema.optional(),
    phone: phoneSchema.optional(),
    address: addressSchema.optional(),
    paymentAccountName: optionalPaymentField,
    telebirrNumber: optionalPaymentField,
    cbeBirrNumber: optionalPaymentField,
    cbeBankAccountNumber: optionalPaymentField,
    awashBankAccountNumber: optionalPaymentField,
    dashenBankAccountNumber: optionalPaymentField,
    eBirrNumber: optionalPaymentField,
  })
  .strict()
  .refine(
    (body) => Object.keys(body).length > 0,
    "At least one field must be provided.",
  );

export const emptySellerProfileObjectSchema = z.object({}).strict();

// ── Inferred types ─────────────────────────────────────────────────────────────

export type UpsertSellerProfileBody = z.infer<
  typeof upsertSellerProfileBodySchema
>;
export type PatchSellerProfileBody = z.infer<
  typeof patchSellerProfileBodySchema
>;
