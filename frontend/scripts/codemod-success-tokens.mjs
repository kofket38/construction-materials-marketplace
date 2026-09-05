/**
 * Second pass of the brand migration: the places where green meant *success*,
 * not *brand*.
 *
 * The first codemod moved every emerald utility onto a brand token, because
 * emerald was the brand colour. This pass walks back the subset where green
 * carried real meaning — delivered, verified, approved, in stock, completed —
 * and puts it on the explicit `success` tokens instead. Those tokens invert
 * correctly in dark mode, which the raw emerald ramp could only do by accident.
 *
 * Every entry is an exact string match against one named file, and the script
 * fails loudly if a match is missing, so a refactor upstream cannot let one of
 * these silently revert to yellow.
 *
 * Usage: node scripts/codemod-success-tokens.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";

const dryRun = process.argv.includes("--dry");
const softBrand = "border-brand-line bg-brand-soft text-brand-ink";
const softSuccess = "border-success-line bg-success-soft text-success";

/** [file, from, to, occurrences] */
const edits = [
  // ── Status badges: positive terminal states ───────────────────────────────
  [
    "src/features/orders/components/OrderStatusBadge.tsx",
    `DELIVERED: "${softBrand}"`,
    `DELIVERED: "${softSuccess}"`,
  ],
  [
    "src/features/orders/components/OrderPaymentStatusBadge.tsx",
    `className: "${softBrand}"`,
    `className: "${softSuccess}"`,
  ],
  [
    "src/features/orders/components/PaymentProofStatusBadge.tsx",
    `VERIFIED: "${softBrand}"`,
    `VERIFIED: "${softSuccess}"`,
  ],
  [
    "src/features/orders/components/SellerWorkflowStatusBadge.tsx",
    `DELIVERED: "${softBrand}"`,
    `DELIVERED: "${softSuccess}"`,
  ],
  [
    "src/features/rfq/lib/rfq-display.ts",
    `case "ACCEPTED": return "${softBrand}";`,
    `case "ACCEPTED": return "${softSuccess}";`,
  ],
  [
    "src/features/admin/lib/admin-display.ts",
    `? "${softBrand}"`,
    `? "${softSuccess}"`,
  ],

  // ── Availability: green means "you can buy this" ──────────────────────────
  [
    "src/features/products/components/ProductCard.tsx",
    `isInStock ? "text-brand-ink" : "text-red-700"`,
    `isInStock ? "text-success" : "text-danger"`,
  ],
  [
    "src/features/products/components/ProductInfo.tsx",
    `isInStock ? "text-brand-ink" : "text-red-700"`,
    `isInStock ? "text-success" : "text-danger"`,
  ],
  [
    "src/pages/WishlistPage.tsx",
    `isInStock ? "text-brand-ink" : "text-red-700"`,
    `isInStock ? "text-success" : "text-danger"`,
  ],
  [
    "src/features/seller/pages/SellerInventoryPage.tsx",
    `border border-brand-line bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink">\n            <Truck`,
    `border border-success-line bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">\n            <Truck`,
  ],

  // ── Order timeline: completed is green, the current step keeps the accent ──
  [
    "src/features/orders/components/OrderTimeline.tsx",
    `isCompleted ? "bg-brand" : "bg-zinc-200"`,
    `isCompleted ? "bg-success" : "bg-zinc-200"`,
  ],
  [
    "src/features/orders/components/OrderTimeline.tsx",
    `? "border-brand bg-brand text-on-brand"`,
    `? "border-success-solid bg-success-solid text-on-success"`,
  ],

  // ── Awarded quotes ────────────────────────────────────────────────────────
  [
    "src/features/rfq/pages/RfqDetailPage.tsx",
    `isAwarded ? "border-brand-line" : "border-zinc-200"`,
    `isAwarded ? "border-success-line" : "border-zinc-200"`,
  ],
  [
    "src/features/rfq/pages/RfqDetailPage.tsx",
    `<span className="flex items-center gap-1 text-xs font-semibold text-brand-ink">\n              <CheckCircle2`,
    `<span className="flex items-center gap-1 text-xs font-semibold text-success">\n              <CheckCircle2`,
  ],
  [
    "src/features/rfq/pages/MyRfqsPage.tsx",
    `<p className="mt-3 text-sm font-semibold text-brand-ink">\n          ✓ Quote accepted`,
    `<p className="mt-3 text-sm font-semibold text-success">\n          ✓ Quote accepted`,
  ],

  // ── Verification marks and save confirmations ────────────────────────────
  [
    "src/features/checkout/components/PaymentProviders.tsx",
    `className="ml-auto size-5 shrink-0 text-brand-ink"`,
    `className="ml-auto size-5 shrink-0 text-success"`,
  ],
  [
    "src/features/professional-profile/pages/MyProfessionalProfilePage.tsx",
    `border-brand-line bg-brand-soft`,
    `border-success-line bg-success-soft`,
    2,
  ],
  [
    "src/features/seller/pages/SellerProfilePage.tsx",
    `border-brand-line bg-brand-soft`,
    `border-success-line bg-success-soft`,
  ],

  // ── Profile completion: full is success, partial keeps the accent ─────────
  [
    "src/features/professional-profile/pages/ProfessionalDashboardPage.tsx",
    `completion.percent === 100\n                ? "bg-brand"\n                : completion.percent >= 60\n                  ? "bg-brand"\n                  : "bg-amber-500"`,
    `completion.percent === 100\n                ? "bg-success-solid"\n                : completion.percent >= 60\n                  ? "bg-brand"\n                  : "bg-amber-500"`,
  ],
];

let applied = 0;
const failures = [];

/**
 * The repository has mixed line endings, so a multi-line needle has to be
 * rewritten to whichever style the target file actually uses — and the
 * replacement with it, so no file ends up with both.
 */
function matchLineEndings(text, source) {
  return source.includes("\r\n") ? text.replace(/\n/g, "\r\n") : text;
}

for (const [file, rawFrom, rawTo, expected = 1] of edits) {
  const source = readFileSync(file, "utf8");
  const from = matchLineEndings(rawFrom, source);
  const to = matchLineEndings(rawTo, source);
  const found = source.split(from).length - 1;

  if (found !== expected) {
    failures.push(`${file}: expected ${expected} match(es), found ${found}\n    ${from.split("\n")[0]}`);
    continue;
  }

  if (!dryRun) {
    writeFileSync(file, source.split(from).join(to), "utf8");
  }
  applied += found;
}

console.log(`${dryRun ? "[dry run] " : ""}replacements applied: ${applied}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} entr(ies) did not match:`);
  for (const failure of failures) console.error("  " + failure);
  process.exit(1);
}
