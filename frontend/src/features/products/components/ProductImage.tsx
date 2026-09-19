/**
 * The single component every surface uses to show a product's picture.
 *
 * It renders exactly one of two things, and never anything in between:
 *
 *   1. the photograph stored for *this* product, or
 *   2. a neutral placeholder that is labelled as a placeholder.
 *
 * There is no third branch. It does not consult the product name, brand,
 * description or seller to pick an image, and it does not fall back to a
 * category stock photo — a plausible-looking substitute would misrepresent what
 * the seller is actually offering. `imageUrl` comes from the API (the backend
 * projects the primary `ProductImage` row into it), so passing it through is the
 * whole of the resolution rule.
 *
 * The component fills whatever frame the caller provides — the aspect ratio,
 * border and rounding stay with the call site, so a card, a gallery pane and a
 * 32px order-line thumbnail all reuse this without fighting over layout.
 */
import { useState } from "react";

import {
  categoryPlaceholderIconKey,
  placeholderIcons,
  productImageSrc,
} from "@/features/products/lib/product-image";

/**
 * Frame-relative scale. Drives the placeholder icon, whether the placeholder is
 * labelled, and how far a `contain` photograph is inset from the frame edge.
 *
 * `xs` suits the ~32–40px thumbnails in tables and order lines, `sm` the ~80–112px
 * line-item images, `md` a product card, `lg` the detail gallery's main pane.
 */
export type ProductImageSize = "xs" | "sm" | "md" | "lg";

interface SizeStyle {
  icon: string;
  iconStroke: number;
  /** Inset applied to a `contain` photograph so it does not touch the frame. */
  pad: string;
  /** `null` where the frame is too small to read a caption. */
  label: string | null;
}

const SIZE_STYLES: Record<ProductImageSize, SizeStyle> = {
  xs: { icon: "size-4", iconStroke: 1.5, pad: "", label: null },
  sm: { icon: "size-7", iconStroke: 1.5, pad: "p-2", label: null },
  md: { icon: "size-12", iconStroke: 1.35, pad: "p-4", label: "px-4 text-xs" },
  lg: {
    icon: "size-16",
    iconStroke: 1.25,
    pad: "p-5 sm:p-8",
    label: "px-6 text-sm",
  },
};

interface ProductImageProps {
  /**
   * The product's image URL exactly as the API returned it — normally
   * `product.imageUrl`, which is the backend's projection of the primary
   * `ProductImage` row. `null`/empty means "no photograph", which is a valid
   * answer and renders the placeholder.
   */
  imageUrl: string | null | undefined;
  /** Product name. Used for alt text and the placeholder's accessible name. */
  name: string;
  /**
   * Category name. Used *only* to choose the placeholder's neutral trade icon
   * and caption. It never selects a photograph.
   */
  categoryName?: string | null;
  /** `contain` shows the whole product (default); `cover` fills a small square. */
  fit?: "contain" | "cover";
  size?: ProductImageSize;
  /**
   * `true` where adjacent text already names the product, so the image is not
   * announced twice.
   */
  decorative?: boolean;
  loading?: "eager" | "lazy";
  /**
   * Called with the resolved URL when the photograph fails to load, after this
   * component has already switched to the placeholder. A gallery uses it to drop
   * a dead image from its strip rather than leave a placeholder tile in it.
   */
  onError?: (src: string) => void;
  /** Extra classes for whichever of the two branches renders. */
  className?: string;
}

export function ProductImage({
  imageUrl,
  name,
  categoryName,
  fit = "contain",
  size = "md",
  decorative = false,
  loading = "lazy",
  onError,
  className = "",
}: ProductImageProps) {
  // Tracking the URL that failed rather than a boolean means a new `imageUrl`
  // gets its own attempt without an effect to reset the flag.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const src = productImageSrc(imageUrl);
  const styles = SIZE_STYLES[size];

  if (src && src !== failedSrc) {
    const objectFit = fit === "cover" ? "object-cover" : "object-contain";
    const inset = fit === "contain" ? styles.pad : "";

    return (
      <img
        alt={decorative ? "" : name}
        className={`h-full w-full ${objectFit} ${inset} ${className}`.trim()}
        loading={loading}
        onError={() => {
          setFailedSrc(src);
          onError?.(src);
        }}
        src={src}
      />
    );
  }

  return (
    <ProductImagePlaceholder
      categoryName={categoryName}
      className={className}
      decorative={decorative}
      name={name}
      size={size}
    />
  );
}

/**
 * The honest answer for a product with no photograph: a neutral trade icon, and
 * where the frame is large enough, the category name as a caption. It carries
 * its own surface colour so it looks deliberate in any frame, and its accessible
 * name says plainly that no photograph exists.
 */
function ProductImagePlaceholder({
  categoryName,
  className,
  decorative,
  name,
  size,
}: {
  categoryName: string | null | undefined;
  className: string;
  decorative: boolean;
  name: string;
  size: ProductImageSize;
}) {
  const category = categoryName?.trim() ?? "";
  const styles = SIZE_STYLES[size];
  const Icon = placeholderIcons[categoryPlaceholderIconKey(category)];

  return (
    <div
      aria-hidden={decorative ? true : undefined}
      aria-label={
        decorative ? undefined : `No photograph available for ${name}`
      }
      className={`flex h-full w-full flex-col items-center justify-center gap-3 bg-raised text-ink-faint ${className}`.trim()}
      role={decorative ? undefined : "img"}
    >
      <Icon aria-hidden="true" className={styles.icon} strokeWidth={styles.iconStroke} />
      {styles.label && category ? (
        <span
          className={`text-center font-semibold uppercase tracking-wide ${styles.label}`}
        >
          {category}
        </span>
      ) : null}
    </div>
  );
}
