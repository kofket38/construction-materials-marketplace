/**
 * The CMM lock-up: helmet badge, "CMM", and the full name.
 *
 * One component owns the brand so a header, a sidebar, an auth screen and the
 * landing hero can never drift apart, and so the mark is changed in one place.
 * Callers pick a variant rather than assembling their own arrangement:
 *
 *   `mark`    badge only — tight spots, and next to a separate workspace title
 *   `compact` badge + "CMM" — mobile headers and narrow bars
 *   `full`    badge + "CMM" over the full name — desktop header, auth, footer
 *
 * The badge is brand yellow with near-black ink, which is the only ink allowed
 * on a brand fill (white measures 1.86:1 on it). `text-on-brand` rather than
 * `text-white` also keeps the ink-contrast guard quiet.
 */
import { Link } from "react-router-dom";

import { HelmetMark } from "@/shared/brand/HelmetMark";

export type CmmLogoVariant = "mark" | "compact" | "full";
export type CmmLogoSize = "sm" | "md" | "lg";

const BADGE_SIZES: Record<CmmLogoSize, string> = {
  sm: "size-9 rounded-md",
  md: "size-10 rounded-lg",
  lg: "size-14 rounded-xl",
};

const MARK_SIZES: Record<CmmLogoSize, string> = {
  sm: "size-6",
  md: "size-7",
  lg: "size-9",
};

const WORDMARK_SIZES: Record<CmmLogoSize, string> = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-3xl",
};

interface CmmLogoProps {
  variant?: CmmLogoVariant;
  size?: CmmLogoSize;
  className?: string;
}

export function CmmLogo({
  variant = "full",
  size = "sm",
  className = "",
}: CmmLogoProps) {
  return (
    <span className={`flex min-w-0 items-center gap-2.5 ${className}`.trim()}>
      <span
        className={`flex shrink-0 items-center justify-center bg-brand text-on-brand ${BADGE_SIZES[size]}`}
      >
        <HelmetMark className={MARK_SIZES[size]} />
      </span>
      {variant === "mark" ? null : (
        <span className="flex min-w-0 flex-col leading-none">
          <span
            className={`font-extrabold tracking-tight text-zinc-950 ${WORDMARK_SIZES[size]}`}
          >
            CMM
          </span>
          {variant === "full" ? (
            /* Dropped below `sm` so `full` is safe to use in a header without a
               second lock-up: a 320px bar shows badge + "CMM", and the descriptor
               appears as soon as there is room for it unabbreviated. */
            <span className="mt-1 hidden truncate text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 sm:block">
              Construction Materials
            </span>
          ) : null}
        </span>
      )}
    </span>
  );
}

/**
 * The header/sidebar form: the lock-up as a link home, with the accessible name
 * spelling out what "CMM" stands for so it is not read as three letters.
 */
export function CmmLogoLink({
  to = "/",
  variant = "full",
  size = "sm",
  className = "",
}: CmmLogoProps & { to?: string }) {
  return (
    <Link
      aria-label="CMM — Construction Materials Marketplace, home"
      className={`flex min-w-0 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring ${className}`.trim()}
      to={to}
    >
      <CmmLogo size={size} variant={variant} />
    </Link>
  );
}
