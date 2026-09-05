import type { RfqStatus, SupplierQuoteStatus } from "@/features/rfq/model/rfq";
export { RFQ_UNIT_LABELS } from "@/features/rfq/model/rfq";

export function formatRfqStatus(status: RfqStatus): string {
  switch (status) {
    case "OPEN": return "Open";
    case "AWARDED": return "Awarded";
    case "CANCELLED": return "Cancelled";
    case "EXPIRED": return "Expired";
  }
}

export function rfqStatusColor(status: RfqStatus): string {
  switch (status) {
    case "OPEN": return "border-brand-line bg-brand-soft text-brand-ink";
    case "AWARDED": return "border-blue-200 bg-blue-50 text-blue-800";
    case "CANCELLED": return "border-zinc-300 bg-zinc-100 text-zinc-600";
    case "EXPIRED": return "border-amber-200 bg-amber-50 text-amber-800";
  }
}

export function formatQuoteStatus(status: SupplierQuoteStatus): string {
  switch (status) {
    case "SUBMITTED": return "Submitted";
    case "ACCEPTED": return "Accepted";
    case "REJECTED": return "Rejected";
    case "WITHDRAWN": return "Withdrawn";
    case "CLOSED": return "Closed";
  }
}

export function quoteStatusColor(status: SupplierQuoteStatus): string {
  switch (status) {
    case "SUBMITTED": return "border-amber-200 bg-amber-50 text-amber-800";
    case "ACCEPTED": return "border-success-line bg-success-soft text-success";
    case "REJECTED": return "border-red-200 bg-red-50 text-red-800";
    case "WITHDRAWN": return "border-zinc-300 bg-zinc-100 text-zinc-600";
    case "CLOSED": return "border-zinc-300 bg-zinc-100 text-zinc-600";
  }
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatRfqDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "—" : dateFormatter.format(d);
}

export function formatRfqDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFormatter.format(d);
}

export function isRfqExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export function daysUntilExpiry(expiresAt: string): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}
