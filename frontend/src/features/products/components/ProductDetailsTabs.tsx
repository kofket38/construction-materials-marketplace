import type { KeyboardEvent, ReactNode } from "react";

export type ProductDetailsTab = "description" | "specifications" | "reviews";

const tabs = [
  { id: "description", label: "Description" },
  { id: "specifications", label: "Specifications" },
  { id: "reviews", label: "Reviews" },
] as const satisfies ReadonlyArray<{
  id: ProductDetailsTab;
  label: string;
}>;

interface ProductDetailsTabsProps {
  activeTab: ProductDetailsTab;
  description: ReactNode;
  onChange: (tab: ProductDetailsTab) => void;
  reviews: ReactNode;
  specifications: ReactNode;
}

export function ProductDetailsTabs({
  activeTab,
  description,
  onChange,
  reviews,
  specifications,
}: ProductDetailsTabsProps) {
  const content = {
    description,
    specifications,
    reviews,
  } satisfies Record<ProductDetailsTab, ReactNode>;

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ): void {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    if (!nextTab) {
      return;
    }

    onChange(nextTab.id);
    document.getElementById(`product-tab-${nextTab.id}`)?.focus();
  }

  return (
    <section className="mt-12 scroll-mt-24" id="product-details">
      <div
        aria-label="Product information"
        className="flex overflow-x-auto border-b border-zinc-200"
        role="tablist"
      >
        {tabs.map((tab, index) => (
          <button
            aria-controls={`product-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            className={`min-h-12 shrink-0 border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-ring sm:px-6 ${
              activeTab === tab.id
                ? "border-brand text-brand-ink"
                : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-950"
            }`}
            id={`product-tab-${tab.id}`}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            role="tab"
            tabIndex={activeTab === tab.id ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        aria-labelledby={`product-tab-${activeTab}`}
        className="py-8"
        id={`product-panel-${activeTab}`}
        role="tabpanel"
        tabIndex={0}
      >
        {content[activeTab]}
      </div>
    </section>
  );
}
