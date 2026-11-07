// Which eBay listings are NOT one unit of a sealed sports card product: shared by the importer (ebay-normalise.ts, ebay-sweep.ts) and the
// website's read path (ebay-read.ts drops a stored row that today's rules refuse). Pure; imports only the title normaliser and the
// set list, so the route's chain stays free of the importer's modules (tests/ebay-api.test.ts).
import { normalizeTitle, type TypeKey } from "./sealed-title";
import { SETS } from "./sets";

const CASE_TYPES = new Set<TypeKey>(["hobby-case"]);
const BOX_TYPES = new Set<TypeKey>(["hobby-box", "jumbo-box", "fotl-box", "breakers-delight", "choice-box", "fast-break-box", "hybrid-box", "lite-box", "super-box", "mega-box", "monster-box", "blaster-box", "hanger-box", "display-box"]);
const PACK_TYPES = new Set<TypeKey>(["retail-pack", "hobby-pack", "cello-pack", "value-pack"]);

/**
 * Listings never handed to a product (the catalogue sweep AND the per-product searches), on top of what identify() refuses (tested
 * on the accent-folded title): several units ("Lot", "Full Set", "All 4", "x3"), part of a product ("Box Only", "No Packs",
 * "Missing Promo"), a variant left to chance ("Random", "You Choose"), opened or damaged product, a single card pulled from one
 * (a collector number, a grade, "Pulled From"), and other languages' editions.
 */
const LISTING_REJECT = new RegExp(
  [
    "\\b(?:full|complete|whole)\\s+set\\b|\\ball\\s+(?:[2-9]|two|three|four|five|six)\\b|\\b(?:bundle|lot)\\s+of\\b|\\blots?\\b|\\bbulk\\b",
    // the contents of a product, not the product
    "\\b(?:pulled|taken)\\s+from\\b|\\bfrom\\s+(?:an?\\s+|the\\s+)?(?:[\\w'&-]+\\s+){0,6}?(?:booster\\s+box(?:es)?|display|bundles?|collector\\s+box|prerelease\\s+(?:pack|kit))\\b|\\b\\d{1,4}\\s*/\\s*\\d{2,4}\\b|#\\s?\\d{1,4}\\b",
    "\\b(?:missing|without|w/o|removed|incomplete|partial|contents)\\b|\\b(?:box|packaging|lands?|tokens?|promos?|cards?|dice|spindown|card\\s+box|art\\s+cards?|wrappers?)\\s+only\\b|\\bonly\\s+(?:the\\s+)?(?:box|promo|lands?|tokens?)\\b|\\bno\\s+(?:packs?|boosters?|promos?|cards?)\\b|\\bempty\\b",
    "\\b(?:rc|rookie|auto(?:graph)?|patch|refractor|parallel|insert|ssp|sp)\\s+(?:card|#)|\\bcase\\s+hit\\b|\\bbreak\\s+spot\\b|\\bspots?\\b|\\bpyt\\b|\\bpick\\s+your\\s+team\\b",
    "\\brandom\\b|\\bassorted\\b|\\bvariation\\b|\\bchosen\\b|\\bvarious\\b|\\bmystery\\b|\\byou\\s+choose\\b|\\bchoose\\s+(?:your|one|from|between)\\b|\\bpick\\s+(?:your|one|from)\\b|\\byour\\s+choice\\b",
    "\\bdamage[ds]?\\b|\\bcrushed\\b|\\btorn\\b|\\btears?\\b|\\bdents?\\b|\\bresealed\\b|\\bunsealed\\b|(?<!never\\s)(?<!not\\s)\\bopen(?:ed)?\\b|\\brepack\\w*|\\bbreaks?\\b|\\bproxy\\b|\\bproxies\\b",
    // a single card or a grade
    "\\b(?:psa|bgs|cgc|sgc|ace)\\s*\\d{1,2}(?:[.,]\\d)?\\b|\\bgrad(?:ed|e)?\\s*\\d|\\bslab\\w*\\b|\\b(?:nm|lp|mp|hp|near\\s+mint)\\b|\\b(?:borderless|extended\\s+art|showcase|serialized)\\b(?!.*\\b(?:secret\\s+lair|commander\\s+deck)\\b)",
    // several units: "4x", "x3", "(2)", "two boxes"
    "\\b(?:[2-9]|1\\d)\\s*x\\b(?!\\s*(?:play|collector|set|draft)?\\s*boosters?\\b)|\\bx\\s*(?:[2-9]|1\\d)\\b(?!\\s*(?:play|collector|set|draft)?\\s*boosters?\\b)|\\(\\s*[2-9]\\s*\\)|\\b(?:two|three|four|five|six)\\s+(?:booster\\s+)?(?:boxes|bundles|decks|displays)\\b",
    // another language's edition
    "\\b(?:japanese|japan|jpn|jp|german|deutsch\\w*|french|francais|italian|italiano|spanish|espanol|korean|chinese|russian|portuguese)\\b|\\((?:de|fr|it|es|jp|ru|pt)\\)|\\b(?:spiel|sammler)\\s*-?\\s*booster\\b",
    // not a product: a sample, an omega, a box topper, a ticket, a sleeve, a protector, a playmat
    "\\bsample\\b|\\bomega\\b|\\bbox\\s*topper\\b|\\btickets?\\b|\\bsleeves?\\b|\\bprotectors?\\b|\\bacrylic\\b|\\bplay\\s*mats?\\b|\\bdeck\\s*box\\b(?!\\s*(?:and|&|\\+))",
  ].join("|"),
  "i",
);

const foldTitle = (t: string) => normalizeTitle(t).toLowerCase();

// A listing that names two DIFFERENT sets is a mixed lot or another set's product ("Bloomburrow & Duskmourn Play Booster Box").
// Longest names first, so "Dominaria United" is one set, not Dominaria and another; "Jumpstart" is left out, being also a product
// word ("Marvel Super Heroes Jumpstart Booster Box").
const SET_RES: { code: string; re: RegExp }[] = SETS.filter((x) => x.code !== "jmp")
  .slice()
  .sort((a, b) => b.name.length - a.name.length)
  .map((x) => {
    const name = foldTitle(x.name)
      .split(/[\s:,.'\-]+/)
      .filter(Boolean)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[\\s:,.'\\-]*");
    return { code: x.code, re: new RegExp([`\\b${name}\\b`, ...(x.aliases ?? [])].map((r) => `(?:${r})`).join("|"), "gi") };
  });
function namesTwoSets(t: string): boolean {
  const codes = new Set<string>();
  let rest = t;
  for (const { code, re } of SET_RES) {
    if (!new RegExp(re.source, "i").test(rest)) continue;
    codes.add(code);
    rest = rest.replace(re, " ");
  }
  return codes.size >= 2;
}

/** Is this listing refused whatever product it is for (LISTING_REJECT, two sets named, on the accent-folded title)? */
export function refusedListing(title: string): boolean {
  const t = foldTitle(title);
  return LISTING_REJECT.test(t) || namesTwoSets(t);
}

// A booster pack product is ONE pack: "5 Play Boosters", "Booster Pack x10", "(10 Packs)", "Packs" are lots of it.
const SEVERAL_PACKS = /\b(?:[2-9]|[1-9]\d)\s*(?:x\s*)?(?:play\s+|collector\s+|set\s+|draft\s+)?(?:booster\s+)?(?:packs?|boosters)\b|\(\s*\d+\s*packs?\s*\)|\bpacks\b|\bboosters\b|\bx\s*\d+\b|\b\d+\s*x\b/i;
// "Play Booster Box with acrylic case": one item in a protector, not the case of boxes.
const WITH_A_CASE = /(?:\bw\/|\bwith\b|\bin\b|\+|\band\b|\bplus\b)\s*(?:an?\s+)?(?:acrylic|protective|magnetic|plastic|hard)?\s*(?:case|protector)\b|\b(?:acrylic|protective|magnetic)\s+case\b/i;
// A box "Case Fresh" is one box from a case, not the case.
const CASE_FRESH = /\bcase[\s-]*fresh\b|\bfresh\s+(?:from|out\s+of)\s+(?:a\s+)?case\b|\bfrom\s+(?:an?\s+)?(?:sealed\s+)?case\b/i;

/** Is this listing, read as `type`, not one unit of that type: a multi-pack lot of a pack, a "case fresh" box for a case, one booster for a box? */
export function refusedForType(title: string, type: TypeKey): boolean {
  const t = foldTitle(title);
  // "Set of 4" is the set's Commander decks together, a product of its own; on any other page it is several units.
  if (/\bset\s+of\b/.test(t)) return true;
  if (PACK_TYPES.has(type) && SEVERAL_PACKS.test(t)) return true;
  // A single pack is never a box, a display or a bundle ("box fresh" is a pack).
  if (PACK_TYPES.has(type) && type !== "value-pack" && (/\b(?:display|bundle)\b|\bbox\b(?!\s*fresh)/.test(t))) return true;
  if (CASE_TYPES.has(type) && (CASE_FRESH.test(t) || WITH_A_CASE.test(t))) return true;
  // A box is a box or a display: "20 packs" are loose packs.
  if (BOX_TYPES.has(type) && !/\b(?:box|boxes|display|displays)\b/.test(t)) return true;
  // "36 Play Boosters (loose, from a box)": the packs, not the box.
  if (BOX_TYPES.has(type) && /\bloose\b/.test(t)) return true;
  // Box types never stand in for each other: a hobby page takes no jumbo, FOTL, Breaker's Delight or retail box, and the reverse.
  const word: Partial<Record<TypeKey, RegExp>> = {
    "jumbo-box": /\bjumbo\b|\bhta\b/,
    "fotl-box": /\bfotl\b|\bfirst\s+off\s+the\s+line\b/,
    "breakers-delight": /\bbreaker'?s?\s+delight\b/,
    "choice-box": /\bchoice\b/,
    "fast-break-box": /\bfast\s+break\b/,
    "hybrid-box": /\bh2\b|\bhybrid\b/,
    "mega-box": /\bmega\b/,
    "blaster-box": /\bblaster\b/,
    "hanger-box": /\bhanger\b/,
    "value-pack": /\bvalue\s+packs?\b|\bfat\s+packs?\b/,
    "value-box": /\bvalue\s+box(?:es)?\b/,
    "cello-pack": /\bcello\b/,
  };
  const own = word[type];
  if (own && !own.test(t)) return true;
  for (const [other, re] of Object.entries(word)) if (other !== type && re!.test(t) && !(type === "hobby-case" && other === "jumbo-box")) return true;
  if (type === "hobby-box" && !/\bhobby\b/.test(t)) return true;
  return false;
}
