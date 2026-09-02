import { FolderKanban } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import type { CheckoutFormValues } from "@/features/checkout/model/checkout.schema";
import { ProjectProcurementSelect } from "@/features/projects/components/ProjectProcurementSelect";
import { useCanAttachProcurement } from "@/features/projects/lib/procurement-attachment";

/**
 * Optional project attachment for the order being placed. The whole section is
 * absent for accounts that cannot own projects, so the customer checkout is
 * unchanged — no heading, no field, and no projectId in the request body.
 */
export function CheckoutProjectSection({ disabled }: { disabled: boolean }) {
  const canAttach = useCanAttachProcurement();
  const { control, setValue } = useFormContext<CheckoutFormValues>();
  const projectId = useWatch({ control, name: "projectId" });

  if (!canAttach) {
    return null;
  }

  return (
    <section
      aria-labelledby="checkout-project-heading"
      className="border-b border-zinc-200 py-8"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
          <FolderKanban aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2
            className="text-lg font-semibold text-zinc-950"
            id="checkout-project-heading"
          >
            Project procurement
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Group this order under one of your professional projects, or leave
            it standalone.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ProjectProcurementSelect
          description="Attached orders appear in the project's procurement view and count towards its completion checks until they settle."
          disabled={disabled}
          id="checkout-project"
          onChange={(next) =>
            setValue("projectId", next, { shouldDirty: true })
          }
          value={projectId}
        />
      </div>
    </section>
  );
}
