/**
 * SellerOnboardingBanner
 *
 * Shown on the seller dashboard to guide newly registered sellers through the
 * two required setup steps:
 *   1. Create a store profile (shopName + payment accounts)
 *   2. Add at least one inventory listing (city + price + stock)
 *
 * Once both steps are complete the banner disappears automatically.
 * Neither step blocks access to any other seller page.
 */
import { ArrowRight, BadgeCheck, Boxes, CheckCircle2, Store } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getSellerProfile } from "@/features/seller/api/seller-profile.api";
import { getSellerInventory } from "@/features/seller/api/seller-inventory.api";
import { useAuthStore } from "@/features/auth/model/auth.store";

export function SellerOnboardingBanner() {
  const user = useAuthStore((state) => state.user);
  const authStatus = useAuthStore((state) => state.status);
  const isActiveSeller = authStatus === "authenticated" && user?.role === "SELLER";

  // Fetch profile — null means not yet created.
  const profileQuery = useQuery({
    queryKey: ["seller", "profile"],
    enabled: isActiveSeller,
    queryFn: ({ signal }) => getSellerProfile(signal),
    staleTime: 30_000,
  });

  // Fetch inventory with limit=1 — just need total.
  const inventoryQuery = useQuery({
    queryKey: ["seller", "inventory", { page: 1, limit: 1 }],
    enabled: isActiveSeller,
    queryFn: ({ signal }) => getSellerInventory({ page: 1, limit: 1 }, signal),
    staleTime: 30_000,
  });

  // Don't render until both queries have resolved at least once.
  if (profileQuery.isPending || inventoryQuery.isPending) {
    return null;
  }

  const hasProfile = profileQuery.data !== null;
  const hasInventory = (inventoryQuery.data?.pagination.total ?? 0) > 0;

  // Both complete — nothing to show.
  if (hasProfile && hasInventory) {
    return null;
  }

  const steps: Array<{
    id: number;
    icon: typeof Store;
    title: string;
    description: string;
    href: string;
    cta: string;
    done: boolean;
  }> = [
    {
      id: 1,
      icon: Store,
      title: "Complete your store profile",
      description:
        "Add your shop name, address, and payment account numbers so buyers can find and pay you.",
      href: "/seller/profile",
      cta: "Set up profile",
      done: hasProfile,
    },
    {
      id: 2,
      icon: Boxes,
      title: "Add your first inventory listing",
      description:
        "Choose a product, set the city, price, and available stock. Buyers can only see you in cities where you have active inventory.",
      href: "/seller/inventory",
      cta: "Add inventory",
      done: hasInventory,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <section
      aria-label="Seller setup checklist"
      className="mb-6 overflow-hidden rounded-md border border-amber-200 bg-amber-50"
    >
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-amber-200 px-4 py-4 sm:px-5">
        <BadgeCheck
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-amber-700"
        />
        <div className="min-w-0">
          <p className="font-semibold text-amber-900">
            Welcome! Complete your store setup ({completedCount} of{" "}
            {steps.length} done)
          </p>
          <p className="mt-0.5 text-sm text-amber-800">
            Finish both steps below so buyers can discover your products and
            place orders.
          </p>
        </div>
      </div>

      {/* Steps */}
      <ol className="divide-y divide-amber-200">
        {steps.map((step) => (
          <li
            className={`flex items-start gap-4 px-4 py-4 sm:px-5 ${
              step.done ? "opacity-60" : ""
            }`}
            key={step.id}
          >
            {/* Step indicator */}
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center">
              {step.done ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="size-6 text-emerald-600"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-6 items-center justify-center rounded-full border-2 border-amber-400 text-xs font-bold text-amber-800"
                >
                  {step.id}
                </span>
              )}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={`font-semibold ${
                      step.done ? "text-zinc-600" : "text-zinc-950"
                    }`}
                  >
                    <step.icon
                      aria-hidden="true"
                      className="mr-1.5 inline-block size-4 align-text-bottom text-amber-700"
                    />
                    {step.title}
                    {step.done ? (
                      <span className="ml-2 text-xs font-semibold text-emerald-600">
                        Done
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    {step.description}
                  </p>
                </div>

                {!step.done ? (
                  <Link
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                    to={step.href}
                  >
                    {step.cta}
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
