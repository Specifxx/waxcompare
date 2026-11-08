/**
 * What SportsCardCompare lists: the more popular products only (owner, 2026-11-08: "cull it a bit so it only features the more popular
 * products"; MTG Compare's low-traction cull, mtgcompare #96, is the pattern). DECISIONS.md, 2026-11-08.
 *
 * PURE, so the exporter (scripts/export-public-data.ts), which decides what reaches data/public/, and tests/focus.test.ts read the
 * same rule. Price history keeps every series, and the next import reads every store again, so a product that qualifies again
 * comes back by itself at the same URL, with its chart.
 *
 * A product is listed when any of these holds:
 *   - Search Console shows people finding its page (a click, or DEMAND_MIN_IMPRESSIONS in 56 days, any region);
 *   - two or more stores have it in stock in one market (it is a comparison);
 *   - it is a CORE box (hobby, jumbo, FOTL, Breaker's Delight, choice, mega, blaster, value box, hobby case) of a CURRENT release
 *     (this year's or next, or a season that ends this year or later; makers publish no dates, so the year is what we have) that
 *     at least one store has in stock.
 * Everything else is culled: an older release's single-store box, loose packs, tins, albums, display boxes nobody else sells. Its
 * URL 301s to its release's page in a region where the release still has a listed product, else to its type page (culled.json).
 */
import { SET_BY_CODE } from "./sets";
import { TYPE_BY_LABEL } from "./sealed-title";

export const DEMAND_MIN_IMPRESSIONS = 10;
export const CORE_TYPES = new Set(["Hobby Box", "Jumbo Box", "FOTL Hobby Box", "Breaker's Delight Box", "Choice Box", "Mega Box", "Blaster Box", "Value Box", "Hobby Case"]);
/** A release is current when its (last) year is no older than the year this many days ago. */
export const CURRENT_DAYS = 300;

export interface FocusProduct {
  id: string;
  slug: string;
  productType: string;
  setCode: string | null;
}
export interface FocusOffer {
  productId: string;
  store: string;
  market: string;
  inStock: boolean;
}
/** Where a culled product's URL goes: its release's slug and the markets where that release still lists something, and its type's slug. */
export interface CulledTarget {
  s: string;
  m: string[];
  t: string;
}

/** Product slugs with real search demand, from the `demand` branch's gsc-pages.json (paths like /au/p/<slug>). */
export function demandSlugs(pages: Record<string, number[]>): Set<string> {
  const out = new Set<string>();
  for (const [path, [clicks = 0, impressions = 0]] of Object.entries(pages)) {
    const m = /^\/[a-z]{2}\/p\/([^/]+)$/.exec(path);
    if (m && (clicks > 0 || impressions >= DEMAND_MIN_IMPRESSIONS)) out.add(decodeURIComponent(m[1]));
  }
  return out;
}

/** Is a release code ("2025|chrome|baseball", "2025-26|prizm|basketball") a current release? */
export function currentRelease(code: string | null, now = new Date()): boolean {
  const m = code ? /^(20\d\d)(?:-(\d\d))?\|/.exec(code) : null;
  if (!m) return false;
  const last = m[2] ? Number(m[1]) + 1 : Number(m[1]); // a season "2025-26" runs into 2026
  const cutoff = new Date(now.getTime() - CURRENT_DAYS * 86_400_000).getUTCFullYear();
  return last >= cutoff;
}

/** The ids of the products to list, and every culled product's slug → where its URL goes. */
export function focusCatalog(products: readonly FocusProduct[], offers: readonly FocusOffer[], demand: ReadonlySet<string>, now = new Date()) {
  const inStock = new Map<string, Map<string, Set<string>>>();
  for (const o of offers) {
    if (!o.inStock) continue;
    let m = inStock.get(o.productId);
    if (!m) inStock.set(o.productId, (m = new Map()));
    let s = m.get(o.market);
    if (!s) m.set(o.market, (s = new Set()));
    s.add(o.store);
  }
  const keep = new Set<string>();
  for (const p of products) {
    const markets = [...(inStock.get(p.id)?.values() ?? [])];
    const most = Math.max(0, ...markets.map((s) => s.size));
    const ok = demand.has(p.slug) || most >= 2 || (CORE_TYPES.has(p.productType) && most >= 1 && currentRelease(p.setCode, now));
    if (ok) keep.add(p.id);
  }
  // The markets where each release still lists a product (any offer of a kept product), for the culled pages' redirects.
  const kept = new Map(products.filter((p) => keep.has(p.id)).map((p) => [p.id, p.setCode]));
  const releaseMarkets = new Map<string, Set<string>>();
  for (const o of offers) {
    const code = kept.get(o.productId);
    if (!code) continue;
    let s = releaseMarkets.get(code);
    if (!s) releaseMarkets.set(code, (s = new Set()));
    s.add(o.market);
  }
  const culled: Record<string, CulledTarget> = {};
  for (const p of products) {
    if (keep.has(p.id)) continue;
    const release = p.setCode ? SET_BY_CODE.get(p.setCode) : undefined;
    culled[p.slug] = {
      s: release?.slug ?? "",
      m: release && p.setCode ? [...(releaseMarkets.get(p.setCode) ?? [])].sort() : [],
      t: TYPE_BY_LABEL.get(p.productType)?.slug ?? "",
    };
  }
  return { keep, culled };
}
