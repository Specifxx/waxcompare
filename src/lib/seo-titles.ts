// The <title>s and meta descriptions of the price pages, as search results show them. Every page's generateMetadata builds its
// words here, so one rule holds site-wide (tests/seo-titles.test.ts):
//   • A rendered title (with the layout's " | WaxCompare" when it fits) is at most 60 characters; a description at most 160.
//   • A title leads with the query people type ("Hobby box prices in the US", "2025 Topps Chrome Baseball Hobby Box price",
//     "Where to buy sports cards in Canada"), then the live extras (the from-price) while they fit.
//   • It is written as candidates, most specific first: the first that fits goes out (fitFirst). Long names and long region names
//     lose the extras, never the words people search.
//   • Every number is the caller's, from the data the page loaded: nothing here invents a price, a count or a date.
// Pure: no database and no React.
import { money, plural } from "./format";
import type { RegionInfo } from "./regions";
import { withMtg } from "./seo";
import { SITE_NAME } from "./site";

export const SEO_TITLE_SUFFIX = ` | ${SITE_NAME}`;
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;

export type SeoTitle = string | { absolute: string };

/** The template's suffix when the whole fits in 60, else the words alone as title.absolute. */
export function seoTitle(text: string): SeoTitle {
  return text.length + SEO_TITLE_SUFFIX.length <= SEO_TITLE_MAX ? text : { absolute: text };
}

/** What a results page shows for a title. */
export function shownTitle(t: SeoTitle): string {
  return typeof t === "string" ? `${t}${SEO_TITLE_SUFFIX}` : t.absolute;
}

/** The words of a title, without the suffix (og:title, twitter:title). */
export function seoTitleText(t: SeoTitle): string {
  return typeof t === "string" ? t : t.absolute;
}

/** The first candidate that fits in 60 characters (the last one when none does), with the suffix when that still fits. */
export function fitFirst(...candidates: string[]): SeoTitle {
  return seoTitle(candidates.find((c) => c.length <= SEO_TITLE_MAX) ?? candidates[candidates.length - 1]);
}

/** The first description that fits in 160 characters, else the last candidate cut at a word. */
export function fitDescription(...candidates: string[]): string {
  const fit = candidates.find((c) => c.length <= SEO_DESCRIPTION_MAX);
  if (fit) return fit;
  const last = candidates[candidates.length - 1];
  const cut = last.slice(0, SEO_DESCRIPTION_MAX - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,:;–—-]+$/, "")}…`;
}

/**
 * A product name short enough for a title: store noise taken out ("English", a trailing "Edition", "Factory Sealed", "Sports
 * Trading Cards"), then cut at a word to `max` characters. It only ever removes words.
 */
export function shortName(name: string, max: number): string {
  if (name.length <= max) return name;
  let n = name
    .replace(/\s*\b(?:English|EN)\b/g, "")
    .replace(/\s*\b(?:factory\s+)?sealed\b/gi, "")
    .replace(/\s*\b(?:sports\s+)?trading\s+cards?\b/gi, "")
    .replace(/\s+Edition\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (n.length <= max) return n;
  const cut = n.slice(0, max + 1);
  const at = cut.lastIndexOf(" ");
  n = (at > 20 ? cut.slice(0, at) : cut.slice(0, max)).replace(/[\s,:;–—&-]+$/, "");
  return n;
}

/** The engine shortened a name by its set's code; a sports release's code ("2025|chrome|baseball") is no word, so never. */
export function withSetCode(name: string, setCode?: string | null): string | null {
  void name;
  void setCode;
  return null;
}

/**
 * shortName, but a name that ends in its product type keeps the type and is cut in the part before it: "2024-25 Panini Prizm
 * Basketball Choice Box" → "2024-25 Panini Prizm… Choice Box", never "…Basketball Ch".
 */
export function keepTypeName(name: string, max: number, productType?: string): string {
  const n = shortName(name, max);
  if (!productType || !name.toLowerCase().endsWith(productType.toLowerCase()) || n.toLowerCase().endsWith(productType.toLowerCase())) return n;
  const head = name.slice(0, name.length - productType.length).replace(/[\s,:;–—-]+$/, "");
  const room = max - productType.length - 2; // "… "
  if (room < 8) return n;
  const cut = head.slice(0, room + 1);
  const at = cut.lastIndexOf(" ");
  const kept = (at > 8 ? cut.slice(0, at) : cut.slice(0, room)).replace(/[\s,:;–—&-]+$/, "");
  return `${kept}… ${productType}`;
}

type R = Pick<RegionInfo, "inName" | "adjective" | "market" | "currency">;
const fromText = (cents: number | null, market: string) => (cents != null ? money(cents, market) : null);

// ─── Region pages ──────────────────────────────────────────────────────────────

export const seoCopy = {
  /** /<region>: "Sports card box prices in Canada: 40 card shops". */
  homeTitle: (r: R, stores: number) =>
    fitFirst(
      `Hobby box & blaster prices in ${r.inName}: ${stores} card shops`,
      `Sports card box prices in ${r.inName}: ${stores} shops`,
      `Sports card box prices in ${r.inName}`,
    ),
  homeDescription: (r: R, stores: number, inStock: number) =>
    fitDescription(
      `Compare sealed sports card hobby, jumbo, mega and blaster boxes across ${plural(stores, `${r.adjective} card shop`)}: ${inStock.toLocaleString("en")} in stock today, in ${r.currency}.`,
      `Compare sealed hobby and blaster boxes across ${plural(stores, `${r.adjective} card shop`)}: ${inStock.toLocaleString("en")} in stock today.`,
    ),

  dealsTitle: (r: R) => fitFirst(`Hobby box & blaster deals in ${r.inName}`, `Sports card deals in ${r.inName}`),
  dealsDescription: (r: R, deals: number, bestPct: number | null) =>
    deals > 0
      ? fitDescription(
          `${plural(deals, "sealed sports card product")} priced at least 10% under the median of 3+ ${r.adjective} card shops today${bestPct ? `, up to ${bestPct}% under` : ""}. Hobby, mega and blaster boxes, in ${r.currency}.`,
          `${plural(deals, "sealed sports card product")} priced at least 10% under the median of 3+ ${r.adjective} card shops today${bestPct ? `, up to ${bestPct}% under` : ""}.`,
          `${plural(deals, "sealed sports card product")} priced at least 10% under the median of 3+ ${r.adjective} card shops today.`,
        )
      : fitDescription(`Sealed sports card boxes priced 10% or more under the median of 3+ ${r.adjective} card shops today, when there are any.`),

  packsTitle: (r: R) => fitFirst(`Sports card boxes in ${r.inName}`),
  packsDescription: (r: R, best: { name: string; perPack: number } | null) => {
    void best;
    return `Sealed sports card boxes in ${r.inName}, cheapest first.`;
  },

  digestTitle: (r: R) => fitFirst(`This week in sealed sports cards: ${r.inName}`, `This week in sports cards: ${r.inName}`),

  // The stock pages (lib/stock.ts). Counts are the caller's, from the page's own data.
  backTitle: (r: R) => fitFirst(`Hobby boxes back in stock in ${r.inName}`, `Back in stock: ${r.inName}`),
  backDescription: (r: R, n: number) =>
    fitDescription(
      n > 0
        ? `${plural(n, "sealed sports card product")} that ${r.adjective} card shops had none of in one daily check and have in stock again in the next: hobby, mega and blaster boxes.`
        : `Sealed sports cards that ${r.adjective} card shops had none of in one daily check and have in stock again in the next, from WaxCompare's daily snapshots.`,
    ),
  movesTitle: (r: R) => fitFirst(`Hobby box price moves this week in ${r.inName}`, `Price moves this week: ${r.inName}`),
  movesDescription: (r: R) =>
    fitDescription(
      `The week's biggest changes in the cheapest in-stock price of popular releases' hobby, mega and blaster boxes across ${r.adjective} card shops, up and down, in ${r.currency}.`,
      `The week's biggest changes in the cheapest in-stock price of popular sealed sports card boxes in ${r.inName}.`,
    ),
  oopTitle: (r: R) => fitFirst(`Older sports card releases in stock in ${r.inName}`, `Older releases in stock: ${r.inName}`),
  oopDescription: (r: R, sets: number, stores: number) =>
    fitDescription(
      `Hobby, mega and blaster boxes from ${plural(sets, "older release")} that ${r.adjective} card shops still have in stock today, by how many shops carry them.`,
      `Older releases' sealed boxes ${r.adjective} card shops still stock today (${plural(stores, "store listing")}).`,
    ),

  guidesTitle: (r: R) => fitFirst(`Sports card box buying guides: ${r.inName}`, `Sports card box buying guides`),
  guidesDescription: (r: R) =>
    fitDescription(
      `Guides to hobby, jumbo, mega and blaster boxes in ${r.inName}: what each is, where to buy, and how to avoid resealed boxes, with today's prices.`,
      `Guides to sealed sports card boxes in ${r.inName}, with today's prices.`,
    ),

  storesTitle: (r: R, n: number) => fitFirst(`Where to buy sealed sports cards in ${r.inName}: ${n} shops`, `Where to buy sports cards in ${r.inName}: ${n} shops`, `Where to buy sports cards in ${r.inName}`),
  storesDescription: (r: R, n: number) =>
    fitDescription(
      `${n} ${r.adjective} card shops that sell sealed sports cards online, compared: who has the most in stock today, when we last read each, prices in ${r.currency}.`,
      `${n} ${r.adjective} card shops that sell sealed sports cards online, compared: who has the most in stock today.`,
    ),

  setsIndexTitle: (r: R) => fitFirst(`Every sports card release: sealed prices in ${r.inName}`, `Every sports card release: sealed prices`),
  releasesTitle: (r: R, year: number) => fitFirst(`Sports card release calendar ${year}: ${r.inName}`, `Sports card release calendar ${year}`),

  // ─── Hubs ──────────────────────────────────────────────────────────────────

  /** /<region>/type/<type>: "Hobby Box prices in the US: from $98.95". */
  typeTitle: (t: { label: string }, r: R, open: number, fromCents: number | null) => {
    const base = `${withMtg(t.label)} prices in ${r.inName}`;
    const from = open > 0 ? fromText(fromCents, r.market) : null;
    return fitFirst(...(from ? [`${base}: from ${from}`] : []), base, `${t.label} prices in ${r.inName}`);
  },
  typeDescription: (t: { plural: string }, r: R, c: { open: number; total: number }, fromCents: number | null) => {
    const name = `Sealed sports card ${t.plural.toLowerCase()}`;
    const where = `${r.adjective} card shops`;
    const now = c.open > 0 && fromCents != null ? `${c.open} in stock today from ${money(fromCents, r.market)}, cheapest first` : "none in stock today";
    return fitDescription(
      `${name} compared across ${where}: ${now}, with ${plural(c.total, "product")} listed in ${r.inName}. Prices in ${r.currency}.`,
      `${name} compared across ${where}: ${now}, with ${plural(c.total, "product")} listed in ${r.inName}.`,
      `${name} across ${where}: ${now}, ${plural(c.total, "product")} listed in ${r.inName}.`,
    );
  },

  /**
   * /<region>/sets/<set>. Upcoming: the pre-order wording and the date. Sold without a hobby box: never "hobby box". Otherwise
   * "2025 Topps Chrome Baseball hobby box prices in the US", shortening as the release's name and the region's grow.
   */
  setTitle: (set: { name: string; releaseDate: string }, r: R, o: { preorder: boolean; withoutBox: boolean; date: string }) => {
    const name = withMtg(set.name);
    if (o.preorder) {
      return fitFirst(
        ...(o.withoutBox ? [] : [`${name} hobby box pre-orders in ${r.inName}: out ${o.date}`]),
        `${name} pre-orders in ${r.inName}: out ${o.date}`,
        `${name} pre-orders in ${r.inName}`,
        `${set.name} pre-orders in ${r.inName}`,
        `${set.name} pre-orders`,
      );
    }
    if (o.withoutBox) return fitFirst(`${name} sealed prices in ${r.inName}`, `${set.name} sealed prices in ${r.inName}`, `${set.name} prices in ${r.inName}`, `${set.name} sealed prices`, `${set.name} prices`);
    return fitFirst(
      `${name} hobby box & sealed prices in ${r.inName}`,
      `${name} hobby box prices in ${r.inName}`,
      `${name} sealed prices in ${r.inName}`,
      `${set.name} sealed prices in ${r.inName}`,
      `${set.name} prices in ${r.inName}`,
      `${set.name} sealed prices`,
    );
  },

  // ─── Products ──────────────────────────────────────────────────────────────

  /** /<region>/p/<slug>: "2025 Topps Chrome Baseball Hobby Box price in the US: from $245". */
  productTitle: (o: { name: string; market: string; inName: string; cheapestCents: number | null; productType?: string; setCode?: string | null }) => {
    // Every title names its region and keeps the product's TYPE, so a hobby box and a blaster of one release never share a title,
    // and the same product has its own title in each region. The region falls back to its code ("AU", "UK") when the name is long.
    const full = o.name;
    const from = fromText(o.cheapestCents, o.market);
    const tail = ` price, ${o.market}`;
    let fitted = keepTypeName(o.name, SEO_TITLE_MAX - tail.length, o.productType);
    for (let max = SEO_TITLE_MAX - tail.length - 4; `${fitted}${tail}`.length > SEO_TITLE_MAX && max > 12; max -= 4) fitted = keepTypeName(o.name, max, o.productType);
    return fitFirst(
      ...(from ? [`${full} price in ${o.inName}: from ${from}`, `${full} price in ${o.inName}`] : [`${full} price in ${o.inName}`]),
      `${full}${tail}`,
      `${fitted}${tail}`,
    );
  },
  /** The product description, cut to 160: the page's own sentence (product-copy.ts productDescription) with a short name when needed. */
  productDescription: (full: string, short: () => string) => fitDescription(full, short()),

  /** /<region>/stores/<store>: "Dave & Adam's: sealed sports card prices". */
  storeTitle: (storeName: string, page: number) => {
    const p = page > 1 ? ` (page ${page})` : "";
    return fitFirst(`${storeName}: sealed sports card prices & stock${p}`, `${storeName}: sports card box prices${p}`, `${storeName} sealed boxes${p}`, `${shortName(storeName, 40)} sealed boxes${p}`);
  },
};
