/**
 * The one place product imagery is resolved.
 *
 * The rule, and it has no exceptions: a product shows a photograph that belongs
 * to *that* product, or it shows a neutral placeholder. There is no matching
 * step, no brand guessing, no shared stock photo standing in for a category.
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
 * The `src` to render for a stored product image, or `null` when there is
 * nothing to render.
 *
 * Stored values come in two shapes and both are used verbatim: an absolute
 * `http(s)` URL, which is what managed `ProductImage` records validate to, and a
 * root-relative path such as `/images/products/dangote-cement.png`, which the
 * seeded catalog uses and this app serves from `public/`. Product media is never
 * served by the API — proofs are, through an authenticated endpoint — so
 * rewriting a relative path onto the API origin would point it at a host that
 * has no such file.
 *
 * Any other scheme (`javascript:`, `data:`, a typo) is refused, so a stray
 * stored value falls back to the placeholder instead of reaching `<img src>`.
 */
export function productImageSrc(
  imageUrl: string | null | undefined,
): string | null {
  const trimmed = imageUrl?.trim();
  if (!trimmed) {
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
 * already had while the records request is still in flight.
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
 * A neutral trade icon for a product with no photograph, chosen from the
 * category name only. It illustrates the category, and the placeholder is
 * labelled as such, so it is never mistaken for a picture of the product.
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
