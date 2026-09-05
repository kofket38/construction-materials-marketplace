import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface BreadcrumbProps {
  categoryId: string;
  categoryName: string;
  productName: string;
}

export function Breadcrumb({
  categoryId,
  categoryName,
  productName,
}: BreadcrumbProps) {
  const categorySearch = new URLSearchParams({ categoryId }).toString();

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm text-zinc-500">
        <BreadcrumbLink label="Home" to="/" />
        <BreadcrumbSeparator />
        <BreadcrumbLink label="Catalog" to="/products" />
        <BreadcrumbSeparator />
        <BreadcrumbLink
          label={categoryName}
          to={`/products?${categorySearch}`}
        />
        <BreadcrumbSeparator />
        <li
          aria-current="page"
          className="min-w-0 truncate font-medium text-zinc-900"
          title={productName}
        >
          {productName}
        </li>
      </ol>
    </nav>
  );
}

function BreadcrumbLink({ label, to }: { label: string; to: string }) {
  return (
    <li className="shrink-0">
      <Link
        className="transition-colors hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
        to={to}
      >
        {label}
      </Link>
    </li>
  );
}

function BreadcrumbSeparator() {
  return (
    <li aria-hidden="true" className="shrink-0 text-zinc-300">
      <ChevronRight className="size-3.5" />
    </li>
  );
}
