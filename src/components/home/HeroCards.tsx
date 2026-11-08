import Link from "@/components/Link";
import { money } from "@/lib/format";
import { thumb } from "@/lib/images";
import { REGIONS, type Region } from "@/lib/regions";
import type { Pick as RegionPick } from "@/lib/picks";

/** One featured product in the hero (owner, 2026-11-08: "feature some products on the hero", as KaeYoung and ScentCompare do). */
export interface HeroCard {
  slug: string;
  name: string;
  type: string;
  img: string | null;
  cents: number | null;
  /** Independent stores with it in stock. */
  stores: number;
  /** The median open store price, when two or more stores have it: "Save 18%" is the cheapest against it. */
  median: number | null;
  /** On pre-order: the stat says how many stores take pre-orders, not "in stock". */
  pre?: boolean;
}

/** How far the cheapest store is under the median store price, 0 when it is not (or there is no median). */
export function heroSave(c: Pick<HeroCard, "cents" | "median">): number {
  if (c.cents == null || c.median == null || c.median <= 0 || c.cents >= c.median) return 0;
  return 1 - c.cents / c.median;
}

export const HERO_SLOTS = 2;

/** The two hero cards from a region's picks: the ones with a photo and a price first, in the picks' own order. */
export function heroFromPicks(picks: RegionPick[]): HeroCard[] {
  const good = picks.filter((p) => p.img && p.cents != null);
  return (good.length >= HERO_SLOTS ? good : picks).slice(0, HERO_SLOTS).map((p) => ({
    slug: p.slug,
    name: p.name,
    type: p.type,
    img: p.img,
    cents: p.cents,
    stores: p.stores,
    median: p.median ?? null,
  }));
}

/**
 * The hero's featured products drawn as trading cards (WaxCompare's sports-card look, 2026-11-08: our own design, no maker's trade
 * dress): a white border, the photo on a light panel with the product type on a corner band, a nameplate, and a stat line (the
 * cheapest store price, how many stores have it). Each is a plain link to the product page in the server HTML, with the quick view's
 * data attributes. Nothing here is a heading. Server and client safe (no data reads), so the landing page's region swap reuses it.
 */
export function HeroCards({ cards, region }: { cards: HeroCard[]; region: Region }) {
  const r = REGIONS[region];
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4">
      {cards.map((c, i) => {
        const img = thumb(c.img, 400);
        const save = heroSave(c);
        return (
          <li key={c.slug} className="min-w-0">
            <Link
              href={`/${region}/p/${c.slug}`}
              prefetch={false}
              data-qv={c.slug}
              data-qv-region={region}
              data-qv-name={c.name}
              data-qv-sub={c.type}
              data-qv-img={img ?? undefined}
              className={`wx-tcard group ${i % 2 ? "wx-tcard-b" : ""}`}
            >
              <span className="wx-tcard-art">
                {img ? (
                  <img
                    src={img}
                    alt={c.name}
                    width={240}
                    height={240}
                    decoding="async"
                    fetchPriority={i === 0 ? "high" : undefined}
                    className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.04] sm:p-4"
                  />
                ) : (
                  <span className="text-sm font-semibold text-[#5b6478]">{c.type}</span>
                )}
                <span className="wx-tcard-band">{c.type}</span>
                {save >= 0.08 && <span className="wx-tcard-save">Save {Math.round(save * 100)}%</span>}
              </span>
              <span className="wx-tcard-plate">
                <span className="line-clamp-2">{c.name}</span>
              </span>
              <span className="wx-tcard-stats">
                <span>
                  <span className="wx-tcard-k">From</span>
                  <span className="wx-tcard-v tabular">{money(c.cents, r.market)}</span>
                </span>
                <span className="text-right">
                  <span className="wx-tcard-k">{c.pre ? "Pre-order" : "In stock"}</span>
                  <span className="wx-tcard-v tabular">
                    {c.stores} <span className="text-xs font-semibold">{c.stores === 1 ? "store" : "stores"}</span>
                  </span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
