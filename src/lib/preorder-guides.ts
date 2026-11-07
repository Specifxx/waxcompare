// The pre-order pages (/<region>/preorders/<set slug>): one per upcoming set
// that has been announced in enough detail to say what each product IS, not
// just what stores ask for it. Ported from Rift Compare's /radiance-preorders,
// which became that site's biggest pre-release landing page.
//
// Facts only, each from Wizards of the Coast's own announcements (magic.wizards.com,
// the Wizards Play Network) and dated: no prices here. The page's prices are the
// stores' live pre-order listings (ProductStat + Offer), and US MSRP comes from
// lib/rrp.ts like everywhere else — never typed twice.
//
// SELF-RETIRING: a guide's set is a pre-order only until its releaseDate in
// lib/sets.ts (isPreorderSet). From release day the page says it is out, points
// at the set page, drops out of the sitemap and is noindexed. A guide can then
// be deleted at leisure; nothing else depends on it.
import { SETS, SET_BY_CODE, SET_BY_SLUG, type MtgSet } from "./sets";
import type { TypeKey } from "./sealed-title";

export interface PreorderProduct {
  /** The product type the importer files it under (lib/sealed-title.ts). */
  type: TypeKey;
  /** What is in the box, from TPCi's product listing. */
  contents: string;
  /**
   * false: don't print lib/rrp.ts's US MSRP for this product on the pre-order
   * page, because the set's own announcement gives a different list price and
   * neither is confirmed yet. Default: printed (US page only).
   */
  msrp?: false;
}

/** A fact the guide prints with its source named beside it (a report, not TPCi's own words), so a reader can weigh it. */
export interface Attributed {
  text: string;
  /** "ICv2, 1 October 2026": who said it, and when. */
  source: string;
}

export interface PreorderGuide {
  setCode: string;
  /** "Mega Evolution—Delta Reign": the full English product-line name. */
  fullName: string;
  /** Prerelease events at participating stores (YYYY-MM-DD), when announced. */
  prereleaseFrom: string | null;
  /** Magic: The Gathering Live, when announced (YYYY-MM-DD). */
  liveDate: string | null;
  /** "over 135 cards", as TPCi words it. */
  cardCount: string;
  /** The Pokémon the set is built around. */
  headliners: string[];
  /** What the set holds, line by line, as TPCi's set description lists it ("6 Pokémon ex"); `makeupSource` says who reported it. */
  makeup: string[];
  makeupSource: string;
  /** A card type or rule new with the set (Delta Reign: Legendary Stadiums), or null. */
  newFeature: { name: string; text: string; source: string } | null;
  /**
   * Prerelease: where it is played, the size of its Build & Battle Box's ready-to-play deck and the box's promo cards (the box's
   * contents are the build-battle product's), with who reported them.
   */
  prerelease: { where: string; deckCards: number; promos: string[]; source: string } | null;
  /** Dated reports about buying the set (a sold-out first wave, say), each attributed. Never a price. */
  notes: Attributed[];
  products: PreorderProduct[];
  /** Where the facts above come from. */
  sources: { label: string; url: string }[];
  /** When the facts were last checked against the sources (YYYY-MM-DD). */
  checked: string;
}

// Empty since the Magic port (2026-10-21): the one guide here was a Pokémon set's. A Magic set's guide needs its own sourced facts
// in this shape; until one is written, Star Trek's dates and products are in src/content/star-trek.ts (the guides and the blog).
// No written guides yet: every pre-order page is the automatic one (blankGuide), from an announced release date in
// data/sets/release-dates.json. A written guide adds the maker's own facts (checklist size, what a hobby box holds), each sourced.
export const PREORDER_GUIDES: PreorderGuide[] = [];

const BY_CODE = new Map(PREORDER_GUIDES.map((g) => [g.setCode, g]));

/** US MSRP may be printed for this product type on the guide's page (see PreorderProduct.msrp). */
export function guideShowsMsrp(guide: PreorderGuide, type: TypeKey): boolean {
  return guide.products.find((p) => p.type === type)?.msrp !== false;
}

export function preorderGuide(setCode: string | null | undefined): PreorderGuide | null {
  return setCode ? BY_CODE.get(setCode) ?? null : null;
}

// AUTOMATIC PAGES (2026-11-02). A set in lib/sets.ts with no written guide still gets its pre-order page, from a blank guide
// (blankGuide): the set's name and dates, the stores' price lists and the generic FAQ, and none of the sourced facts a written guide
// adds (contents, prerelease, card count, sources). So adding the next set to sets.ts, which the importer needs anyway, is the whole
// job; a guide written later fills the same page. A guide-less page lives while the set is upcoming and for AUTO_DAYS_AFTER days after
// release (noindexed, saying the set is out), then the URL redirects to the set page.
export const AUTO_DAYS_AFTER = 45;

/** A guide with no facts beyond the set itself (see above). */
export function blankGuide(set: Pick<MtgSet, "code" | "name">): PreorderGuide {
  return {
    setCode: set.code,
    fullName: set.name,
    prereleaseFrom: null,
    liveDate: null,
    cardCount: "",
    headliners: [],
    makeup: [],
    makeupSource: "",
    newFeature: null,
    prerelease: null,
    notes: [],
    products: [],
    sources: [],
    checked: "",
  };
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/** A set's page is live: it has a written guide, or it is upcoming or released within AUTO_DAYS_AFTER days. */
function pageLive(set: Pick<MtgSet, "code" | "releaseDate" | "dateKnown">, today: string): boolean {
  if (BY_CODE.has(set.code)) return true;
  // A release whose date nobody announced has no pre-order window we can state: no page.
  if (!set.dateKnown) return false;
  const age = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${set.releaseDate}T00:00:00Z`)) / 86_400_000;
  return Number.isFinite(age) && age <= AUTO_DAYS_AFTER;
}

/** The guide (written, else blank) and its set for a URL slug, or null (the page 404s, or redirects to the set page). */
export function preorderGuideBySlug(slug: string, today = todayIso()): { guide: PreorderGuide; set: MtgSet } | null {
  const set = SET_BY_SLUG.get(slug);
  if (!set || !pageLive(set, today)) return null;
  return { guide: BY_CODE.get(set.code) ?? blankGuide(set), set };
}

/** The path under a region: /<region>/preorders/<set slug>, for a set whose page is live. */
// WaxCompare has no /preorders pages (removed 2026-11-07): a release's pre-orders are on its release page. Always null, so no
// link, banner or sitemap URL points at a page that does not exist.
export function preorderPath(_region: string, _setCode: string, _today = todayIso()): string | null {
  return null;
}

/** Every set that has not released yet (by lib/sets.ts), with its guide (written, else blank), soonest release first. */
export function openPreorderGuides(_today = todayIso()): { guide: PreorderGuide; set: MtgSet }[] {
  return []; // no /preorders pages on WaxCompare (see preorderPath)
}
