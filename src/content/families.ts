// The product families the editorial pages group products by (src/content/live.ts has the reads). Pure: no database, no React, so
// the registries, the share-card routes and the tests import it freely.
//
// Products are grouped by their own name ("… Hobby Box", "… Blaster Box"), not by the product type table, so a page reads the same
// whichever type key the importer files a product under. No family states a pack count: a sports box's pack count differs by
// release and is printed on the box, so no per-pack price is ever guessed. A single pack is one pack.
import type { ProductCardData } from "../lib/data";
import type { Market } from "../lib/regions";
import { REGION_LIST } from "../lib/regions";

export type MarketCard = ProductCardData & { market: Market };

export interface Family {
  key: FamilyKey;
  /** Singular, as a table row names it. */
  label: string;
  plural: string;
  /** What the product name must contain (case-insensitive): the capped read's filter. */
  query: string;
  /** The whole test on the product name. */
  match: RegExp;
  /** Packs in every product of the family, or null when it differs (or is not a pack product). */
  packs: number | null;
}

export type FamilyKey = "hobby-box" | "jumbo-box" | "mega-box" | "blaster-box" | "hanger-box" | "hobby-case" | "pack";

const NOT_CASE = String.raw`(?!.*\bcase\b)`;

export const FAMILIES: readonly Family[] = [
  { key: "hobby-case", label: "Hobby case", plural: "Hobby cases", query: "Case", match: /\bhobby\b.*\bcase\b|\bcase\b.*\bhobby\b/i, packs: null },
  { key: "jumbo-box", label: "Jumbo box", plural: "Jumbo boxes", query: "Jumbo", match: new RegExp(String.raw`\b(?:jumbo|hta)\b.*\bbox\b${NOT_CASE}`, "i"), packs: null },
  { key: "hobby-box", label: "Hobby box", plural: "Hobby boxes", query: "Hobby", match: new RegExp(String.raw`\bhobby\s+box\b${NOT_CASE}`, "i"), packs: null },
  { key: "mega-box", label: "Mega box", plural: "Mega boxes", query: "Mega", match: new RegExp(String.raw`\bmega\s+box\b${NOT_CASE}`, "i"), packs: null },
  { key: "blaster-box", label: "Blaster box", plural: "Blaster boxes", query: "Blaster", match: new RegExp(String.raw`\bblaster\b${NOT_CASE}`, "i"), packs: null },
  { key: "hanger-box", label: "Hanger box", plural: "Hanger boxes", query: "Hanger", match: new RegExp(String.raw`\bhanger\b${NOT_CASE}`, "i"), packs: null },
  { key: "pack", label: "Pack", plural: "Packs", query: "Pack", match: /\bpack\b(?!.*\b(?:box|case|display)\b)/i, packs: 1 },
];

export const FAMILY: Readonly<Record<FamilyKey, Family>> = Object.fromEntries(FAMILIES.map((f) => [f.key, f])) as Record<FamilyKey, Family>;

/** The booster-box families, in the order the pages list them. */
export const BOX_FAMILIES: readonly FamilyKey[] = ["hobby-box", "jumbo-box", "mega-box", "blaster-box", "hanger-box"];

/** The family a product name belongs to (the first that matches, boxes before packs), or null. */
export function familyOf(name: string): Family | null {
  return FAMILIES.find((f) => f.match.test(name)) ?? null;
}

/** Packs in a product: the family's fixed count (a single pack), else null. */
export function packsOf(p: Pick<ProductCardData, "name">, fam: Family | null = familyOf(p.name)): number | null {
  return fam?.packs ?? null;
}

/** Price per pack in the product's own currency (cents), or null where the pack count is not known. */
export function perPackOf(p: Pick<ProductCardData, "name" | "lowestPriceCents">): number | null {
  const packs = packsOf(p);
  return packs && p.lowestPriceCents != null && p.lowestPriceCents > 0 ? Math.round(p.lowestPriceCents / packs) : null;
}

/** Buyable now: a store has it in stock (marketplaceOpen is the engine's field; no marketplace is compared here). */
export const isOpenCard = (p: Pick<ProductCardData, "inStockStores" | "marketplaceOpen">) => p.inStockStores > 0 || p.marketplaceOpen;

/** "12 stores", "1 store" or "—". */
export function whereText(p: Pick<ProductCardData, "inStockStores" | "marketplaceOpen">): string {
  return p.inStockStores > 0 ? `${p.inStockStores} store${p.inStockStores === 1 ? "" : "s"}` : "—";
}

const cheapestFirst = (a: ProductCardData, b: ProductCardData) => (a.lowestPriceCents ?? 0) - (b.lowestPriceCents ?? 0);

/** Per market, the cheapest open product of a family among `cards` (in REGION_LIST order; never sorted by price: currencies differ). */
export function cheapestPerMarket(cards: readonly MarketCard[], key: FamilyKey, keep: (p: MarketCard) => boolean = () => true): { market: Market; p: MarketCard | null }[] {
  return REGION_LIST.map((r) => ({
    market: r.market,
    p: cards.filter((c) => c.market === r.market && familyOf(c.name)?.key === key && isOpenCard(c) && keep(c)).sort(cheapestFirst)[0] ?? null,
  }));
}

