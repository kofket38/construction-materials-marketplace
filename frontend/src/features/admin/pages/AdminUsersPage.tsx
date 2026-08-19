import {
  AlertTriangle,
  BadgeCheck,
  LoaderCircle,
  Search,
  ShieldOff,
  Users,
} from "lucide-react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import {
  getAdminUsers,
  updateAdminUserStatus,
  type AdminUser,
  type AdminUserRole,
} from "@/features/admin/api/admin.api";
import { AdminPaginationBar } from "@/features/admin/components/AdminPagination";
import {
  formatAdminDate,
  roleBadgeClass,
  statusBadgeClass,
} from "@/features/admin/lib/admin-display";
import { getApiErrorMessage } from "@/shared/api/http-error";

const PAGE_SIZE = 20;

const ROLE_OPTIONS: Array<{ label: string; value: AdminUserRole | "" }> = [
  { label: "All roles", value: "" },
  { label: "Customer", value: "CUSTOMER" },
  { label: "Seller", value: "SELLER" },
  { label: "Admin", value: "ADMIN" },
];

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<AdminUserRole | "">("");
  const [confirmUser, setConfirmUser] = useState<AdminUser | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin", "users", { page, search, role }],
    queryFn: ({ signal }) =>
      getAdminUsers({ page, limit: PAGE_SIZE, search: search || undefined, role: role || undefined }, signal),
    placeholderData: keepPreviousData,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "DISABLED" }) =>
      updateAdminUserStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      setConfirmUser(null);
    },
  });

  function handleSearch(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  const { users = [], pagination } = usersQuery.data ?? {};

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Administration</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Users</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Manage marketplace accounts and access.
          </p>
        </div>
        {pagination ? (
          <p className="text-sm text-zinc-600">
            {pagination.total.toLocaleString()} user{pagination.total !== 1 ? "s" : ""}
          </p>
        ) : null}
      </div>

      {/* Filters */}
      <form
        className="mt-5 grid gap-3 border-b border-zinc-200 pb-4 sm:grid-cols-[minmax(14rem,1fr)_10rem_auto]"
        onSubmit={handleSearch}
        role="search"
      >
        <label className="relative">
          <span className="sr-only">Search users</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, company"
            type="search"
            value={searchInput}
          />
        </label>
        <label>
          <span className="sr-only">Filter by role</span>
          <select
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            onChange={(e) => { setRole(e.target.value as AdminUserRole | ""); setPage(1); }}
            value={role}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          type="submit"
        >
          <Search aria-hidden="true" className="size-4" />
          Search
        </button>
      </form>

      {/* Mutation error */}
      {statusMutation.isError ? (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {getApiErrorMessage(statusMutation.error, "Status could not be updated.")}
        </div>
      ) : null}

      {/* Table */}
      {usersQuery.isPending ? (
        <div className="flex min-h-64 items-center justify-center">
          <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-emerald-700" />
        </div>
      ) : usersQuery.isError ? (
        <div className="mt-6 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {getApiErrorMessage(usersQuery.error, "Users could not be loaded.")}
        </div>
      ) : users.length === 0 ? (
        <div className="mt-8 py-16 text-center">
          <Users aria-hidden="true" className="mx-auto size-8 text-zinc-400" />
          <p className="mt-4 font-semibold text-zinc-950">No users found</p>
          <p className="mt-1 text-sm text-zinc-500">Try a different search or filter.</p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <thead className="bg-zinc-50">
                <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                  <th className="px-4 py-3 font-medium">Name / Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {users.map((user) => (
                  <tr className="hover:bg-zinc-50" key={user.id}>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-zinc-950">{user.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{user.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${roleBadgeClass(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(user.status)}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-zinc-600">{user.company ?? "—"}</td>
                    <td className="px-4 py-4 text-zinc-600">{formatAdminDate(user.createdAt)}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          user.status === "ACTIVE"
                            ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
                            : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                        }`}
                        onClick={() => { statusMutation.reset(); setConfirmUser(user); }}
                        type="button"
                      >
                        {user.status === "ACTIVE" ? (
                          <><ShieldOff aria-hidden="true" className="size-3.5" /> Disable</>
                        ) : (
                          <><BadgeCheck aria-hidden="true" className="size-3.5" /> Enable</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination ? (
            <AdminPaginationBar onPageChange={setPage} pagination={pagination} />
          ) : null}
        </div>
      )}

      {/* Confirm dialog */}
      {confirmUser ? (
        <ConfirmStatusDialog
          isLoading={statusMutation.isPending}
          onCancel={() => { if (!statusMutation.isPending) { setConfirmUser(null); statusMutation.reset(); } }}
          onConfirm={() =>
            statusMutation.mutate({
              id: confirmUser.id,
              status: confirmUser.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
            })
          }
          user={confirmUser}
        />
      ) : null}
    </div>
  );
}

function ConfirmStatusDialog({
  isLoading,
  onCancel,
  onConfirm,
  user,
}: {
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  user: AdminUser;
}) {
  const isDisabling = user.status === "ACTIVE";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 px-4"
      onMouseDown={(e) => { if (e.currentTarget === e.target && !isLoading) onCancel(); }}
    >
      <div className="w-full max-w-sm rounded-md border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-zinc-950">
          {isDisabling ? "Disable" : "Enable"} account
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          {isDisabling
            ? `Disable ${user.name}'s account? They will immediately lose access to all endpoints.`
            : `Re-enable ${user.name}'s account? They will be able to log in again.`}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
            disabled={isLoading}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
              isDisabling ? "bg-red-600 hover:bg-red-700" : "bg-emerald-700 hover:bg-emerald-800"
            }`}
            disabled={isLoading}
            onClick={onConfirm}
            type="button"
          >
            {isLoading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
            {isDisabling ? "Disable" : "Enable"}
          </button>
        </div>
      </div>
    </div>
  );
}
