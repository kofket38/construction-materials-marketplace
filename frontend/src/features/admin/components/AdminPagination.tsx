import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AdminPagination } from "@/features/admin/api/admin.api";

interface Props {
  pagination: AdminPagination;
  onPageChange: (page: number) => void;
}

export function AdminPaginationBar({ pagination, onPageChange }: Props) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-t border-zinc-200 bg-white px-4 py-3">
      <p className="text-sm text-zinc-600">
        Page {pagination.page} of {pagination.totalPages} &middot;{" "}
        {pagination.total.toLocaleString()} results
      </p>
      <div className="flex gap-2">
        <button
          aria-label="Previous page"
          className="inline-flex size-9 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <button
          aria-label="Next page"
          className="inline-flex size-9 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
          type="button"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
