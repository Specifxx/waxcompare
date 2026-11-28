// The deals card's products (components/DealsPopup.tsx; owner, 2026-11-28: "the sites without TCGplayer … eBay or Amazon
// pop-ups, especially with Black Friday deals … with actual products"). Served per region from /api/deal-picks/<region>, kept
// by the CDN like the Amazon tiles (lib/amazon-rail.ts):
//
//   • Amazon only here: the region's most-listed in-stock sealed products of OUR catalogue (Amazon's exception for pop-ups
//     promoting "Products closely associated with the materials on your Site") whose own Amazon listing this build priced
//     (lib/amazon-live.ts), each with its price's time; the browser drops it after 24 hours (Amazon's licence). A link to that
//     item only (/dp/), never a deals or category page. (eBay's listings here are read per strip from the import's table, too
//     old on an idle week to quote as a deal.)
//   • Nothing is invented: no "was" price, no saving of ours, no countdown.
import { amazonFor, amazonUrl } from "./amazon";
import { AMAZON_CLOCK, amazonLiveFor } from "./amazon-live";
import { marketProducts } from "./data";
import { money } from "./format";
import { REGIONS, type Region } from "./regions";

export const MAX_PICKS = 4;
export const MIN_PICKS = 2;

export interface DealPick {
  id: string;
  brand: "amazon" | "ebay";
  name: string;
  img: string;
  price: string;
  href: string;
  at?: string;
  deal?: string;
  off?: number;
  until?: string;
}

export interface DealPicks {
  region: string;
  picks: DealPick[];
  clock: { timeZone: string; label: string } | null;
}

export async function dealPicksFor(region: Region): Promise<DealPicks> {
  const clock = AMAZON_CLOCK[region] ?? null;
  const empty: DealPicks = { region, picks: [], clock };
  if (!clock || !amazonFor(region)) return empty;
  const rows = (await marketProducts(REGIONS[region].market))
    .filter((p) => p.imageUrl && p.inStockStores > 0)
    .sort((a, b) => b.listedStores - a.listedStores || b.inStockStores - a.inStockStores || a.slug.localeCompare(b.slug));
  const picks: DealPick[] = [];
  for (const p of rows) {
    if (picks.length >= MAX_PICKS) break;
    const a = amazonLiveFor(p.slug, region);
    if (!a?.cents || !a.at) continue;
    picks.push({ id: p.slug, brand: "amazon", name: p.name, img: p.imageUrl!, price: money(a.cents, REGIONS[region].market), href: amazonUrl(p.name, { slug: p.slug, region, placement: "deals-popup-amazon", asin: a.asin }), at: a.at });
  }
  return picks.length >= MIN_PICKS ? { region, picks, clock } : empty;
}
