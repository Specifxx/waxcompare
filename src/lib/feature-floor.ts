// Which products the front pages FEATURE (owner, 2026-11-12: "promote the more expensive items, so we get more commission"). A cheap
// product stays listed, searchable and linkable; it just is not a headline on the landing page, the region home's hero, deals rail or
// TCGplayer banner. Pure, so tests/feature-floor.test.ts checks the rule without a render. It never touches a product's store rows
// (those stay price-ordered) and never reads a commission rate.
import { roughUsdCents } from "./sealed-title";

/**
 * US$150 (DECISIONS.md, 2026-11-12). From the US in-stock prices of 2026-11-12: the median product is $85, the top 40% start at $145,
 * hobby boxes sit at a $240 median and hobby cases at $2,997, while mega boxes ($60), blasters ($30), hangers, packs and tins are
 * all under $100. So $150 keeps hobby and jumbo boxes, FOTL, cases and the better choice boxes, and drops every retail product.
 * Other markets compare through sealed-title.ts's rough exchange table.
 */
export const FEATURE_MIN_USD_CENTS = 15_000;

/** Is this price (in `market`'s own currency) high enough to feature? */
export function featureWorthy(cents: number | null | undefined, market: string): boolean {
  return !!cents && roughUsdCents(cents, market) >= FEATURE_MIN_USD_CENTS;
}

/** The dearest first (compared in rough US dollars), ties keeping their given order. */
export function priciestFirst<T>(items: readonly T[], market: string, price: (t: T) => number | null | undefined): T[] {
  return items
    .map((t, i) => ({ t, i, usd: roughUsdCents(price(t) ?? 0, market) }))
    .sort((a, b) => b.usd - a.usd || a.i - b.i)
    .map((x) => x.t);
}

/** Only the featurable items, dearest first, at most `take`. With `fallback`, a short list is topped up from the rest (dearest first) so a hero is never empty. */
export function featured<T>(items: readonly T[], market: string, price: (t: T) => number | null | undefined, take: number, fallback = false): T[] {
  const ranked = priciestFirst(items, market, price);
  const good = ranked.filter((t) => featureWorthy(price(t), market));
  return (fallback ? [...good, ...ranked.filter((t) => !good.includes(t))] : good).slice(0, take);
}
