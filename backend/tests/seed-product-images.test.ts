/**
 * Guards the rule that sellers own product photography and CMM supplies none.
 *
 * The seed is where the old CMM-owned images entered the database: it wrote
 * `/images/products/<name>.png` into `Product.imageUrl` and created a matching
 * `OFFICIAL` `ProductImage` row for all 38 catalog entries. Those asset files are
 * deleted, so anything that puts the pattern back would seed rows pointing at
 * nothing and quietly restore the behaviour this cleanup removed.
 *
 * This reads the seed as text rather than running it, because the failure worth
 * catching is a literal creeping back into the file during a merge or a
 * copy-paste — and asserting on it needs no database.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const seedPath = fileURLToPath(new URL("../prisma/seed.ts", import.meta.url));

describe("catalog seed product images", () => {
  let seed: string;

  beforeAll(async () => {
    seed = await readFile(seedPath, "utf8");
  });

  it("assigns no local catalog image path to any seeded product", () => {
    // The purge helper names the prefix deliberately, so match the assignment
    // shape rather than the bare string.
    const assignments = seed.match(/imageUrl:\s*["'`]\/images\/products\//g);
    expect(assignments).toBeNull();
  });

  it("creates no ProductImage rows", () => {
    expect(seed).not.toMatch(/productImage\.(create|createMany|upsert)\b/);
    expect(seed).not.toMatch(/\bseedPrimaryImage\b/);
    expect(seed).not.toMatch(/\bProductImageType\b/);
  });

  it("clears legacy catalog image data instead of leaving it behind", () => {
    // Databases seeded before the change still hold the retired rows. Re-seeding
    // has to remove them, or the marketplace renders a column of dead images.
    expect(seed).toMatch(/productImage\.deleteMany/);
    expect(seed).toMatch(/purgeLegacyCatalogImages/);
  });

  it("keeps seeding the catalog itself", () => {
    // The cleanup removed imagery, not the marketplace. If these disappear the
    // deletion went too far.
    expect(seed).toMatch(/prisma\.product\.create/);
    expect(seed).toMatch(/sellerInventory\.upsert/);
    expect(seed).toMatch(/upsertCategory/);
    expect(seed).toMatch(/upsertBrand/);
  });
});
