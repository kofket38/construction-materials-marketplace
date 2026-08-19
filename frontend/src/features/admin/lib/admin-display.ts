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

export function formatAdminDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "—" : dateFormatter.format(d);
}

export function formatAdminDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFormatter.format(d);
}

export function statusBadgeClass(status: "ACTIVE" | "DISABLED"): string {
  return status === "ACTIVE"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-red-200 bg-red-50 text-red-700";
}

export function roleBadgeClass(role: string): string {
  switch (role) {
    case "ADMIN":
      return "border-violet-200 bg-violet-50 text-violet-800";
    case "SELLER":
      return "border-blue-200 bg-blue-50 text-blue-800";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }
}
