// RELEASES FIND THEMSELVES (2026-11-07). After each sealed import, scripts/discover-sets.ts counts, for every release code the
// sealed classifier (lib/sealed-title.ts) gave a product, how many DIFFERENT stores list a product of it, and adds every release
// that 2 or more stores sell to data/sets/releases.json. lib/sets.ts reads that file into SETS, so the release page, the
// releases index, the calendar (dated releases only) and the sitemap follow on the next release.
//
// Facts only, and refuse rather than guess:
// - A release's name and slug come from its parts alone (year, line, sport, competition: lib/sets.ts releaseName). The slug is the
//   one first written and never changes, because it is a live URL; a stored row is never rewritten or removed.
// - One store is not enough: a single store's odd title (a typo'd year, a mislabelled sport) never makes a page.
// - `firstSeen` is the day an import first saw the release at 2+ stores. It sorts; it is never shown as a release date
//   (data/sets/release-dates.json holds the announced dates, each with its source).
//
// Pure: no network, no file access (the script does both), so tests/set-discovery.test.ts checks every rule directly.
import { partsOf, releaseName, type StoredRelease } from "./sets";

/** At least this many different stores must list a release's products before it gets a page. */
export const MIN_STORES = 2;

export function slugFor(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface DiscoveryResult {
  releases: StoredRelease[];
  added: StoredRelease[];
  /** Codes with products at only one store (reported, not added). */
  waiting: string[];
  /** Codes lib/sets.ts cannot read (an unknown line or sport): never added. */
  unknown: string[];
}

/**
 * Merge today's store counts into the stored list. `storesByCode`: release code -> the distinct store keys listing one of its
 * products. Stored rows are kept as they are; a new code with MIN_STORES or more stores is added with today's date. A new slug
 * that another release already uses gets the code's last part appended, so two releases never share a URL.
 */
export function mergeReleases(stored: readonly StoredRelease[], storesByCode: ReadonlyMap<string, ReadonlySet<string>>, today: string): DiscoveryResult {
  const byCode = new Map(stored.map((r) => [r.code, r]));
  const slugs = new Set(stored.map((r) => r.slug));
  const added: StoredRelease[] = [];
  const waiting: string[] = [];
  const unknown: string[] = [];
  for (const [code, stores] of [...storesByCode].sort(([a], [b]) => a.localeCompare(b))) {
    if (byCode.has(code)) continue;
    const parts = partsOf(code);
    if (!parts) {
      unknown.push(code);
      continue;
    }
    if (stores.size < MIN_STORES) {
      waiting.push(code);
      continue;
    }
    const name = releaseName(parts);
    let slug = slugFor(name);
    if (slugs.has(slug)) slug = slugFor(`${name} ${code.split("|").slice(1).join(" ")}`);
    if (slugs.has(slug)) {
      unknown.push(code);
      continue;
    }
    slugs.add(slug);
    const row = { code, name, slug, firstSeen: today };
    added.push(row);
    byCode.set(code, row);
  }
  const releases = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  return { releases, added, waiting, unknown };
}
