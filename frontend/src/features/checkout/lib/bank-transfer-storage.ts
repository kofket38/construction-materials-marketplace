import type { ManualPaymentInstructions } from "@/features/checkout/api/orders.api";

const STORAGE_PREFIX = "cmm:manual-payment:";

export function saveManualPaymentInstructions(
  orderId: string,
  instructions: ManualPaymentInstructions,
): void {
  try {
    window.sessionStorage.setItem(
      storageKey(orderId),
      JSON.stringify(instructions),
    );
  } catch {
    // Navigation still succeeds when browser storage is unavailable.
  }
}

export function readManualPaymentInstructions(
  orderId: string,
): ManualPaymentInstructions | null {
  try {
    const storedValue = window.sessionStorage.getItem(storageKey(orderId));
    if (!storedValue) {
      return null;
    }

    const instructions: unknown = JSON.parse(storedValue);
    return isManualPaymentInstructions(instructions)
      ? instructions
      : null;
  } catch {
    return null;
  }
}

function storageKey(orderId: string): string {
  return `${STORAGE_PREFIX}${orderId}`;
}

function isManualPaymentInstructions(
  value: unknown,
): value is ManualPaymentInstructions {
  if (!value || typeof value !== "object") {
    return false;
  }

  const instructions = value as Record<string, unknown>;
  return (
    typeof instructions.paymentReference === "string" &&
    typeof instructions.amount === "string" &&
    typeof instructions.receiptUploadInstructions === "string" &&
    isPaymentDestination(instructions.paymentDestination)
  );
}

function isPaymentDestination(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const destination = value as Record<string, unknown>;
  return (
    isManualPaymentMethod(destination.method) &&
    typeof destination.providerName === "string" &&
    typeof destination.accountName === "string" &&
    typeof destination.accountNumber === "string" &&
    (destination.accountNumberLabel === "Payment number" ||
      destination.accountNumberLabel === "Account number")
  );
}

function isManualPaymentMethod(value: unknown): boolean {
  return (
    value === "TELEBIRR" ||
    value === "CBE_BIRR" ||
    value === "CBE_BANK" ||
    value === "AWASH_BANK" ||
    value === "DASHEN_BANK" ||
    value === "E_BIRR"
  );
}
