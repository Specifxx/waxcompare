// Browsing the catalogue the way a collector does: by sport, by brand (the maker), and by both. Pure (no database, no React).
//
//   /<region>/sport/<sport>            every box, case and pack of one sport      (e.g. /us/sport/basketball)
//   /<region>/brand/<brand>            every one of one maker                     (e.g. /us/brand/panini)
//   /<region>/sport/<sport>/<brand>    one maker's boxes in one sport             (e.g. /us/sport/basketball/panini)
//
// Nothing here is a new fact: a product's sport and maker are read from its set code ("2024-25|prizm|basketball"), which
// lib/sealed-title.ts wrote from the store title, through the same line table (lib/lines.ts) the release pages use. A combination
// nothing is listed under has no page and no link; a page with fewer than MIN_HUB_PRODUCTS comparable products is noindex and out of
// the sitemap (lib/facet-data.ts), as a thin set or type page is. Owner, 2026-11-09: the navigation was by product type and set only,
// and a collector looks for their sport and their brand first.
import { cardOpen } from "./compact";
import type { ProductCardData } from "./data";
import { SPORT_BY_KEY, SPORT_BY_SLUG, type Line, type Sport } from "./lines";
import { partsOf } from "./sets";

export type Maker = Line["maker"];

export interface Brand {
  slug: string;
  maker: Maker;
  label: string;
  /** One honest line for the page: who they are, with nothing we cannot show. */
  blurb: string;
}

// Biggest first: the order of the menus and chips.
export const BRANDS: Brand[] = [
  { slug: "topps", maker: "Topps", label: "Topps", blurb: "Topps and Bowman: Chrome, Flagship, Heritage, Stadium Club and the Bowman prospect lines." },
  { slug: "panini", maker: "Panini", label: "Panini", blurb: "Panini: Prizm, Donruss, Select, Mosaic, Optic, Contenders, National Treasures and the sticker albums." },
  { slug: "upper-deck", maker: "Upper Deck", label: "Upper Deck", blurb: "Upper Deck: Series 1 and 2, SP Authentic, Young Guns, O-Pee-Chee and the hockey lines." },
  { slug: "leaf", maker: "Leaf", label: "Leaf", blurb: "Leaf: Metal Universe, Vivid, Trinity, Optichrome and the draft lines." },
  { slug: "select", maker: "Select", label: "Select", blurb: "Select: the Australian maker's AFL and NRL boxes." },
  { slug: "futera", maker: "Futera", label: "Futera", blurb: "Futera: soccer boxes." },
];
export const BRAND_BY_SLUG = new Map(BRANDS.map((b) => [b.slug, b]));
export const BRAND_BY_MAKER = new Map(BRANDS.map((b) => [b.maker, b]));

/** The sports in menu order, with the league a buyer says: "Football (NFL)". `group`: the header menu's column. */
export const SPORT_ORDER: { key: Sport; nav: string; group: "us" | "world" }[] = [
  { key: "football", nav: "Football (NFL)", group: "us" },
  { key: "basketball", nav: "Basketball (NBA)", group: "us" },
  { key: "baseball", nav: "Baseball (MLB)", group: "us" },
  { key: "hockey", nav: "Hockey (NHL)", group: "us" },
  { key: "wnba", nav: "WNBA", group: "us" },
  { key: "soccer", nav: "Soccer", group: "world" },
  { key: "f1", nav: "Formula 1", group: "world" },
  { key: "ufc", nav: "UFC", group: "world" },
  { key: "wrestling", nav: "Wrestling (WWE)", group: "world" },
  { key: "afl", nav: "AFL", group: "world" },
  { key: "nrl", nav: "NRL", group: "world" },
  { key: "cricket", nav: "Cricket", group: "world" },
  { key: "racing", nav: "Racing", group: "world" },
  { key: "golf", nav: "Golf", group: "world" },
  { key: "tennis", nav: "Tennis", group: "world" },
  { key: "multi", nav: "Multi-sport", group: "world" },
];
const NAV_LABEL = new Map(SPORT_ORDER.map((s) => [s.key, s.nav]));
export const sportNavLabel = (s: Sport): string => NAV_LABEL.get(s) ?? SPORT_BY_KEY.get(s)!.label;
export const sportSlug = (s: Sport): string => SPORT_BY_KEY.get(s)!.slug;
export const sportOfSlug = (slug: string): Sport | null => SPORT_BY_SLUG.get(slug)?.key ?? null;

/** The popular pairings, in the order the header menus show them. Only those with something listed are drawn. */
export const POPULAR_COMBOS: [Sport, string][] = [
  ["basketball", "panini"],
  ["football", "panini"],
  ["baseball", "topps"],
  ["basketball", "topps"],
  ["hockey", "upper-deck"],
  ["soccer", "topps"],
  ["football", "topps"],
  ["baseball", "panini"],
];

export const sportHref = (region: string, s: Sport): string => `/${region}/sport/${sportSlug(s)}`;
export const brandHref = (region: string, b: Brand): string => `/${region}/brand/${b.slug}`;
export const comboHref = (region: string, s: Sport, b: Brand): string => `/${region}/sport/${sportSlug(s)}/${b.slug}`;

/** A product's sport, maker and year, read from its set code; null for a product with no release. */
export function facetOf(setCode: string | null | undefined): { sport: Sport; brand: Brand; year: string; lineDisplay: string } | null {
  const parts = setCode ? partsOf(setCode) : null;
  const brand = parts ? BRAND_BY_MAKER.get(parts.line.maker) : null;
  return parts && brand ? { sport: parts.sport, brand, year: parts.year, lineDisplay: parts.line.display } : null;
}

export interface FacetCard {
  card: ProductCardData;
  sport: Sport;
  brand: Brand;
  year: string;
}

/** The products with a release, each tagged. A product whose set code the line table does not know has no facet and is left out. */
export function tagCards(cards: readonly ProductCardData[]): FacetCard[] {
  const out: FacetCard[] = [];
  for (const card of cards) {
    const f = facetOf(card.setCode);
    if (f) out.push({ card, sport: f.sport, brand: f.brand, year: f.year });
  }
  return out;
}

export const isComparableCard = (c: ProductCardData): boolean => cardOpen(c) || c.listedStores >= 2;

export interface FacetFilter {
  sport?: Sport;
  brand?: Brand;
}
export const filterTagged = (tagged: readonly FacetCard[], f: FacetFilter): FacetCard[] =>
  tagged.filter((t) => (!f.sport || t.sport === f.sport) && (!f.brand || t.brand.slug === f.brand.slug));

/** Products per key, e.g. per sport slug. */
export function countBy(tagged: readonly FacetCard[], key: (t: FacetCard) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tagged) m.set(key(t), (m.get(key(t)) ?? 0) + 1);
  return m;
}
export const countBySport = (t: readonly FacetCard[]) => countBy(t, (x) => x.sport);
export const countByBrand = (t: readonly FacetCard[]) => countBy(t, (x) => x.brand.slug);

// ─── What the menus may link (no read: the set codes listed in the market) ────────────────────────────────────────────────

export interface Available {
  sports: Set<Sport>;
  brands: Set<string>;
  combos: Set<string>; // `${sport}/${brandSlug}`
}

/** Sports, brands and pairs with at least one listed release. Without `listed` (a page outside a region, the tests) all are offered. */
export function availableFrom(listed?: ReadonlySet<string> | null): Available {
  const sports = new Set<Sport>();
  const brands = new Set<string>();
  const combos = new Set<string>();
  if (!listed) {
    for (const s of SPORT_ORDER) sports.add(s.key);
    for (const b of BRANDS) brands.add(b.slug);
    for (const [s, b] of POPULAR_COMBOS) combos.add(`${s}/${b}`);
    return { sports, brands, combos };
  }
  for (const code of listed) {
    const f = facetOf(code);
    if (!f) continue;
    sports.add(f.sport);
    brands.add(f.brand.slug);
    combos.add(`${f.sport}/${f.brand.slug}`);
  }
  return { sports, brands, combos };
}

export const sportsAvailable = (a: Available): typeof SPORT_ORDER => SPORT_ORDER.filter((s) => a.sports.has(s.key));
export const brandsAvailable = (a: Available): Brand[] => BRANDS.filter((b) => a.brands.has(b.slug));
/** The sports a brand is listed in, in menu order. */
export const sportsOfBrand = (a: Available, b: Brand): Sport[] => SPORT_ORDER.filter((s) => a.combos.has(`${s.key}/${b.slug}`)).map((s) => s.key);
/** The brands listed in a sport, in brand order. */
export const brandsOfSport = (a: Available, s: Sport): Brand[] => BRANDS.filter((b) => a.combos.has(`${s}/${b.slug}`));
