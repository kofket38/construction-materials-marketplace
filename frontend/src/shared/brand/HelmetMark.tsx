/**
 * CMM's brand symbol: a safety helmet.
 *
 * A hard hat is the one object every party on a construction site shares — the
 * engineer specifying the material, the supplier loading it, the crew placing
 * it — so it identifies the marketplace without borrowing anyone's trade mark.
 *
 * Drawn as a single filled path so it stays crisp at the 16px favicon end and
 * the 96px landing end alike, with no stroke weights to rescale. The three
 * crown ridges are subtractive subpaths under `fill-rule="evenodd"`, which means
 * they show whatever sits behind the mark rather than a hard-coded colour — the
 * same path works on a yellow badge, on charcoal, and in the favicon.
 *
 * The shape uses `currentColor`, so callers set the colour with a text utility.
 */

interface HelmetMarkProps {
  className?: string;
}

export function HelmetMark({ className }: HelmetMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      focusable="false"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.1 15a6.9 6.9 0 0 1 13.8 0Z
           M11.6 8.45h0.8v6.55h-0.8z
           M8.5 10.7h0.7v4.3h-0.7z
           M14.8 10.7h0.7v4.3h-0.7z"
        fillRule="evenodd"
      />
      <path d="M3.3 14.9h17.4a1.6 1.6 0 0 1 0 3.2H3.3a1.6 1.6 0 0 1 0-3.2Z" />
    </svg>
  );
}
