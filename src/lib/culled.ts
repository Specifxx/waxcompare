// Products the popularity cull left out (lib/focus.ts, owner 2026-11-08). The exporter writes data/public/culled.json (product
// slug → its release's slug, the markets where that release still lists something, and its type's slug) so a culled product's old
// URL 301s to its release page in the same region, or its type page where the release lists nothing, instead of a 404. A product
// that qualifies again leaves the file and gets its page back at the same URL.
import fs from "node:fs";
import path from "node:path";
import type { CulledTarget } from "./focus";

let map: Record<string, CulledTarget> | null = null;

/** Where a culled product's URL goes in this region (`market`: the region's market, "US"), or null when the slug was never culled. */
export function culledTarget(slug: string, region: string, market: string, file?: Record<string, CulledTarget>): string | null {
  if (!file && !map) {
    try {
      map = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "public", "culled.json"), "utf8")) as Record<string, CulledTarget>;
    } catch {
      map = {};
    }
  }
  const m = file ?? map!;
  if (!Object.prototype.hasOwnProperty.call(m, slug)) return null;
  const c = m[slug];
  if (c.s && c.m.includes(market)) return `/${region}/sets/${c.s}`;
  return c.t ? `/${region}/type/${c.t}` : `/${region}`;
}
