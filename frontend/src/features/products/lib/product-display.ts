import type {
  Product,
  ProductDetails,
} from "@/features/products/model/product";

const priceFormatter = new Intl.NumberFormat("en-ET", {
  style: "currency",
  currency: "ETB",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export const missingProductValue = "Not provided";

export function formatProductPrice(price: string): string {
  const numericPrice = Number(price);

  return Number.isFinite(numericPrice)
    ? priceFormatter.format(numericPrice)
    : `ETB ${price}`;
}

export function formatProductAvailability(product: Product): string {
  return product.quantity > 0
    ? `${product.quantity.toLocaleString()} units in stock`
    : "Out of stock";
}

export function getProductBrand(product: ProductDetails): string {
  return product.brand?.name?.trim() || missingProductValue;
}

export function getProductLocation(product: ProductDetails): string {
  const directLocation =
    product.location?.trim() ||
    product.seller.location?.trim() ||
    product.seller.address?.trim();

  if (directLocation) {
    return directLocation;
  }

  const inventory = product.inventory?.[0];
  if (inventory) {
    return [inventory.city, inventory.region]
      .filter(Boolean)
      .join(", ");
  }

  return [product.seller.city, product.seller.region]
    .filter(Boolean)
    .join(", ") || missingProductValue;
}

export function getProductDeliveryStatus(product: ProductDetails): string {
  if (product.deliveryStatus?.trim()) {
    return product.deliveryStatus;
  }

  const deliveryAvailable =
    product.deliveryAvailable ??
    product.inventory?.some((item) => item.deliveryAvailable);

  if (deliveryAvailable === true) {
    return "Delivery available";
  }

  if (deliveryAvailable === false) {
    return "Pickup only";
  }

  return missingProductValue;
}

export function getProductMinimumOrder(product: ProductDetails): string {
  if (
    product.minimumOrder === null ||
    product.minimumOrder === undefined ||
    product.minimumOrder === ""
  ) {
    return missingProductValue;
  }

  return typeof product.minimumOrder === "number"
    ? `${product.minimumOrder.toLocaleString()} units`
    : product.minimumOrder;
}

export function formatProductDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? missingProductValue
    : dateFormatter.format(date);
}

export function humanizeSpecificationLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
