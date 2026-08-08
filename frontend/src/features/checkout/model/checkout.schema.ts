import { z } from "zod";

export const checkoutPaymentMethods = [
  "CASH_ON_DELIVERY",
  "TELEBIRR",
  "CBE_BIRR",
  "CBE_BANK",
  "AWASH_BANK",
  "DASHEN_BANK",
  "E_BIRR",
] as const;

export const checkoutShippingSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Enter your full name.")
    .max(160, "Name must contain at most 160 characters."),
  phone: z
    .string()
    .trim()
    .min(1, "Enter your phone number.")
    .max(30, "Phone number must contain at most 30 characters."),
  city: z
    .string()
    .trim()
    .min(1, "Enter your region or city.")
    .max(120, "Region or city must contain at most 120 characters."),
  address: z
    .string()
    .trim()
    .min(1, "Enter your delivery address.")
    .max(300, "Address must contain at most 300 characters."),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must contain at most 500 characters."),
});

export const checkoutSchema = checkoutShippingSchema.extend({
  paymentMethod: z.enum(checkoutPaymentMethods, {
    error: "Select a payment method.",
  }),
});

export type CheckoutPaymentMethod =
  (typeof checkoutPaymentMethods)[number];
export type ManualPaymentMethod = Exclude<
  CheckoutPaymentMethod,
  "CASH_ON_DELIVERY"
>;
export type CheckoutShippingValues = z.infer<
  typeof checkoutShippingSchema
>;
export type CheckoutFormValues = z.infer<typeof checkoutSchema>;
