/**
 * Sources the marketplace's *UI* photography from Wikimedia Commons: the
 * category tiles and the homepage hero, and nothing else.
 *
 * Product photography is explicitly out of scope. CMM does not ship product
 * images — sellers upload their own through the `ProductImage` endpoints — and a
 * product with no seller upload renders a labelled "Image not available" state
 * rather than a stand-in picture. The product slots this script used to carry
 * were removed with the seeded assets themselves; do not add them back.
 *
 * Why this remains a script rather than a one-off download: every photograph
 * shipped in `public/images` needs a recorded provenance — title, author,
 * licence and the Commons file page — and a hand-run download loses that within
 * a week. Running this writes both the images and `image-credits.json` beside
 * them, so the attribution can never drift from the files it describes.
 *
 * Usage:
 *   node scripts/source-material-photos.mjs                     # every slot
 *   node scripts/source-material-photos.mjs --only=cement       # re-source one
 *   node scripts/source-material-photos.mjs --only=x --index=2  # next candidate
 *   node scripts/source-material-photos.mjs --list=steel        # inspect matches
 *
 * Downloads land in `.image-staging/` (git-ignored). `convert-material-photos.ps1`
 * turns them into the PNGs the application serves.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(scriptDir, "..");
const stageDir = join(frontendDir, ".image-staging");

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT =
  "CMM-marketplace-asset-sourcing/1.0 (construction materials marketplace build tooling)";

/** Thumbnail width requested from Commons. Wider than any rendered slot so the
 *  downscale to 4:3 always has pixels to spare. */
const SOURCE_WIDTH = 1400;

/** A licence must be one of these to ship. Commons hosts a small amount of
 *  non-free material under exemptions; none of it belongs in a product catalog. */
const ALLOWED_LICENCE = /^(?:CC0(?: 1\.0)?|CC BY(?:-SA)? [1-4]\.[05]|Public domain|FAL(?: 1\.[123])?|Attribution)$/i;

/**
 * One photograph per category the seed actually creates. Keys match
 * `categoryImageKey()` in `src/features/products/lib/product-image.ts`, so a
 * category name resolves to its picture by the same keyword rules that already
 * choose its placeholder icon — nothing is assigned by hand or at random.
 */
const CATEGORY_SLOTS = [
  ["cement", "cement bags stacked", "File:Portland Cement Bags.jpg"],
  [
    "steel",
    "steel reinforcement bars construction",
    "File:US Navy 040914-N-2970T-029 Builder 3rd Class Mark Dyas, assigned to Naval Mobile Construction Battalion One Three Three (NMCB-133), Detail Sasebo, slices through a steel reinforcement bar.jpg",
  ],
  // The LIRR photograph is titled for its block wall but the frame is dominated by
  // scaffolding in a dim concourse; the wall is barely visible. A foundation wall
  // going up in daylight shows the same trade and actually shows the blocks.
  [
    "masonry",
    "concrete blocks building wall",
    "File:Foundation Wall Construction.jpg",
  ],
  [
    "tiles",
    "ceramic floor tiles",
    "File:Ceramic floor in Maracaibo Colonial House.jpg",
  ],
  ["roofing", "corrugated iron roof", "File:Bølgjeblekk.JPG"],
  [
    "aggregates",
    "gravel pile aggregate",
    "File:Sand piling up at Brett Aggregate Works - geograph.org.uk - 6548708.jpg",
  ],
  ["paint", "paint cans", "File:Farrow & Ball paint cans.jpg"],
  [
    "electrical",
    "electrical wiring distribution board",
    "File:Alians PL,TypicalswitchgearinelectricnetworksinthehousingstockoflocalcommunesinPoland,02-07-2021.jpg",
  ],
  ["plumbing", "plumbing pipework", "File:2006-02-15 Piping.jpg"],
  [
    "doors-windows",
    "wooden door house entrance",
    "File:Aigues Vives Wooden Entrance 9215.JPG",
  ],
  // Categories are classes, so illustrating "Timber and Boards" with a different
  // plywood photograph than the plywood *product* uses keeps the two surfaces
  // from showing the same picture side by side.
  ["timber", "plywood board", "File:Birke Multiplex.JPG"],
  [
    "waterproofing",
    "waterproofing membrane roof application",
    "File:Aplikasi Waterproofing Dak Beton Sikalastic 590 Grey oleh PT Kharisma Utomo Group.png",
  ],
  // A file called "museum of ceramic tiles and sanitary ware" sounded ideal and
  // resolved to a framed antique advertising sign hanging on the museum wall — a
  // reminder that a promising Commons title proves nothing until someone looks at
  // the picture. A row of installed basins is unambiguous, and it is a different
  // photograph from the one on the wash-basin listing.
  [
    "sanitary",
    "wash basin bathroom",
    "File:Washbasins of the restrooms in Crowne Plaza Vientiane.jpg",
  ],
];

/** Hero candidates. Several, because the landing page gets exactly one and it
 *  has to be a real working site rather than an architectural render. */
const HERO_SLOTS = [
  [
    "site-a",
    "Addis Ababa construction site",
    "File:00-addis-construction-site.JPG",
  ],
  // Sourced, looked at, rejected. `site-b` is a demolition rubble heap and
  // `site-d` is hand-breaking of stone in a quarry: both are real Ethiopian
  // construction work, and neither is something to put across the top of a
  // shopfront. The two that remain show buildings actually going up.
  ["site-b", "construction site Ethiopia building", null],
  [
    "site-c",
    "Addis Ababa construction scaffold",
    "File:Addis Abeba Wood Scaffold (Sam Effron).jpg",
  ],
  ["site-d", "Ethiopian construction workers", null],
];

const GROUPS = [
  { kind: "categories", slots: CATEGORY_SLOTS },
  { kind: "hero", slots: HERO_SLOTS },
];

// ── Commons access ────────────────────────────────────────────────────────────

/**
 * `fetch` plus the two failures Wikimedia actually produces during a run of
 * this size: HTTP 429 when requests come too fast, and a dropped TLS connection
 * (`ECONNRESET`) somewhere in the middle. Both are transient, and both used to
 * abort the whole listing — so both are retried with a widening delay.
 */
async function fetchWithRetry(url, { attempts = 6 } = {}) {
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(3000 * attempt);
    }
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(20000),
      });
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `${attempts} attempts failed for ${url}: ${lastError?.message ?? "unknown"}`,
  );
}

async function callCommons(params) {
  const url = new URL(COMMONS_API);
  for (const [key, value] of Object.entries({
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  })) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetchWithRetry(url);
  if (!response.ok) {
    throw new Error(
      `Commons API ${response.status} for ${params.gsrsearch ?? params.gcmtitle ?? params.titles}`,
    );
  }
  return response.json();
}

/** Wikimedia throttles bursts, so every request is spaced and 429s are retried
 *  rather than turned into a missing photograph. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Strips the HTML Commons wraps around author and licence fields. */
function plainText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Candidate photographs for one query.
 *
 * A query of the form `cat:Rebar` enumerates a Commons category instead of
 * running a full-text search. Categories are far more precise for materials
 * whose names are ordinary words — a search for "sand" returns beaches, while
 * `cat:Construction aggregates` returns aggregate.
 */
async function findCandidates(query) {
  const data = query.startsWith("cat:")
    ? await callCommons({
        action: "query",
        generator: "categorymembers",
        gcmtitle: `Category:${query.slice(4)}`,
        gcmtype: "file",
        gcmlimit: "40",
        prop: "imageinfo",
        iiprop: "url|size|mime|extmetadata",
        iiurlwidth: String(SOURCE_WIDTH),
      })
    : await callCommons({
        action: "query",
        generator: "search",
        gsrsearch: `${query} filetype:bitmap`,
        gsrnamespace: "6",
        gsrlimit: "20",
        prop: "imageinfo",
        iiprop: "url|size|mime|extmetadata",
        iiurlwidth: String(SOURCE_WIDTH),
      });

  const pages = data?.query?.pages ?? [];
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return pages
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (!info) {
        return null;
      }
      const meta = info.extmetadata ?? {};
      return {
        title: page.title,
        pageUrl: info.descriptionurl,
        licence: plainText(meta.LicenseShortName?.value) || "unknown",
        author: plainText(meta.Artist?.value) || "unknown",
        credit: plainText(meta.Credit?.value),
        width: info.width,
        height: info.height,
        mime: info.mime,
        thumbUrl: info.thumburl,
      };
    })
    .filter(
      (candidate) =>
        candidate !== null &&
        /^image\/(jpeg|png)$/.test(candidate.mime) &&
        candidate.width >= 700 &&
        candidate.height >= 450 &&
        ALLOWED_LICENCE.test(candidate.licence) &&
        Boolean(candidate.thumbUrl),
    );
}

// ── Download ──────────────────────────────────────────────────────────────────

const EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function download(url, destination) {
  const response = await fetchWithRetry(url);
  if (!response.ok) {
    throw new Error(`Download ${response.status} for ${url}`);
  }
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

/** Resolves one pinned `File:` title, bypassing search entirely. Used wherever a
 *  search phrase returns something that is only topically related — the pinned
 *  title is the record of a human having looked at the picture. */
async function fetchByTitle(title) {
  const data = await callCommons({
    action: "query",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: String(SOURCE_WIDTH),
  });

  const page = data?.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  if (!info) {
    throw new Error(`pinned title not found: ${title}`);
  }
  const meta = info.extmetadata ?? {};
  return {
    title: page.title,
    pageUrl: info.descriptionurl,
    licence: plainText(meta.LicenseShortName?.value) || "unknown",
    author: plainText(meta.Artist?.value) || "unknown",
    credit: plainText(meta.Credit?.value),
    width: info.width,
    height: info.height,
    mime: info.mime,
    thumbUrl: info.thumburl,
  };
}

// ── Entry point ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const options = { index: 0, only: null, list: null, listAll: false, dryRun: false };
  for (const arg of argv) {
    const [flag, value = ""] = arg.split("=");
    if (flag === "--index") {
      options.index = Number.parseInt(value, 10) || 0;
    } else if (flag === "--only") {
      options.only = new Set(value.split(",").filter(Boolean));
    } else if (flag === "--list") {
      options.list = value;
    } else if (flag === "--list-all") {
      options.listAll = true;
    } else if (flag === "--dry-run") {
      options.dryRun = true;
    }
  }
  return options;
}

async function listMatches(query) {
  const candidates = await findCandidates(query);
  console.log(`\n${candidates.length} usable match(es) for "${query}":`);
  candidates.forEach((candidate, index) => {
    console.log(
      `  [${index}] ${candidate.title.replace(/^File:/, "")}  (${candidate.width}x${candidate.height}, ${candidate.licence})`,
    );
  });
}

/**
 * Prints candidate titles for every slot so a pinned title can be chosen by
 * hand. Titles are not proof — the contact sheet is — but they filter out the
 * obviously unrelated before anything is downloaded.
 *
 * Slots that already carry a pinned title — or an explicit `null` recording that
 * nothing honest exists — are skipped unless `--only` names them: they are
 * decided, and every skipped slot is one fewer request against a rate limit that
 * has already aborted this listing once.
 */
async function listAll(only) {
  for (const { kind, slots } of GROUPS) {
    for (const [slot, query, pinnedTitle] of slots) {
      if (only ? !only.has(slot) : pinnedTitle !== undefined) {
        continue;
      }
      const candidates = await findCandidates(query);
      console.log(`\n${kind}/${slot}  "${query}"`);
      candidates.slice(0, 8).forEach((candidate, index) => {
        console.log(
          `  [${index}] ${candidate.title.replace(/^File:/, "").slice(0, 76)}`,
        );
      });
      await sleep(900);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.list) {
    await listMatches(options.list);
    return;
  }

  if (options.listAll) {
    await listAll(options.only);
    return;
  }

  if (options.dryRun) {
    for (const { kind, slots } of GROUPS) {
      for (const [slot, , pinnedTitle] of slots) {
        if (options.only && !options.only.has(slot)) continue;
        console.log(`${kind}/${slot}: ${pinnedTitle ?? "SOURCING GAP"}`);
      }
    }
    return;
  }

  const credits = [];
  const failures = [];
  const unsourced = [];

  for (const { kind, slots } of GROUPS) {
    await mkdir(join(stageDir, kind), { recursive: true });

    for (const [slot, query, pinnedTitle] of slots) {
      if (options.only && !options.only.has(slot)) {
        continue;
      }
      // Explicitly unsourced: no photograph is downloaded and none is invented.
      if (pinnedTitle === null) {
        await rm(join(frontendDir, "public/images", kind, `${slot}.png`), { force: true });
        for (const extension of Object.values(EXTENSION_BY_MIME)) {
          await rm(join(stageDir, kind, `${slot}.${extension}`), { force: true });
        }
        unsourced.push(`${kind}/${slot} (SOURCING GAP for "${query}")`);
        continue;
      }

      try {
        const chosen = pinnedTitle
          ? await fetchByTitle(pinnedTitle)
          : (await findCandidates(query))[options.index];
        if (!chosen) {
          failures.push(`${kind}/${slot}: no usable candidate for "${query}"`);
          continue;
        }
        if (!ALLOWED_LICENCE.test(chosen.licence)) {
          failures.push(
            `${kind}/${slot}: licence "${chosen.licence}" is not shippable`,
          );
          continue;
        }

        const extension = EXTENSION_BY_MIME[chosen.mime];
        if (!extension) {
          failures.push(`${kind}/${slot}: unsupported type ${chosen.mime}`);
          continue;
        }
        const savedAs = `${kind}/${slot}.png`;
        await download(chosen.thumbUrl, join(stageDir, kind, `${slot}.${extension}`));
        await sleep(350);

        credits.push({
          kind,
          slot,
          query,
          pinned: Boolean(pinnedTitle),
          savedAs,
          source: "Wikimedia Commons",
          title: chosen.title,
          pageUrl: chosen.pageUrl,
          licence: chosen.licence,
          author: chosen.author,
          credit: chosen.credit,
        });
        console.log(
          `  ok  ${kind}/${slot}  <-  ${chosen.title.replace(/^File:/, "")} [${chosen.licence}]`,
        );
      } catch (error) {
        failures.push(`${kind}/${slot}: ${error.message}`);
      }
    }
  }

  // `image-credits.json` is merged rather than rewritten so re-sourcing a single
  // slot cannot silently drop the attribution for the other fifty. Merging alone
  // leaks the other way, though: a slot demoted to `null` after review left its
  // old credit in place, crediting a photograph no longer shipped. So the merge is
  // filtered to the slots this table still intends to ship.
  const creditsPath = join(frontendDir, "public/images/image-credits.json");
  const retired = new Set(
    GROUPS.flatMap(({ kind, slots }) =>
      slots
        .filter(([slot, , pinnedTitle]) =>
          pinnedTitle === null && (!options.only || options.only.has(slot)),
        )
        .map(([slot]) => `${kind}/${slot}.png`),
    ),
  );
  let existing = {};
  try {
    existing = JSON.parse(await readFile(creditsPath, "utf8")).images ?? {};
  } catch {
    // First run: no file yet.
  }
  for (const key of retired) {
    delete existing[key];
  }
  for (const entry of credits) {
    existing[`${entry.kind}/${entry.slot}.png`] = entry;
  }
  for (const [key, entry] of Object.entries(existing)) {
    entry.savedAs = key;
  }
  await writeFile(
    creditsPath,
    `${JSON.stringify(
      {
        note: "Photographs from Wikimedia Commons under the recorded licences. Generic product-type illustrations do not verify brand, dimensions or specifications. The five cement product files share one public-domain source. savedAs identifies the final PNG relative to public/images; conversion resizes and may crop the source. SOURCING GAP slots ship no photograph. CC BY-SA adaptations retain the recorded source licence.",
        images: Object.fromEntries(
          Object.entries(existing)
            .sort(([a], [b]) => a.localeCompare(b)),
        ),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`\nsourced ${credits.length}, failed ${failures.length}`);
  for (const failure of failures) {
    console.log(`  FAIL ${failure}`);
  }
  for (const slot of unsourced) {
    console.log(`  SKIP ${slot}`);
  }
}

export { callCommons, download, fetchByTitle, findCandidates };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
