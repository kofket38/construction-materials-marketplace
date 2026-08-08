import {
  getProductBrand,
  getProductDeliveryStatus,
  getProductLocation,
  getProductMinimumOrder,
  humanizeSpecificationLabel,
  missingProductValue,
} from "@/features/products/lib/product-display";
import type { ProductDetails } from "@/features/products/model/product";

interface ProductSpecificationsProps {
  product: ProductDetails;
}

export function ProductSpecifications({
  product,
}: ProductSpecificationsProps) {
  const rows = buildSpecificationRows(product);

  return (
    <section aria-labelledby="specifications-heading">
      <h2
        className="text-xl font-semibold text-zinc-950"
        id="specifications-heading"
      >
        Product specifications
      </h2>
      <dl className="mt-5 overflow-hidden rounded-md border border-zinc-200 bg-white">
        {rows.map(([label, value], index) => (
          <div
            className={`grid grid-cols-[minmax(8rem,0.7fr)_minmax(0,1.3fr)] gap-4 px-4 py-3 text-sm sm:px-5 ${
              index > 0 ? "border-t border-zinc-200" : ""
            }`}
            key={label}
          >
            <dt className="font-medium text-zinc-600">{label}</dt>
            <dd className="break-words text-zinc-950">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function buildSpecificationRows(
  product: ProductDetails,
): Array<[string, string]> {
  const standardRows: Array<[string, string]> = [
    ["Brand", getProductBrand(product)],
    ["Category", product.category.name],
    ["Packaging", product.packaging?.trim() || missingProductValue],
    ["Weight", product.weight?.trim() || missingProductValue],
    [
      "Strength grade",
      product.strengthGrade?.trim() || missingProductValue,
    ],
    ["Origin", product.origin?.trim() || missingProductValue],
    ["Minimum order", getProductMinimumOrder(product)],
    ["Location", getProductLocation(product)],
    ["Delivery", getProductDeliveryStatus(product)],
  ];
  const standardLabels = new Set(
    standardRows.map(([label]) => label.toLowerCase()),
  );
  const customRows = Object.entries(product.specifications ?? {})
    .map(([key, value]): [string, string] => [
      humanizeSpecificationLabel(key),
      formatSpecificationValue(value),
    ])
    .filter(([label]) => !standardLabels.has(label.toLowerCase()));

  return [...standardRows, ...customRows];
}

function formatSpecificationValue(
  value: boolean | number | string | null,
): string {
  if (value === null || value === "") {
    return missingProductValue;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}
