// The tools (the engine's two that fit sealed sports cards): small calculators and checkers at /<region>/tools/<slug>, each a
// standalone page with its own copy and FAQ, so a search for "hobby box price checker" lands on a page that answers it. The registry is pure (no database, no React): the sitemap, the
// footer and the tests read it as it stands. The pages are src/app/[region]/tools; each tool's interactive part is a client component
// (src/components/tools/), so the page's copy, FAQ and links are in the server HTML a crawler reads.
//
// The writing rules are the guides' (src/content/guides/index.ts): nothing may match BANNED_COPY, no pull rates, no claims about
// what a card or product will be worth, and every fee figure comes from lib/fees.ts with the day it was checked.
import type { Region } from "../../lib/regions";
import { REGION_LIST } from "../../lib/regions";

export type ToolSlug = "value-checker" | "selling-fee-calculator";

export interface ToolFaq {
  q: string;
  a: string;
}

export interface Tool {
  slug: ToolSlug;
  /** The H1 and the <title> (with " | SportsCardCompare" where it fits in 65 characters). */
  title: string;
  /** Meta description and the index card's text: at most 160 characters. */
  description: string;
  /** The index card's eyebrow. */
  kicker: string;
  /** The answer in a sentence, under the H1. */
  lede: string;
  /** What the tool does and how to read it: the page's running copy, a paragraph each. */
  about: readonly string[];
  /** How to use it, step by step. */
  steps: readonly string[];
  faq: readonly ToolFaq[];
  /** The guides it pairs with (guide slugs; the page links the ones offered in the region). */
  guides: readonly string[];
  /** Editorial date (YYYY-MM-DD). */
  updated: string;
}

export const TOOLS: readonly Tool[] = [
  {
    slug: "value-checker",
    title: "Hobby box value checker",
    description: "Check what a sealed hobby, jumbo, mega or blaster box costs at card shops today: the cheapest in-stock price, the median, and how many have it.",
    kicker: "Value checker",
    lede: "Search any sealed sports card box to see what independent card shops charge for it today, and how a price you were quoted compares.",
    about: [
      "The value checker reads the same data as the rest of SportsCardCompare: every independent store we track in your region, read about twice a day, with each store's own listed price and whether it has the product in stock. Search a hobby, jumbo, mega or blaster box, and it shows the cheapest in-stock price, the median of the stores that have it in stock, and how many stores have it.",
      "Type a price into the box under the result and the checker tells you where that price sits: under the cheapest store, between the cheapest and the median, or above what most stores ask. That makes it useful when a local card shop quotes a price, a friend offers you a box, or a marketplace listing looks cheap: you can see in a few seconds what the same product costs from a store right now.",
      "Sealed product only. For a single card, check recent sold listings on eBay instead. The checker never guesses what a product will be worth later: it reports what stores ask today, and says when they were last checked.",
    ],
    steps: [
      "Pick your region at the top of the site: prices are in its currency.",
      "Search the product by year, release and format, such as “2025 Topps Chrome Baseball Hobby Box”.",
      "Read the cheapest in-stock price and the median.",
      "Optional: type the price you were offered to see how it compares.",
    ],
    faq: [
      { q: "Where do the prices come from?", a: "From the independent online stores SportsCardCompare reads in your region, about twice a day. Each price is the store's own listed price, excluding shipping, and the result says when the stores were last checked." },
      { q: "What does the median mean here?", a: "The middle price of the stores that have the product in stock today. Half of those stores ask less and half ask more. It needs at least two stores in stock; with fewer, the checker shows the cheapest price alone." },
      { q: "Can it value a single card?", a: "No. SportsCardCompare compares sealed product: hobby, jumbo, mega and blaster boxes, cases and packs. For a single card, look at recent sold listings for the same card at the same grade." },
      { q: "Does a price under the median mean it is a good buy?", a: "It means it is cheaper than most stores ask today. Check the seller, the shipping cost and the shrink-wrap before you pay, especially when a price is far below every store's." },
      { q: "Why is a product missing?", a: "The checker lists products that at least one store in your region has in stock or that two or more stores list. A product no store we track sells in your region won't appear." },
    ],
    guides: ["hobby-vs-blaster-vs-mega-box", "how-to-avoid-resealed-sports-card-boxes"],
    updated: "2026-11-07",
  },
  {
    slug: "selling-fee-calculator",
    title: "eBay selling fee calculator for sports cards",
    description: "Work out eBay's fees on a sports card or sealed box sale, and what you keep after postage, with eBay's published rates or your own.",
    kicker: "Selling fees",
    lede: "Enter the sale price and postage to see eBay's final value fee, the per-order fee, and what the sale leaves you after your own costs.",
    about: [
      "eBay takes a final value fee on the whole amount the buyer pays, postage included, plus a small fee per order. The calculator applies eBay Australia's published rates, or the rate you type from your Seller Hub, to your sale, then subtracts what you paid for postage and for the item, so you see the money that is actually left.",
      "Rates depend on the seller. In Australia, eBay lets Australia-based sellers with up to A$25,000 in sales a year sell for free, and Pro plans pay by tier; in the US, sports trading cards have their own rate in Seller Hub. Pick the preset that matches you, or choose Custom and type the rate from your Seller Hub. Every preset says the day we checked eBay's page and links to it. Elsewhere, Custom is the only choice: we print no rate we have not read.",
      "Selling a sealed box? The value checker shows what stores charge for the same product today, which is the price most buyers will compare yours with.",
    ],
    steps: [
      "Choose the preset that matches how you sell, or Custom.",
      "Enter the item price and the postage you charge the buyer.",
      "Enter what the postage costs you and what you paid for the item.",
      "Read the fees, what eBay pays you and what you keep.",
    ],
    faq: [
      { q: "Does eBay charge its fee on postage?", a: "Yes. eBay's final value fee is a percentage of the total the buyer pays, which includes the postage you charge (and, in the US, sales tax). The calculator includes postage for that reason." },
      { q: "Do private sellers in Australia pay eBay fees?", a: "eBay's Australian fee page says Australia-based sellers with up to A$25,000 in sales over the past 12 months can sell for free. Above that, or on a Pro plan, fees apply. Check your own rate in Seller Hub." },
      { q: "Why does my fee differ from the calculator's?", a: "Your plan, store subscription, category, promotions and any optional listing upgrades all change it. Use Custom with the rate your Seller Hub shows to match your account exactly." },
      { q: "When were these rates checked?", a: "Each preset shows the date we read eBay's fee page and links to it. eBay changes its fees from time to time, so confirm before you price a big sale." },
    ],
    guides: ["where-to-buy-sealed-sports-cards-online", "how-to-avoid-resealed-sports-card-boxes"],
    updated: "2026-11-07",
  },
];

export const TOOL_BY_SLUG: ReadonlyMap<string, Tool> = new Map(TOOLS.map((t) => [t.slug, t]));

/** Every tool is offered in every region (each page reads its region's currency, prices and eBay site). */
export function toolRegions(_t: Tool): Region[] {
  return REGION_LIST.map((r) => r.region);
}

export const toolHref = (region: Region, slug: ToolSlug) => `/${region}/tools/${slug}`;

/** The <title>: " | SportsCardCompare" when it still fits in 65 characters. */
export function toolMetaTitle(title: string): string | { absolute: string } {
  return title.length + " | SportsCardCompare".length <= 65 ? title : { absolute: title };
}
