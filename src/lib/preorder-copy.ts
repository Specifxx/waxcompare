// The pre-order page's words that are built from facts: its <title> and description, the "release date at a glance" box, the US
// per-pack list prices and the FAQ (with its FAQPage JSON-LD). Facts come from lib/preorder-guides.ts (sourced and dated), dates
// from lib/sets.ts, pack counts from lib/packs.ts and US MSRP from lib/rrp.ts (US page only); the only live numbers are the page's
// own cheapest pre-orders, passed in. Pure (no database, no React), so tests/preorders.test.ts reads every sentence.
import { money, plural } from "./format";
import { hubTitle, type HubTitle } from "./hub-copy";
import { packsFor, packsForLabel, perPackCents } from "./packs";
import { guideShowsMsrp, type PreorderGuide } from "./preorder-guides";
import { formatRelease } from "./release";
import { REGION_LIST, type RegionInfo } from "./regions";
import { usMsrpCents } from "./rrp";
import { offerStock, rankOffers, type SealedOffer } from "./sealed-offers";
import { TYPE_BY_LABEL, type TypeKey } from "./sealed-title";
import type { MtgSet as MtgSet } from "./sets";

type R = Pick<RegionInfo, "market" | "inName" | "adjective" | "currency">;

/** "6 November": a date in a sentence that already says the year. */
export function dayMonth(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

/**
 * The <title>: the pre-order prices the page is for, and the release date people search for ("delta reign release date"). Before
 * release only; from release day the page is noindexed and says the set is out.
 */
export function preorderTitle(set: Pick<MtgSet, "name">, r: R, pre: boolean): HubTitle {
  return hubTitle(pre ? `${set.name} pre-orders in ${r.inName}: prices & release date` : `${set.name} released: sealed prices in ${r.inName}`);
}

/** The meta description: the dates first (the answer to the search), then what the page compares. At most 160 characters. */
export function preorderDescription(set: Pick<MtgSet, "name" | "releaseDate">, guide: Pick<PreorderGuide, "prereleaseFrom">, r: R, pre: boolean): string {
  void guide;
  if (!pre) return `${set.name} released on ${formatRelease(set.releaseDate)}. See live ${set.name} hobby box and retail prices across ${r.adjective} stores.`;
  return `${set.name} is out ${formatRelease(set.releaseDate)}. Compare hobby box, jumbo and retail pre-orders at ${r.adjective} stores, in ${r.currency}.`;
}

/** One line of the "at a glance" box: what, the date (ISO, when it is one) or the value, and a note under it. */
export interface GlanceFact {
  key: string;
  label: string;
  iso?: string;
  value?: string;
  note?: string;
}

/** The release date, the prerelease, MTG Arena and (when Wizards has said) the set's size, from the guide and sets.ts: the box under the H1. */
export function glanceFacts(set: Pick<MtgSet, "releaseDate">, guide: PreorderGuide): GlanceFact[] {
  const out: GlanceFact[] = [{ key: "release", label: "Release date", iso: set.releaseDate }];
  if (guide.cardCount) out.push({ key: "cards", label: "Base set", value: guide.cardCount.replace(/^./, (c) => c.toUpperCase()), note: guide.headliners.length ? `Rookies include ${guide.headliners.slice(0, 3).join(", ")}` : undefined });
  return out;
}

/** A product's US list price and what a pack works out to at it (US only). */
export interface MsrpPack {
  type: TypeKey;
  cents: number;
  packs: number;
  perPack: number;
}

/** What each pack costs at US MSRP in the products whose contents (and so pack count) are confirmed. */
// The Play Booster products only: a Collector Booster is a different pack, and a mixed product (Gift Bundle, Draft Night) has no
// honest per-pack price. Wizards publishes no display MSRP, so the box is the single pack's MSRP (rrp.ts has no box entry).
// Sports makers publish no list price, so there is nothing to work out per pack (lib/rrp.ts returns null).
const VALUE_TYPES: readonly TypeKey[] = [];
const VALUE_NAME: Partial<Record<TypeKey, string>> = {};

/**
 * US only: the single Play Booster and the Bundle at MSRP (rrp.ts) and per pack (packs.ts), for the guide's products that print an
 * MSRP. Empty outside the US.
 */
export function msrpPerPack(set: Pick<MtgSet, "code">, guide: PreorderGuide, r: Pick<RegionInfo, "market">): MsrpPack[] {
  if (r.market !== "US") return [];
  const out: MsrpPack[] = [];
  for (const type of VALUE_TYPES) {
    if (!guide.products.some((p) => p.type === type) || !guideShowsMsrp(guide, type)) continue;
    const cents = usMsrpCents(type, set.code);
    const packs = packsFor(type, set.code);
    const perPack = perPackCents(cents, packs);
    if (cents != null && packs != null && perPack != null) out.push({ type, cents, packs, perPack });
  }
  return out;
}

/** "At US MSRP a pack costs $6.99 in a single Play Booster, and $7.78 in the Bundle." Null without two rows. */
export function msrpValueSentence(rows: readonly MsrpPack[]): string | null {
  if (rows.length < 2) return null;
  const groups = new Map<number, string[]>();
  for (const row of [...rows].sort((a, b) => a.perPack - b.perPack)) groups.set(row.perPack, [...(groups.get(row.perPack) ?? []), VALUE_NAME[row.type] ?? row.type]);
  const parts = [...groups].map(([cents, names]) => `${money(cents, "US")} in ${names.join(" and ")}`);
  const extra = "";
  return `At US MSRP a pack costs ${parts.slice(0, -1).join(", ")}${parts.length > 1 ? ", and " : ""}${parts[parts.length - 1]}.${extra}`;
}

/** The page's own cheapest open pre-order of a product type, in the region's currency (cents), from the price lists it renders. */
export type CheapestByType = Partial<Record<TypeKey, number>>;

export interface Faq {
  q: string;
  a: string;
}

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

/** The FAQ, in the order the page shows it; the same list goes out as FAQPage JSON-LD. */
export function preorderFaqs(set: Pick<MtgSet, "code" | "name" | "releaseDate">, guide: PreorderGuide, r: R, cheapest: CheapestByType, pre: boolean): Faq[] {
  void guide;
  const live = (type: TypeKey, what: string) => {
    const c = cheapest[type];
    if (!pre) return "";
    return c != null
      ? ` The cheapest ${set.name} ${what} pre-order on this page is ${money(c, r.market)} right now.`
      : ` No ${r.adjective} store we track has the ${what} open for pre-order right now.`;
  };
  return [
    {
      q: `When does ${set.name} release?`,
      a: `${set.name} ${pre ? "releases" : "released"} on ${formatRelease(set.releaseDate)}, the maker's announced date.${pre ? " Sports card release dates often move, and stores may ship pre-orders a few days either side of it." : ""}`,
    },
    {
      q: `How much does a ${set.name} hobby box cost to pre-order?`,
      a: `Each store sets its own pre-order price, and they differ more before release than at any other time: nothing has shipped and every store is picking an opening number from its allocation. This page lists every ${r.adjective} store we track that is taking ${set.name} pre-orders, cheapest first, in ${r.currency}.${live("hobby-box", "hobby box")}`,
    },
    {
      q: "Is it cheaper to pre-order or to wait until release?",
      a: "It depends on the release. Hobby boxes of a release with a strong rookie class often climb on release day and fall back over the following weeks as breakers open cases and the chase cards are known; retail boxes (blasters, megas) mostly sell at the store's own price until they sell out. A pre-order locks in today's price but ties up your money and depends on the store's allocation.",
    },
    {
      q: "Are pre-order prices final?",
      a: "No. A pre-order price is what the store asks today, and stores change them before release, up or down, as their allocation firms up; a store can also cut an allocation. We read the stores about twice a day, and nothing here is a promise from the store or from us. Confirm the price and the store's pre-order terms at checkout.",
    },
    {
      q: "Do these prices include shipping?",
      a: "No. They are each store's listed item price in its own currency. A sealed box ships as a parcel, so check the store's checkout for postage before comparing two close prices.",
    },
  ];
}

// ─── The stores, ranked, and the summary strip (2026-10-16, the owner: "make sure the eBay links stay at the very top, alongside the
// TCG ones, and everything else is priced in order") ───────────────────────────────────────────────────────────────────────────

/** What the page needs of one offer (an OfferView). */
export type PreorderOffer = SealedOffer & { store: string; storeName: string; marketplace: boolean };

/** What the page needs of one product's price list (a SetOfferGroup). */
export interface PreorderGroup<O extends PreorderOffer = PreorderOffer> {
  product: { name: string; productType: string; setCode: string | null };
  offers: O[];
}

/**
 * A product's STORES, ranked: open pre-orders first, cheapest first, then sold out and not checked. TCGplayer is never among them: a
 * marketplace sits in the pinned marketplace rows above the stores, unnumbered and unranked.
 */
export function storeOffers<O extends PreorderOffer>(offers: readonly O[], now: number = Date.now()): O[] {
  return rankOffers(
    offers.filter((o) => !o.marketplace),
    now,
  );
}

/** The cheapest open STORE offer of a product, or null. */
export function cheapestStoreOffer<O extends PreorderOffer>(offers: readonly O[], now: number = Date.now()): O | null {
  const first = storeOffers(offers, now)[0];
  return first && offerStock(first, now) === "open" ? first : null;
}

/** Per product type, the cheapest open store pre-order on the page (cents): what the FAQ's live answers quote. */
export function cheapestStoreByType(groups: readonly PreorderGroup[], now: number = Date.now()): CheapestByType {
  const out: CheapestByType = {};
  for (const g of groups) {
    const t = TYPE_BY_LABEL.get(g.product.productType)?.key;
    const o = cheapestStoreOffer(g.offers, now);
    if (t && o && (out[t] == null || o.priceCents < out[t]!)) out[t] = o.priceCents;
  }
  return out;
}

/** The strip under the H1: the comparison in four numbers, every one from the page's own data or the store registry. */
export interface PreorderSummary {
  /** Stores WaxCompare checks in the market (the registry: storesInMarket). */
  storesChecked: number;
  /** Distinct stores with an open pre-order of the set in the market (never a marketplace). */
  taking: number;
  /** The cheapest open Hobby Box pre-order at a store, who has it, and per pack (packs.ts). */
  cheapestBox: { cents: number; store: string; perPack: number | null } | null;
  /** Whole days to the release date (0 on the day, negative after). */
  days: number;
}

export function preorderSummary(groups: readonly PreorderGroup[], storesChecked: number, set: Pick<MtgSet, "releaseDate">, today: string, now: number = Date.now()): PreorderSummary {
  const taking = new Set<string>();
  let cheapestBox: PreorderSummary["cheapestBox"] = null;
  for (const g of groups) {
    for (const o of storeOffers(g.offers, now)) if (offerStock(o, now) === "open") taking.add(o.store);
    if (g.product.productType !== "Hobby Box") continue;
    const o = cheapestStoreOffer(g.offers, now);
    if (o && (!cheapestBox || o.priceCents < cheapestBox.cents)) {
      cheapestBox = { cents: o.priceCents, store: o.storeName, perPack: perPackCents(o.priceCents, packsForLabel(g.product.productType, g.product.setCode, g.product.name)) };
    }
  }
  const days = Math.round((Date.parse(`${set.releaseDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400_000);
  return { storesChecked, taking: taking.size, cheapestBox, days };
}

/** The line under the strip: how far the set reaches across every market (setStoreReach), or null without data. */
export function reachLine(set: Pick<MtgSet, "name">, reach: { stores: number; markets: number } | null): string | null {
  if (!reach || !reach.stores) return null;
  const all = reach.markets === REGION_LIST.length;
  const seven = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][REGION_LIST.length] ?? String(REGION_LIST.length);
  return `Across ${all ? "all" : "the"} ${seven} markets we compare, ${plural(reach.stores, "store")} ${reach.stores === 1 ? "lists" : "list"} ${set.name}${all ? "" : `, in ${reach.markets} of them`}.`;
}
