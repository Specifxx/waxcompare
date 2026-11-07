// What a blog post's live blocks show: capped reads of the current listings in every market (src/content/live.ts), once per
// render (the page is force-dynamic and kept by the CDN for a day). Nothing here is history.
import {
  boxesIn,
  familyIn,
  lastCheckedAnywhere,
  marketCounts,
  namedAcross,
  topStores,
  type MarketCard,
  type MarketCount,
  type StoreRow,
} from "@/content/live";
import { REGION_LIST, type Market } from "@/lib/regions";
import type { PostSlug } from "./index";

export interface PostData {
  today: string;
  checked: string | null;
  /** Booster boxes in stock, per market (cheapest or dearest first, as the post reads them). */
  boxes: MarketCard[];
  /** Products named for the post's release, every market. */
  named: MarketCard[];
  counts: MarketCount[];
  stores: Partial<Record<Market, StoreRow[]>>;
}

export const emptyPostData = (
  today: string,
  checked: string | null = null,
): PostData => ({
  today,
  checked,
  boxes: [],
  named: [],
  counts: [],
  stores: {},
});

const perMarket = async (
  f: (m: Market) => Promise<{ name: string }[]>,
): Promise<MarketCard[]> =>
  (
    await Promise.all(
      REGION_LIST.map(async (r) =>
        (await f(r.market)).map((p) => ({
          ...(p as MarketCard),
          market: r.market,
        })),
      ),
    )
  ).flat();

export async function loadPostData(
  slug: PostSlug,
  now: Date = new Date(),
): Promise<PostData> {
  const today = now.toISOString().slice(0, 10);
  const checked = lastCheckedAnywhere();
  const d = emptyPostData(today);
  switch (slug) {
    case "cheapest-sports-card-boxes":
      d.boxes = await perMarket((m) => boxesIn(m, 8, "asc"));
      break;
    case "most-expensive-sports-card-boxes":
      d.boxes = await perMarket((m) => boxesIn(m, 8, "desc"));
      break;
  }
  return { ...d, checked: await checked };
}
