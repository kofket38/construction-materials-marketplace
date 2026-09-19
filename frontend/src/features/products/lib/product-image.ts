/**
 * The one place product imagery is resolved.
 *
 * The rule, and it has no exceptions: a product shows a photograph its *seller*
 * uploaded for that product, or it shows a neutral "Image not available" state.
 * CMM supplies no product photography of its own — no seeded catalog images, no
 * stock fallback, no brand guessing, no shared photo standing in for a category.
 *
 * `Product.imageUrl` is the backend's projection of the primary `ProductImage`
 * row (`product.images[0]?.imageUrl ?? product.imageUrl`, ordered `isPrimary`
 * desc), so trusting it is the same thing as reading the primary record. The
 * detail gallery additionally fetches the full record set; every other surface —
 * card, catalog, search, category, cart, wishlist, orders, storefront — reads
 * the same `imageUrl` and therefore shows the same image for the same product.
 *
 * A placeholder is the correct, honest answer for a product without a
 * photograph. Filling the slot with something plausible would misrepresent what
 * the seller is offering.
 */
import {
  Blocks,
  Cable,
  Construction,
  Droplets,
  Hammer,
  ImageOff,
  PaintBucket,
  Package,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Paths the retired CMM-owned catalog images were stored under. Those files were
 * deleted with the seeded-image strategy, so a row still holding one is stale
 * data pointing at a 404 — worth recognising rather than handing to `<img src>`
 * and watching it fail.
 *
 * The seed clears these on its next run; this guard is what keeps a database
 * that has not been re-seeded from showing a column of broken images in the
 * meantime.
 */
const RETIRED_CATALOG_IMAGE_PREFIX = "/images/products/";

/**
 * The `src` to render for a stored product image, or `null` when there is
 * nothing to render.
 *
 * Seller uploads validate to an absolute `http(s)` URL server-side and are used
 * verbatim. Root-relative paths are still accepted — the app serves `public/`
 * and product media never goes through the API — with one exception: a path
 * under the retired catalog directory resolves to `null`, because no such file
 * exists any more.
 *
 * Any other scheme (`javascript:`, `data:`, a typo) is refused, so a stray
 * stored value falls back to the empty state instead of reaching `<img src>`.
 */
export function productImageSrc(
  imageUrl: string | null | undefined,
): string | null {
  const trimmed = imageUrl?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith(RETIRED_CATALOG_IMAGE_PREFIX)) {
    return null;
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  if (hasScheme && !/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * The full ordered list of image URLs for a product's gallery: the primary image
 * first, then the remaining records, de-duplicated.
 *
 * `primaryImageUrl` is included so the gallery can paint the image the list view
 * already had while the records request is still in flight. A product with no
 * uploads returns an empty array, which is a valid answer and not an error.
 */
export function productImageUrls(
  primaryImageUrl: string | null | undefined,
  records: readonly { imageUrl: string }[] = [],
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const candidate of [primaryImageUrl, ...records.map((r) => r.imageUrl)]) {
    const src = productImageSrc(candidate);
    if (src && !seen.has(src)) {
      seen.add(src);
      urls.push(src);
    }
  }

  return urls;
}

/**
 * A neutral trade icon for a *category* with no photograph, chosen from the
 * category name only.
 *
 * Product surfaces no longer use this: a product with no seller upload gets one
 * neutral "Image not available" state, because a category-flavoured graphic is
 * still CMM artwork standing where a seller's photograph belongs. Category
 * tiles, which are UI chrome for a class of material rather than a listing, are
 * the remaining caller.
 *
 * The classifier returns a key and the icons live in a module-level record, so
 * the component a caller renders is always one of a fixed set rather than a
 * value produced during render.
 */
export type PlaceholderIconKey =
  | "aggregate"
  | "electrical"
  | "generic"
  | "masonry"
  | "none"
  | "paint"
  | "plumbing"
  | "steel"
  | "timber"
  | "tools";

export const placeholderIcons: Record<PlaceholderIconKey, LucideIcon> = {
  aggregate: Warehouse,
  electrical: Cable,
  generic: Package,
  masonry: Blocks,
  none: ImageOff,
  paint: PaintBucket,
  plumbing: Droplets,
  steel: Construction,
  timber: Hammer,
  tools: Wrench,
};

export function categoryPlaceholderIconKey(
  categoryName: string,
): PlaceholderIconKey {
  const category = categoryName.toLowerCase();

  if (category.includes("electric") || category.includes("wiring")) {
    return "electrical";
  }
  if (category.includes("plumb") || category.includes("water")) {
    return "plumbing";
  }
  if (category.includes("paint") || category.includes("finish")) {
    return "paint";
  }
  if (
    category.includes("aggregate") ||
    category.includes("sand") ||
    category.includes("gravel")
  ) {
    return "aggregate";
  }
  if (
    category.includes("cement") ||
    category.includes("concrete") ||
    category.includes("block") ||
    category.includes("brick")
  ) {
    return "masonry";
  }
  if (
    category.includes("steel") ||
    category.includes("rebar") ||
    category.includes("roof") ||
    category.includes("metal")
  ) {
    return "steel";
  }
  if (category.includes("tool") || category.includes("equipment")) {
    return "tools";
  }
  if (category.includes("timber") || category.includes("wood")) {
    return "timber";
  }
  if (category.trim().length === 0) {
    return "none";
  }

  return "generic";
}

/**
 * Category photography, resolved from the category name by the same kind of
 * keyword rules that pick its placeholder icon.
 *
 * A category is a *class* of material, so unlike a product it can honestly be
 * illustrated by a stock photograph of that class — a bag of cement does
 * represent "Cement". The mapping is still deterministic: one key per file in
 * `public/images/categories/`, resolved from the name, never chosen at random
 * and never shared between two unrelated classes.
 *
 * Returns `null` for a name that matches nothing, which is what lets a caller
 * fall back to the placeholder icon instead of showing a misleading picture.
 */
export type CategoryImageKey =
  | "aggregates"
  | "cement"
  | "doors-windows"
  | "electrical"
  | "masonry"
  | "paint"
  | "plumbing"
  | "roofing"
  | "sanitary"
  | "steel"
  | "tiles"
  | "timber"
  | "waterproofing";

/**
 * Ordered, and the order is load-bearing: "Waterproofing" contains both "water"
 * and — count the letters — "roofing", so it has to be tested before plumbing
 * and roofing or it would resolve to one of them.
 */
const CATEGORY_IMAGE_RULES: readonly (readonly [
  CategoryImageKey,
  readonly string[],
])[] = [
  ["waterproofing", ["waterproof", "membrane", "damp"]],
  ["cement", ["cement", "mortar"]],
  ["steel", ["steel", "rebar", "reinforc", "metal"]],
  ["masonry", ["masonry", "block", "brick"]],
  ["tiles", ["tile", "floor"]],
  ["roofing", ["roof"]],
  ["aggregates", ["aggregate", "sand", "gravel", "ballast"]],
  ["paint", ["paint", "finish", "coating"]],
  ["electrical", ["electric", "wiring", "cable"]],
  ["plumbing", ["plumb", "pipe", "water"]],
  ["doors-windows", ["door", "window", "glazing"]],
  ["timber", ["timber", "wood", "board", "plywood"]],
  ["sanitary", ["sanitary", "bathroom", "toilet", "shower"]],
];

export function categoryImageKey(categoryName: string): CategoryImageKey | null {
  const category = categoryName.toLowerCase();
  if (category.trim().length === 0) {
    return null;
  }

  for (const [key, keywords] of CATEGORY_IMAGE_RULES) {
    if (keywords.some((keyword) => category.includes(keyword))) {
      return key;
    }
  }

  return null;
}

/** The `src` for a category's photograph, or `null` when it has none. */
export function categoryImageSrc(categoryName: string): string | null {
  const key = categoryImageKey(categoryName);
  return key ? `/images/categories/${key}.png` : null;
}
