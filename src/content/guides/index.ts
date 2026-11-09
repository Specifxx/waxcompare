// The guides: evergreen, plain-English answers to what people ask before they buy sealed sports cards, each backed by the site's own
// live prices. A guide is a typed module, not MDX: src/content/guides/<slug>.tsx holds its prose and its live blocks, which render the
// region's current prices (src/content/guides/data.ts). This file is the registry. It is pure (no database, no React), so the sitemap
// (src/lib/sitemap.ts) and the tests read it as it stands.
//
// The writing rules (tests/guides.test.ts checks what can be checked):
//   • Facts are only those we are sure of. A box's pack count, its cards per pack and the hits it promises are printed on the box
//     and differ by release, so a guide never states them for a product kind; it tells the reader to read the maker's box.
//   • No pull rates, expected value, investment, trend or "best time to buy" claims, no quotes, no invented dates or numbers.
//   • Live numbers say "today" or "right now", with when the prices were checked. Nothing may match BANNED_COPY.
//   • No league, team or maker logo, and no maker or league named as if it endorsed the site.
//   • `published` and `updated` are editorial dates, set by hand when a guide is written or substantively edited.
//
// ADDING A GUIDE: an entry here, a module beside this file (export `outline` and `Body`, see kit.tsx), its line in modules.ts and its
// reads in data.ts (READS). The page, the index, the sitemap and the tests pick it up from here.
import type { Region } from "../../lib/regions";
import { REGION_LIST } from "../../lib/regions";

export type GuideSlug = "hobby-vs-blaster-vs-mega-box" | "where-to-buy-sealed-sports-cards-online" | "how-to-avoid-resealed-sports-card-boxes" | "sports-cards-black-friday-2026" | "hobby-box-vs-jumbo-box" | "hobby-case-vs-single-box";

export interface Guide {
  slug: GuideSlug;
  /** The H1, the Article headline and the <title>. With " | SportsCardCompare" it should fit in 60 characters; past that it goes out as title.absolute. */
  title: string;
  /**
   * The title as the region's copy says it, with "{in}" for the region ("MTG booster box prices in {in}" → "… in Australia"): the
   * H1, the <title> and the Article headline of /<region>/guides/<slug>, for guides that answer a "… price <country>" query. Absent:
   * `title` everywhere.
   */
  titleIn?: string;
  /** Meta description, Article description and the index card's text: at most 160 characters. */
  description: string;
  /** The index card's eyebrow: two or three words. */
  kicker: string;
  /** Editorial dates (YYYY-MM-DD). */
  published: string;
  updated: string;
  /** Where the guide is offered: every region, or a list . */
  regions: "all" | readonly Region[];
  /** The product type keys (lib/sealed-title.ts) its Related block links to; a key the type table does not have is skipped. */
  topic: { types?: readonly string[] };
  /** The guide's one eBay strip: its heading, and the words of its eBay search. */
  ebay: { heading: string; query: string };
}

const D = "2026-11-07";

export const GUIDES: readonly Guide[] = [
  {
    slug: "hobby-vs-blaster-vs-mega-box",
    title: "Hobby box vs blaster box vs mega box: which to buy",
    description: "What separates a sports card hobby box from a blaster, mega or hanger box, where each is sold, and what each costs in your region today.",
    kicker: "Box types",
    published: D,
    updated: D,
    regions: "all",
    topic: { types: ["hobby-box", "mega-box", "blaster-box", "hanger-box"] },
    ebay: { heading: "Sealed hobby boxes on eBay", query: "hobby box sealed" },
  },
  {
    slug: "where-to-buy-sealed-sports-cards-online",
    title: "Where to buy sealed sports cards online",
    description: "The card shops that sell sealed sports card boxes online in your region, who has the most in stock today, and what to check before you order.",
    kicker: "Where to buy",
    published: D,
    updated: D,
    regions: "all",
    topic: { types: ["hobby-box", "jumbo-box", "mega-box", "blaster-box"] },
    ebay: { heading: "Sealed sports card boxes on eBay", query: "sports cards hobby box sealed" },
  },
  {
    slug: "sports-cards-black-friday-2026",
    title: "Sports card Black Friday 2026: the prices to beat",
    description: "Sports card Black Friday and Cyber Monday 2026: the dates, today's cheapest sealed hobby, mega and blaster boxes, and five checks before you pay.",
    kicker: "Black Friday",
    published: "2026-11-07",
    updated: "2026-11-07",
    regions: "all",
    topic: { types: ["hobby-box", "mega-box", "blaster-box"] },
    ebay: { heading: "Sealed sports card boxes on eBay", query: "sports cards hobby box sealed" },
  },
  {
    slug: "how-to-avoid-resealed-sports-card-boxes",
    title: "How to avoid resealed sports card boxes",
    description: "How to spot a resealed or searched sports card box before you buy: the listing, the price against what card shops ask today, and the wrap.",
    kicker: "Buying safely",
    published: D,
    updated: D,
    regions: "all",
    topic: { types: ["hobby-box", "blaster-box"] },
    ebay: { heading: "Sealed hobby boxes on eBay", query: "hobby box factory sealed" },
  },
  {
    slug: "hobby-box-vs-jumbo-box",
    title: "Hobby box vs jumbo box: what is the difference",
    description: "What a sports card jumbo (HTA) box is, how it differs from a standard hobby box, and what each costs in your region today.",
    kicker: "Box types",
    published: "2026-11-09",
    updated: "2026-11-09",
    regions: "all",
    topic: { types: ["hobby-box", "jumbo-box"] },
    ebay: { heading: "Sealed jumbo boxes on eBay", query: "jumbo box sealed" },
  },
  {
    slug: "hobby-case-vs-single-box",
    title: "Sports card hobby case vs single boxes: what to check",
    description: "Buying a sealed sports card hobby case or single boxes: today's cheapest cases and boxes in your region, and four checks before you order.",
    kicker: "Buying",
    published: "2026-11-09",
    updated: "2026-11-09",
    regions: "all",
    topic: { types: ["hobby-case", "hobby-box"] },
    ebay: { heading: "Sealed hobby cases on eBay", query: "hobby case sealed" },
  },
];

export const GUIDE_BY_SLUG: ReadonlyMap<string, Guide> = new Map(GUIDES.map((g) => [g.slug, g]));

/** The regions a guide is offered in, in REGION_LIST order (hreflang, the sitemap, the index pages). */
export function guideRegions(g: Guide): Region[] {
  return REGION_LIST.map((r) => r.region).filter((r) => g.regions === "all" || g.regions.includes(r));
}

/** The guides offered in a region, in registry order. */
export function guidesFor(region: Region): Guide[] {
  return GUIDES.filter((g) => guideRegions(g).includes(region));
}

/** The guide at /<region>/guides/<slug>, or null: an unknown slug, or a guide not offered in that region. */
export function guideFor(slug: string, region: Region): Guide | null {
  const g = GUIDE_BY_SLUG.get(slug);
  return g && guideRegions(g).includes(region) ? g : null;
}

/** The <title>: the template adds " | SportsCardCompare" (13 characters) when the whole still fits in 60; otherwise the title alone. */
export function guideMetaTitle(title: string): string | { absolute: string } {
  return title.length +  " | SportsCardCompare".length <= 60 ? title : { absolute: title };
}

/** A guide's title in one region's copy: `titleIn` with the region's "in" name, else `title`. */
export function guideTitleIn(g: Pick<Guide, "title" | "titleIn">, r: { inName: string }): string {
  return g.titleIn ? g.titleIn.replace("{in}", r.inName) : g.title;
}
