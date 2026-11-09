// The Amazon side rail's tiles (components/SideAds.tsx AmazonRail; owner, 2026-11-09: "the eBay ad banner and Amazon ad banner on the
// left and right side of the site"). Served as one CDN-cached JSON per region (/api/rails/amazon/<region>) that the rail asks for in the
// browser, so a page carries none of it.
//
//   • The region's most-listed in-stock sealed products, each a tagged link to Amazon's own page of that product when the daily
//     import found its ASIN (data/amazon/), else an exact product-name search (Associates: a specific product, never a category).
//   • NO price: Amazon's licence lets a price be kept only 24 hours and shown with its time, and this rail sits in a CDN copy for
//     longer. The photo is the store's own, as on every tile. Never in the phone dock (an overlay), never counted as a store.
import { amazonFor, amazonUrl } from "./amazon";
import { amazonLiveFor } from "./amazon-live";
import { marketProducts } from "./data";
import { REGIONS, type Region } from "./regions";

/** Up to ten tiles, popular first; the list scrolls inside the rail (the eBay rail's rule). */
export const AMAZON_RAIL_TILES = 10;
/** A rail with fewer tiles than this is not drawn. */
export const AMAZON_RAIL_MIN = 2;

export interface AmazonRailTile {
  id: string;
  name: string;
  img: string;
  href: string;
}
export interface AmazonRail {
  region: Region;
  /** "amazon.com" */
  label: string;
  tiles: AmazonRailTile[];
}

export async function amazonRail(region: Region): Promise<AmazonRail | null> {
  const store = amazonFor(region);
  if (!store) return null;
  const rows = (await marketProducts(REGIONS[region].market))
    .filter((p) => p.imageUrl && p.inStockStores > 0)
    .sort((a, b) => b.listedStores - a.listedStores || b.inStockStores - a.inStockStores || a.slug.localeCompare(b.slug));
  const withAsin = rows.map((p) => ({ p, asin: amazonLiveFor(p.slug, region)?.asin ?? null }));
  // Products Amazon's own page was found for first (a /dp/ link lands on the exact item), then the rest by name.
  const ordered = [...withAsin.filter((x) => x.asin), ...withAsin.filter((x) => !x.asin)];
  const tiles = ordered.slice(0, AMAZON_RAIL_TILES).map(({ p, asin }) => ({
    id: p.slug,
    name: p.name,
    img: p.imageUrl!,
    href: amazonUrl(p.name, { slug: p.slug, region, placement: "amazon-side", asin }),
  }));
  if (tiles.length < AMAZON_RAIL_MIN) return null;
  return { region, label: store.host.replace(/^www\./, ""), tiles };
}
