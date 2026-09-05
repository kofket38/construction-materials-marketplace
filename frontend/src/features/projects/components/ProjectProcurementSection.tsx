import {
  AlertTriangle,
  FileText,
  LoaderCircle,
  PackageOpen,
  Unlink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import { formatOrderNumber } from "@/features/orders/lib/order-display";
import { formatProductPrice } from "@/features/products/lib/product-display";
import {
  detachProjectOrder,
  detachProjectRfq,
  getProjectProcurement,
  type Project,
  type ProjectOrderSummary,
  type ProjectRfqSummary,
} from "@/features/projects/api/projects.api";
import {
  projectProcurementKey,
  useInvalidateProjects,
} from "@/features/projects/lib/project-queries";
import {
  formatRfqDate,
  formatRfqStatus,
  isRfqExpired,
  rfqStatusColor,
} from "@/features/rfq/lib/rfq-display";
import { getApiErrorMessage } from "@/shared/api/http-error";

/**
 * Owner-private procurement attached to one project.
 *
 * Read and detach only. The backend owns every rule about what blocks project
 * completion or deletion, so nothing here recomputes those guards — the
 * lifecycle controls simply surface whatever the API refuses. Detaching exists
 * because the procurement foreign keys are ON DELETE RESTRICT and orders have
 * no update endpoint, making this the only way to release a linked project.
 */
export function ProjectProcurementSection({ project }: { project: Project }) {
  return (
    <section
      aria-labelledby="procurement-heading"
      className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <h2
        className="text-base font-semibold text-zinc-950"
        id="procurement-heading"
      >
        Procurement
      </h2>
      <p className="mt-1 text-sm leading-6 text-zinc-600">
        Requests for quotes and orders attached to this project. Only you can
        see this.
      </p>

      <div className="mt-4">
        <ProcurementBody projectId={project.id} />
      </div>
    </section>
  );
}

// ── States ────────────────────────────────────────────────────────────────────

function ProcurementBody({ projectId }: { projectId: string }) {
  const procurementQuery = useQuery({
    queryKey: projectProcurementKey(projectId),
    queryFn: ({ signal }) => getProjectProcurement(projectId, signal),
    retry: false,
    staleTime: 30_000,
  });

  if (procurementQuery.isPending) {
    return (
      <p
        aria-live="polite"
        className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-4 text-sm text-zinc-600"
      >
        <LoaderCircle
          aria-hidden="true"
          className="size-4 animate-spin text-brand-ink"
        />
        Loading attached procurement...
      </p>
    );
  }

  if (procurementQuery.isError) {
    return (
      <div
        className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800"
        role="alert"
      >
        <p className="flex items-start gap-2">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          {getApiErrorMessage(
            procurementQuery.error,
            "The attached procurement could not be loaded.",
          )}
        </p>
        <button
          className="mt-2 inline-flex min-h-9 items-center rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
          onClick={() => void procurementQuery.refetch()}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  const { orders, rfqs } = procurementQuery.data;

  if (rfqs.length === 0 && orders.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-6 text-center text-sm leading-6 text-zinc-600">
        Nothing attached yet. Pick this project while creating a request for
        quote or placing an order, and it will show up here.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <ProcurementRfqList projectId={projectId} rfqs={rfqs} />
      <ProcurementOrderList orders={orders} projectId={projectId} />
    </div>
  );
}

// ── Attached RFQs ─────────────────────────────────────────────────────────────

function ProcurementRfqList({
  projectId,
  rfqs,
}: {
  projectId: string;
  rfqs: ProjectRfqSummary[];
}) {
  const invalidateProjects = useInvalidateProjects();
  const detachMutation = useMutation({
    mutationFn: (rfqId: string) => detachProjectRfq(projectId, rfqId),
    onSuccess: invalidateProjects,
  });

  return (
    <div>
      <GroupHeading count={rfqs.length} icon={FileText} label="Requests for quotes" />
      {rfqs.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">
          No requests for quotes are attached.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rfqs.map((rfq) => (
            <li
              className="rounded-md border border-zinc-200 p-3"
              key={rfq.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    className="text-sm font-semibold text-brand-ink underline-offset-2 hover:underline"
                    to={`/rfqs/${encodeURIComponent(rfq.id)}`}
                  >
                    {rfq.title}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {rfq.deliveryLocation}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${rfqStatusColor(rfq.status)}`}
                >
                  {formatRfqStatus(rfq.status)}
                </span>
              </div>

              <p className="mt-2 text-xs text-zinc-600">
                {rfq.itemCount} {rfq.itemCount === 1 ? "item" : "items"} ·{" "}
                {rfq.quoteCount} {rfq.quoteCount === 1 ? "quote" : "quotes"} ·{" "}
                {isRfqExpired(rfq.expiresAt) ? "Expired" : "Closes"}{" "}
                {formatRfqDate(rfq.expiresAt)}
              </p>

              <DetachAction
                busy={detachMutation.isPending}
                confirmMessage={`Detach "${rfq.title}" from this project? The request itself stays as it is.`}
                error={
                  detachMutation.isError && detachMutation.variables === rfq.id
                    ? getApiErrorMessage(
                        detachMutation.error,
                        "The request could not be detached.",
                      )
                    : undefined
                }
                label="Detach request"
                onDetach={() => detachMutation.mutate(rfq.id)}
                pending={
                  detachMutation.isPending && detachMutation.variables === rfq.id
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Attached orders ───────────────────────────────────────────────────────────

function ProcurementOrderList({
  orders,
  projectId,
}: {
  orders: ProjectOrderSummary[];
  projectId: string;
}) {
  const invalidateProjects = useInvalidateProjects();
  const detachMutation = useMutation({
    mutationFn: (orderId: string) => detachProjectOrder(projectId, orderId),
    onSuccess: invalidateProjects,
  });

  return (
    <div>
      <GroupHeading count={orders.length} icon={PackageOpen} label="Orders" />
      {orders.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">No orders are attached.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {orders.map((order) => (
            <li className="rounded-md border border-zinc-200 p-3" key={order.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    className="text-sm font-semibold text-brand-ink underline-offset-2 hover:underline"
                    to={`/orders/${encodeURIComponent(order.id)}`}
                  >
                    Order {formatOrderNumber(order.id)}
                  </Link>
                  <p className="mt-0.5 text-xs text-zinc-600">
                    {order.itemCount}{" "}
                    {order.itemCount === 1 ? "item" : "items"} ·{" "}
                    {formatProductPrice(order.totalAmount)}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
              <DetachAction
                busy={detachMutation.isPending}
                confirmMessage={`Detach order ${formatOrderNumber(order.id)} from this project? The order itself is unaffected.`}
                error={
                  detachMutation.isError &&
                  detachMutation.variables === order.id
                    ? getApiErrorMessage(
                        detachMutation.error,
                        "The order could not be detached.",
                      )
                    : undefined
                }
                label="Detach order"
                onDetach={() => detachMutation.mutate(order.id)}
                pending={
                  detachMutation.isPending &&
                  detachMutation.variables === order.id
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Shared pieces ─────────────────────────────────────────────────────────────

function GroupHeading({
  count,
  icon: Icon,
  label,
}: {
  count: number;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
      <Icon aria-hidden="true" className="size-4 text-zinc-400" />
      {label}
      <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
        {count}
      </span>
    </h3>
  );
}

/**
 * Detach control for one attached row. Detaching only clears the project link,
 * so the confirmation says so plainly; whether the project may then be
 * completed or deleted stays entirely a backend decision.
 */
function DetachAction({
  busy,
  confirmMessage,
  error,
  label,
  onDetach,
  pending,
}: {
  /** Any detach in this group is running — avoids overlapping requests. */
  busy: boolean;
  confirmMessage: string;
  error?: string;
  label: string;
  onDetach: () => void;
  /** This specific row is the one being detached. */
  pending: boolean;
}) {
  return (
    <div className="mt-2 border-t border-zinc-100 pt-2">
      <button
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring disabled:cursor-not-allowed disabled:opacity-60"
        disabled={busy}
        onClick={() => {
          if (window.confirm(confirmMessage)) {
            onDetach();
          }
        }}
        type="button"
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
        ) : (
          <Unlink aria-hidden="true" className="size-3.5" />
        )}
        {pending ? "Detaching..." : label}
      </button>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
