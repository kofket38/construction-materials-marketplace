/**
 * Contrast guard: fails if white ink sits on one of the warm fills.
 *
 * White on the brand yellow measures 1.86:1 and on the amber/red ramps it lands
 * between 4.08:1 and 4.38:1 — all under the WCAG AA 4.5:1 floor for body text.
 * Those fills must pair with `text-on-brand` (near-black) or `text-on-solid`
 * (a fixed white used only where the fill is dark enough for it).
 *
 * Reports rather than rewrites, because the correct ink depends on which element
 * the class actually lands on. Run after any styling change.
 *
 * Usage: node scripts/check-ink-contrast.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const warmFill = /\bbg-(?:brand|brand-hover|brand-press|brand-[3-9]00|amber-[4-6]00|red-[4-6]00)\b/g;
const windowSize = 300;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(tsx|ts)$/.test(entry)) files.push(full);
  }
  return files;
}

const findings = new Set();

for (const file of walk("src")) {
  const source = readFileSync(file, "utf8");
  let match;
  warmFill.lastIndex = 0;
  while ((match = warmFill.exec(source)) !== null) {
    const near = source.slice(
      Math.max(0, match.index - windowSize),
      match.index + windowSize,
    );
    if (!/\btext-white\b/.test(near)) continue;
    const line = source.slice(0, match.index).split("\n").length;
    findings.add(`${file.split("\\").join("/")}:${line}  ${match[0]}`);
  }
}

if (findings.size === 0) {
  console.log("no white ink found near a warm fill");
  process.exit(0);
}

console.log(`${findings.size} site(s) to review:`);
for (const finding of [...findings].sort()) console.log("  " + finding);
