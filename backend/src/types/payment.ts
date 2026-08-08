export type ManualPaymentMethod =
  | "TELEBIRR"
  | "CBE_BIRR"
  | "AWASH_BIRR"
  | "BANK_TRANSFER"
  | "CBE_BANK"
  | "AWASH_BANK"
  | "DASHEN_BANK"
  | "E_BIRR";

export interface PaymentDestination {
  method: ManualPaymentMethod;
  providerName: string;
  accountName: string;
  accountNumber: string;
  accountNumberLabel: "Payment number" | "Account number";
}

export function isManualPaymentMethod(
  method: string | undefined,
): method is ManualPaymentMethod {
  return (
    method === "TELEBIRR" ||
    method === "CBE_BIRR" ||
    method === "AWASH_BIRR" ||
    method === "BANK_TRANSFER" ||
    method === "CBE_BANK" ||
    method === "AWASH_BANK" ||
    method === "DASHEN_BANK" ||
    method === "E_BIRR"
  );
}
