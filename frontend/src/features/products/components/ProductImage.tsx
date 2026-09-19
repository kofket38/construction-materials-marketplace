/**
 * The single component every surface uses to show a product's picture.
 *
 * It renders exactly one of two things, and never anything in between:
 *
 *   1. the photograph the *seller* uploaded for this product, or
 *   2. a neutral, labelled "Image not available" state.
 *
 * There is no third branch. CMM ships no product photography of its own: it does
 * not consult the product name, brand, description or seller to pick an image,
 * it does not fall back to a category stock photo, and it has no bundled
 * placeholder photograph to fall back to. A plausible-looking substitute would
 * misrepresent what the seller is actually offering. `imageUrl` comes from the
 * API (the backend projects the primary `ProductImage` row into it), so passing
 * it through is the whole of the resolution rule.
 *
 * The component fills whatever frame the caller provides — the aspect ratio,
 * border and rounding stay with the call site, so a card, a gallery pane and a
 * 32px order-line thumbnail all reuse this without fighting over layout.
 */
import { ImageOff } from "lucide-react";
import { useState, type ReactNode } from "react";

import { productImageSrc } from "@/features/products/lib/product-image";

/**
 * Frame-relative scale. Drives the empty-state icon, whether the empty state is
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
   * Accepted and ignored.
   *
   * It used to pick a trade icon for the empty state. The empty state is now one
   * neutral "Image not available" slot for every product, because a
   * category-flavoured graphic is still CMM-supplied imagery standing where a
   * seller's photograph belongs. The prop stays so the many call sites that pass
   * a category need no edit, and so nothing can quietly start selecting artwork
   * from it again.
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
  /**
   * Rendered inside the empty state, below the label — this is where a
   * seller-facing surface puts its "Upload product image" control. Ignored when
   * a photograph is shown, when the frame is a thumbnail, and when the image is
   * decorative, so a shopper-facing card can simply omit it.
   */
  emptyAction?: ReactNode;
  /** Extra classes for whichever of the two branches renders. */
  className?: string;
}

export function ProductImage({
  imageUrl,
  name,
  fit = "contain",
  size = "md",
  decorative = false,
  loading = "lazy",
  onError,
  emptyAction,
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
    <ProductImageEmptyState
      action={emptyAction}
      className={className}
      decorative={decorative}
      name={name}
      size={size}
    />
  );
}

/**
 * The honest answer for a product the seller has not photographed yet.
 *
 * It is a labelled empty state, not a picture: a neutral outline icon and the
 * words "Image not available" where the frame is big enough to read them. It
 * carries its own surface colour and a soft dashed edge so it reads as a
 * deliberate slot rather than a failed image, and its accessible name says
 * plainly that no photograph exists.
 *
 * `action` is where a seller-facing surface hangs an "Upload product image"
 * control. It is rendered only in frames large enough to hold it, and never on a
 * decorative thumbnail, so a shopper-facing card can pass nothing and get the
 * same empty state without a stray button in it.
 */
function ProductImageEmptyState({
  action,
  className,
  decorative,
  name,
  size,
}: {
  action: ReactNode;
  className: string;
  decorative: boolean;
  name: string;
  size: ProductImageSize;
}) {
  const styles = SIZE_STYLES[size];
  const showAction = Boolean(action) && !decorative && styles.label !== null;

  return (
    <div
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : `Image not available for ${name}`}
      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-raised text-ink-faint ${className}`.trim()}
      role={decorative ? undefined : "img"}
    >
      <ImageOff
        aria-hidden="true"
        className={styles.icon}
        strokeWidth={styles.iconStroke}
      />
      {styles.label ? (
        <span className={`text-center font-medium ${styles.label}`}>
          Image not available
        </span>
      ) : null}
      {showAction ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
