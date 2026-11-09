// The live numbers in the guides: small, scoped reads of the region's current ProductStat and StoreStat rows, made once per render
// (the page is force-dynamic and kept by the CDN for a day). Every read is one market, selects only what a card shows and is capped:
// a guide reads at most about 60 small rows per render. The reads themselves are src/content/live.ts's, shared with the blog.
import { prisma } from "@/lib/db";
import { OPEN, type ProductCardData } from "@/lib/data";
import type { Market, RegionInfo } from "@/lib/regions";
import { familyIn, lastCheckedIn, topStores, type FamilyKey, type StoreRow } from "../live";
import type { GuideSlug } from "./index";
import type { Wrap } from "./more-data";

export type { StoreRow };

/** One product type's open listings in a market (typeSummary): how many are open, and the cheapest open price. */
export interface TypeSummaryRow {
  productType: string;
  open: number;
  fromCents: number | null;
}

/** What a guide's live blocks render. Each guide fills what it uses; the rest stays empty. */
export interface GuideData {
  /** When the region's stores were last read (ISO): the byline's and every live block's "prices checked". Null before the first import. */
  checked: string | null;
  /** The day the page rendered (YYYY-MM-DD, UTC). */
  today: string;
  /** Per product family (src/content/live.ts FAMILIES), or per a guide's own key: open products, in the order the block shows them. */
  rows: Partial<Record<string, ProductCardData[]>>;
  /** typeSummary: per product type label. */
  types: TypeSummaryRow[];
  /** The region's stores with the most sealed sports cards in stock (at most 12 rows). */
  stores: StoreRow[];
  /** Per product type label: open products, as the guide's EXTRA read orders them (more-data.ts). */
  byType?: Partial<Record<string, ProductCardData[]>>;
  /** Per product type label: how many are open in the region. */
  openByType?: Partial<Record<string, number>>;
  /** Per set code: products listed and open (the release calendar, Universes Beyond). */
  sets?: Record<string, { products: number; open: number }>;
  /** The weekly wrap's real week-over-week moves (from the price-history file), and the cards they name. */
  wrap?: Wrap;
  cards?: ProductCardData[];
}

export const emptyGuideData = (today: string, checked: string | null = null): GuideData => ({ checked, today, rows: {}, types: [], stores: [] });

/** Per product type, the market's open listings: one groupBy over ProductStat, then the product type of each (at most ~30 rows). */
export async function typeSummary(market: Market): Promise<TypeSummaryRow[]> {
  const rows = await prisma.productStat.findMany({
    where: { market, ...OPEN, lowestPriceCents: { gt: 0 } },
    take: 4000,
    select: { lowestPriceCents: true, product: { select: { productType: true } } },
  });
  const acc = new Map<string, TypeSummaryRow>();
  for (const r of rows) {
    const t = r.product.productType;
    const a = acc.get(t) ?? { productType: t, open: 0, fromCents: null };
    a.open++;
    if (r.lowestPriceCents != null && (a.fromCents == null || r.lowestPriceCents < a.fromCents)) a.fromCents = r.lowestPriceCents;
    acc.set(t, a);
  }
  return [...acc.values()].sort((a, b) => b.open - a.open).slice(0, 20);
}

/** Which families a guide reads, and how many of each (cheapest first). */
const READS: Record<GuideSlug, readonly [FamilyKey, number][]> = {
  "hobby-vs-blaster-vs-mega-box": [["hobby-box", 3], ["mega-box", 2], ["blaster-box", 3], ["hanger-box", 2]],
  "where-to-buy-sealed-sports-cards-online": [],
  "how-to-avoid-resealed-sports-card-boxes": [["hobby-box", 3], ["blaster-box", 3]],
  "sports-cards-black-friday-2026": [["hobby-box", 4], ["mega-box", 3], ["blaster-box", 3]],
  "hobby-box-vs-jumbo-box": [["hobby-box", 3], ["jumbo-box", 3]],
  "hobby-case-vs-single-box": [["hobby-case", 3], ["hobby-box", 3]],
};

/** Load what a guide's live blocks show, for one region. */
export async function loadGuideData(slug: GuideSlug, r: RegionInfo, now: Date = new Date()): Promise<GuideData> {
  const today = now.toISOString().slice(0, 10);
  const checked = lastCheckedIn(r.market);
  const reads = READS[slug].map(async ([k, n]) => [k, await familyIn(r.market, k, n)] as const);
  const [lists, stores, types] = await Promise.all([
    Promise.all(reads),
    slug === "where-to-buy-sealed-sports-cards-online" ? topStores(r.market, 12) : Promise.resolve([] as StoreRow[]),
    slug === "where-to-buy-sealed-sports-cards-online" ? typeSummary(r.market) : Promise.resolve([] as TypeSummaryRow[]),
  ]);
  const rows: GuideData["rows"] = Object.fromEntries(lists);
  return { ...emptyGuideData(today, await checked), rows, stores, types };
}
