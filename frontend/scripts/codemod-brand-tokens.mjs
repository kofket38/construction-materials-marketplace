/**
 * One-off codemod: move the app from the old emerald brand onto the engineering
 * yellow token layer.
 *
 * Emerald was the brand colour, so the default reading of any emerald utility is
 * "brand chrome" and it maps onto a brand token. The exceptions are the places
 * where green means availability, approval or completion; those are converted to
 * the explicit `success` tokens in a separate hand pass afterwards, which is why
 * this script reports every occurrence it touched.
 *
 * Yellow cannot do both jobs emerald did at shade 700 — a yellow readable as text
 * on white is a dark gold, and a yellow that looks like a button needs near-black
 * ink — so the mapping is keyed on the CSS property, not only the shade.
 *
 * Usage: node scripts/codemod-brand-tokens.mjs [--dry]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dryRun = process.argv.includes("--dry");
const root = new URL("../src/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

/** Utility → how its emerald shades map onto brand tokens. */
function mapEmerald(utility, shade, variants) {
  const isHover = /(^|:)hover:/.test(variants);
  const isActive = /(^|:)active:/.test(variants);
  const n = Number(shade);

  switch (utility) {
    case "bg":
      if (n <= 100) return isHover ? "brand-soft-hover" : "brand-soft";
      if (n <= 300) return `brand-${shade}`;
      if (isActive) return "brand-press";
      return isHover ? "brand-hover" : "brand";
    case "text":
      return n <= 300 ? `brand-${shade}` : "brand-ink";
    case "border":
      return n <= 300 ? "brand-line" : "brand";
    case "ring":
    case "outline":
      return "brand-ring";
    case "divide":
      return "brand-line";
    case "from":
    case "via":
    case "to":
      return `brand-${shade}`;
    case "fill":
    case "stroke":
      return n <= 300 ? `brand-${shade}` : "brand";
    case "accent":
    case "caret":
      return "brand";
    case "decoration":
    case "placeholder":
      return "brand-ink";
    case "shadow":
      return "brand-500";
    default:
      return null;
  }
}

const utilityPattern =
  /((?:(?:[a-z][a-z0-9-]*|\[[^\]]*\]|group-[a-z-]+|peer-[a-z-]+|data-\[[^\]]*\]|aria-\[[^\]]*\]):)*)(bg|text|border|ring|outline|divide|from|via|to|fill|stroke|accent|caret|decoration|placeholder|shadow)-emerald-(\d{2,3})(\/\d+)?\b/g;

/** Non-emerald renames that also have to happen for dark mode to be correct. */
const literalRenames = [
  // Backdrops must stay dark on both themes; zinc-950 inverts to near-white.
  [/\bbg-zinc-950\/(\d+)\b/g, "bg-scrim/$1"],
  // The page canvas is a token now.
  [/\bbg-stone-50\b/g, "bg-canvas"],
  [/\bbg-stone-100\b/g, "bg-raised"],
  [/\bborder-stone-200\b/g, "border-line"],
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else if (/\.(tsx|ts)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Finds the string literal containing `index` so `text-white` can be corrected
 * only inside the same className value that received a brand fill.
 */
function enclosingLiteral(source, index) {
  const quotes = ['"', "'", "`"];
  let best = null;
  for (const quote of quotes) {
    const start = source.lastIndexOf(quote, index);
    if (start === -1) continue;
    const end = source.indexOf(quote, index);
    if (end === -1) continue;
    if (best === null || start > best.start) best = { start, end };
  }
  return best;
}

const files = walk(root);
let changedFiles = 0;
const touched = [];
const whiteOnBrandWarnings = [];

for (const file of files) {
  const original = readFileSync(file, "utf8");
  let next = original;
  const replacements = [];

  next = next.replace(
    utilityPattern,
    (match, variants, utility, shade, opacity = "") => {
      const token = mapEmerald(utility, shade, variants);
      if (!token) return match;
      const result = `${variants}${utility}-${token}${opacity}`;
      replacements.push(`${match} → ${result}`);
      return result;
    },
  );

  for (const [pattern, replacement] of literalRenames) {
    next = next.replace(pattern, (match, ...rest) => {
      const result = match.replace(pattern, replacement);
      replacements.push(`${match} → ${result}`);
      return result;
    });
  }

  // A brand fill with white ink measures 1.86:1. Fix it inside the same literal.
  const fillPattern = /\bbg-brand(?:-hover|-press)?\b/g;
  let fillMatch;
  const fixedRanges = [];
  while ((fillMatch = fillPattern.exec(next)) !== null) {
    const literal = enclosingLiteral(next, fillMatch.index);
    if (!literal) continue;
    if (fixedRanges.some((range) => range.start === literal.start)) continue;
    const slice = next.slice(literal.start, literal.end);
    if (!/\btext-white\b/.test(slice)) continue;
    fixedRanges.push(literal);
  }
  for (const range of fixedRanges.reverse()) {
    const slice = next.slice(range.start, range.end);
    next =
      next.slice(0, range.start) +
      slice.replace(/\btext-white\b/g, "text-on-brand") +
      next.slice(range.end);
    replacements.push("text-white → text-on-brand (on brand fill)");
  }

  // Anything still pairing a brand fill with white ink across separate literals
  // has to be reviewed by hand; report it rather than guessing at scope.
  const residual = /\bbg-brand(?:-hover|-press)?\b/g;
  let residualMatch;
  while ((residualMatch = residual.exec(next)) !== null) {
    const window = next.slice(
      Math.max(0, residualMatch.index - 400),
      residualMatch.index + 400,
    );
    if (/\btext-white\b/.test(window)) {
      const line = next.slice(0, residualMatch.index).split("\n").length;
      whiteOnBrandWarnings.push(
        `${file.replace(root, "")}:${line}  ${residualMatch[0]}`,
      );
    }
  }

  if (next !== original) {
    changedFiles += 1;
    touched.push(`${file.replace(root, "")}  (${replacements.length})`);
    if (!dryRun) writeFileSync(file, next, "utf8");
  }
}

console.log(`${dryRun ? "[dry run] " : ""}files changed: ${changedFiles}`);
for (const entry of touched) console.log("  " + entry);

if (whiteOnBrandWarnings.length > 0) {
  console.log("\nreview by hand — white ink near a brand fill:");
  for (const warning of [...new Set(whiteOnBrandWarnings)]) {
    console.log("  " + warning);
  }
}
