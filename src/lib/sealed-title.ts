// Store title → sealed sports card product identity.
//
// Every price on the site passes through identify(). It answers three questions about a store's product title, in order, and
// refuses rather than guesses:
//
//   1. Is this a factory-sealed sports card product? (not a single, a graded slab, a break spot, a repack, a mystery box, an
//      accessory, a Pokémon or other non-sport product, another language's edition, a store's own bundle or a damaged box)
//   2. Which release is it? Year or season + product line + sport (+ competition for soccer): "2025 Topps Chrome Baseball".
//      See lib/lines.ts and lib/sets.ts.
//   3. Which box type? Hobby, Jumbo, FOTL, Breaker's Delight, Choice, Mega, Blaster, Hanger, Value, Cello, a case, a pack…
//
// The product is release + type (+ an edition such as Asia), and nothing else, so two stores' wordings of one box merge and two
// different boxes never do. Wrongly merging two products is worse than failing to merge them: a merge puts a $30 blaster's price on
// a $300 hobby box's page as its "cheapest". So "2025-26" never matches "2026", an FOTL box never matches the plain hobby box, a
// UEFA box never matches a Premier League one, and a title whose year, line, sport or box type can't be read is refused.
//
// Pure module (no DB, no fetch) so it is unit-tested directly (tests/sealed-title.test.ts) and shared by the importer and the
// store probe.
import { COMPETITIONS, LINES, namesMaker, type Line, type Sport } from "./lines";
import { releaseFor, type CardSet, type ReleaseParts } from "./sets";

// ── product types ────────────────────────────────────────────────────────────

export type TypeKey =
  | "hobby-box"
  | "jumbo-box"
  | "fotl-box"
  | "breakers-delight"
  | "choice-box"
  | "fast-break-box"
  | "hybrid-box"
  | "lite-box"
  | "super-box"
  | "mega-box"
  | "monster-box"
  | "blaster-box"
  | "hanger-box"
  | "value-pack"
  | "value-box"
  | "cello-pack"
  | "tin"
  | "display-box"
  | "factory-set"
  | "hobby-pack"
  | "retail-pack"
  | "hobby-case"
  | "sticker-album"
  | "starter-pack";

export interface ProductTypeInfo {
  key: TypeKey;
  label: string; // singular, as it reads in a product name
  plural: string; // for headings and category pages
  slug: string; // URL segment for /<region>/type/<slug>
  /** Every type is one product per release (identity = release + type); kept for the engine's shared shape. */
  kind: "set" | "multi";
  /** Hobby-channel product (sold through hobby shops) rather than retail: the type pages group by it. */
  channel: "hobby" | "retail" | "other";
  // Lowest believable price, in US cents, converted per market (FLOOR_FX). A listing below it is a deposit, a single pack sold as
  // a box, or a mis-listing.
  floorUsdCents: number;
}

export const PRODUCT_TYPES: ProductTypeInfo[] = [
  { key: "hobby-box", label: "Hobby Box", plural: "Hobby Boxes", slug: "hobby-boxes", kind: "set", channel: "hobby", floorUsdCents: 4000 },
  { key: "jumbo-box", label: "Jumbo Box", plural: "Jumbo (HTA) Boxes", slug: "jumbo-boxes", kind: "set", channel: "hobby", floorUsdCents: 10000 },
  { key: "fotl-box", label: "FOTL Hobby Box", plural: "First Off The Line (FOTL) Boxes", slug: "fotl-boxes", kind: "set", channel: "hobby", floorUsdCents: 10000 },
  { key: "breakers-delight", label: "Breaker's Delight Box", plural: "Breaker's Delight Boxes", slug: "breakers-delight-boxes", kind: "set", channel: "hobby", floorUsdCents: 8000 },
  { key: "choice-box", label: "Choice Box", plural: "Choice Boxes", slug: "choice-boxes", kind: "set", channel: "hobby", floorUsdCents: 5000 },
  { key: "fast-break-box", label: "Fast Break Box", plural: "Fast Break Boxes", slug: "fast-break-boxes", kind: "set", channel: "hobby", floorUsdCents: 5000 },
  { key: "hybrid-box", label: "H2 Hybrid Box", plural: "H2 Hybrid Boxes", slug: "hybrid-boxes", kind: "set", channel: "hobby", floorUsdCents: 3000 },
  { key: "lite-box", label: "Lite Box", plural: "Lite Boxes", slug: "lite-boxes", kind: "set", channel: "hobby", floorUsdCents: 3000 },
  { key: "super-box", label: "Super Box", plural: "Super Boxes", slug: "super-boxes", kind: "set", channel: "hobby", floorUsdCents: 6000 },
  { key: "hobby-case", label: "Hobby Case", plural: "Hobby Cases", slug: "hobby-cases", kind: "set", channel: "hobby", floorUsdCents: 30000 },
  { key: "hobby-pack", label: "Hobby Pack", plural: "Hobby Packs", slug: "hobby-packs", kind: "set", channel: "hobby", floorUsdCents: 500 },
  { key: "mega-box", label: "Mega Box", plural: "Mega Boxes", slug: "mega-boxes", kind: "set", channel: "retail", floorUsdCents: 2000 },
  { key: "monster-box", label: "Monster Box", plural: "Monster Boxes", slug: "monster-boxes", kind: "set", channel: "retail", floorUsdCents: 3000 },
  { key: "blaster-box", label: "Blaster Box", plural: "Blaster Boxes", slug: "blaster-boxes", kind: "set", channel: "retail", floorUsdCents: 1500 },
  { key: "hanger-box", label: "Hanger Box", plural: "Hanger Boxes", slug: "hanger-boxes", kind: "set", channel: "retail", floorUsdCents: 800 },
  { key: "value-pack", label: "Value Pack", plural: "Value & Fat Packs", slug: "value-packs", kind: "set", channel: "retail", floorUsdCents: 500 },
  { key: "value-box", label: "Value Box", plural: "Value Boxes", slug: "value-boxes", kind: "set", channel: "retail", floorUsdCents: 1500 },
  { key: "cello-pack", label: "Cello Pack", plural: "Cello Packs", slug: "cello-packs", kind: "set", channel: "retail", floorUsdCents: 300 },
  { key: "tin", label: "Tin", plural: "Tins", slug: "tins", kind: "set", channel: "retail", floorUsdCents: 1000 },
  { key: "display-box", label: "Display Box", plural: "Retail Display Boxes", slug: "display-boxes", kind: "set", channel: "retail", floorUsdCents: 2500 },
  { key: "retail-pack", label: "Pack", plural: "Retail Packs", slug: "packs", kind: "set", channel: "retail", floorUsdCents: 100 },
  { key: "factory-set", label: "Factory Set", plural: "Factory Sets", slug: "factory-sets", kind: "set", channel: "other", floorUsdCents: 3000 },
  { key: "starter-pack", label: "Starter Pack", plural: "Starter Packs", slug: "starter-packs", kind: "set", channel: "other", floorUsdCents: 300 },
  { key: "sticker-album", label: "Album", plural: "Sticker Albums", slug: "sticker-albums", kind: "set", channel: "other", floorUsdCents: 200 },
];

export const TYPE_BY_KEY = new Map(PRODUCT_TYPES.map((t) => [t.key, t]));
export const TYPE_BY_SLUG = new Map(PRODUCT_TYPES.map((t) => [t.slug, t]));
export const TYPE_BY_LABEL = new Map(PRODUCT_TYPES.map((t) => [t.label, t]));

/** Display order: the order PRODUCT_TYPES is written in (hobby product first). */
export function typeRank(label: string): number {
  const i = PRODUCT_TYPES.findIndex((t) => t.label === label || label.endsWith(` ${t.label}`));
  return i < 0 ? 99 : i;
}

// Rough units-per-USD, used ONLY to scale the per-type price floors into each market's currency, and to size up an ask against
// other markets' prices. Never used to show a price: every price on the site is the store's own, in the store's own currency.
const FLOOR_FX: Record<string, number> = { AU: 1.5, NZ: 1.65, US: 1, UK: 0.78, CA: 1.37, EU: 0.9, SG: 1.3 };

export function floorCents(type: TypeKey, market: string): number {
  const t = TYPE_BY_KEY.get(type);
  if (!t) return 0;
  return Math.round(t.floorUsdCents * (FLOOR_FX[market] ?? 1));
}

/** A price in a market's currency, very roughly in US cents. For comparisons only, never for display. */
export function roughUsdCents(cents: number, market: string): number {
  return cents / (FLOOR_FX[market] ?? 1);
}

/** The inverse: US cents in a market's currency, very roughly. For thresholds only (the eBay import's eligibility), never for display. */
export function fromRoughUsdCents(usdCents: number, market: string): number {
  return usdCents * (FLOOR_FX[market] ?? 1);
}

// ── normalisation ────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", ndash: "–", mdash: "—", eacute: "é", rsquo: "’", lsquo: "‘" };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** Working form: entities decoded, accents folded, dashes and quotes unified, whitespace collapsed. */
export function normalizeTitle(title: string): string {
  return decodeEntities(title)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‐-―]/g, "-")
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ── gates ────────────────────────────────────────────────────────────────────

// Not a sports product: card games, and the non-sport lines the sports makers also print (Star Wars, Marvel, Garbage Pail Kids…).
const OTHER =
  /\b(?:pokemon|pkmn|ptcg|magic\s*:?\s*the\s*gathering|mtg|yu-?gi-?oh|one\s*piece|lorcana|digimon|dragon\s*ball|flesh\s*(?:and|&)\s*blood|riftbound|union\s*arena|gundam|weiss|star\s*wars|marvel|dc\s*comics|disney|pixar|harry\s*potter|garbage\s*pail|wacky\s*packages|stranger\s*things|lord\s*of\s*the\s*rings|hobbit|nintendo|bluey|minecraft|fortnite|godzilla|jurassic|transformers|power\s*rangers|spongebob|simpsons|looney|wizarding|game\s*of\s*thrones|star\s*trek|alien|predator|mythic|kakawow)\b/i;

// The language named, or a bracketed code: Topps and Panini print some lines for other markets ("Japan Edition", German stickers).
const FOREIGN =
  /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0400-\u04ff]|\b(?:japanese|japan\s*edition|npb|korean|kbo|chinese|cpbl|russian|german|deutsch\w*|french|francais|italian|italiano|spanish|espanol|portuguese|dutch|polish)\b|[(\[]\s*(?:jp|jpn|kr|cn|de|fr|it|es|pt|nl|pl)\s*[)\]]/i;

// Singles, slabs, breaks and anything that isn't a factory-sealed product.
const NOT_SEALED =
  /\b(?:psa|cgc|bgs|beckett\s*graded|sgc|graded|slab|slabbed)\b|\bgem\s*mint\b|\bsingles?\b|\bsingle\s*cards?\b|\bbase\s*cards?\b|#\s*\d{1,4}\b|#\s*[a-z]{1,5}\s*-\s*\d{1,4}\b|\bssp\b|\bcase\s*hits?\b|\bauto\s*$|\brookie\s*card\b|\brc\s*(?:lot|card)\b|\b(?:box|case|group|team|pack|live|personal|hit)\s*breaks?\b|(?<!\bfast\s)\bbreaks?\b|\bspots?\b|\brandom\s*(?:team|division|player|serial|hit|letter|number)s?\b|\bpick\s*your\b|\b(?:pyt|pyd|pyp)\b|\bhit\s*draft\b|\brip\s*(?:&|and|n)\s*ship\b|\brepack(?:ed|s)?\b|\bmystery\b|\blucky\s*(?:dip|bag|box)\b|\bgrab\s*bag\b|\bhit\s*parade\b|\bfanatics\s*(?:mystery|fest)\b|\bresealed\b|\bopened\b|\bempty\b|\bbox\s*only\b|\bwrappers?\b|\bdamaged\b|\bdented\b|\bcrushed\b|\btorn\b|\bcustom\b|\bproxy\b|\breprints?\b|\btopps\s*now\b|\bliving\s*set\b|\bon\s*-?\s*demand\b|\bteam\s*set\b|\bsigned\b|\bautographed\s*(?:ball|jersey|photo|helmet|bat)\b|\bdigital\b|\bcode\b|\bgift\s*card\b|\bvoucher\b|\bdeposit\b/i;

// Accessories and merchandise. Albums and stickers are products only in the sticker lines (Panini Stickers, Match Attax), read later.
const ACCESSORY =
  /\bsleeves?\b|\btop\s*-?\s*loaders?\b|\bone\s*-?\s*touch\b|\bmagnetic\b|\bcard\s*(?:saver|holder|case|stand|protector)s?\b|\bpenny\b|\bteam\s*bags?\b|\bbinders?\b|\bportfolio\b|\bstorage\b|\bdisplay\s*(?:case|stand|frame)\b|\bscrew\s*-?\s*down\b|\bultra\s*pro\b|\bbcw\b|\bcardboard\s*gold\b|\bacrylic\b|\buv\b|\bframe\b|\bposter\b|\bbobble\s*-?\s*head\b|\bfunko\b|\bfigur(?:e|es|ine)\b|\bplush\b|\bt-?\s*shirt\b|\bhoodie\b|\bhat\b|\bcap\b|\bmug\b|\bkeychain\b|\bjersey\s*(?:frame|display)\b|\bmini\s*helmet\b|\bball\b|\bbat\b|\bpuck\b/i;

// Store-made multiples and lots: priced for several units, so never comparable with one.
const MULTIPLE =
  /\(\s*pair\s*\)|\bpairs?\b|\b(?:set|bundle|lot)\s*of\s*(?:[2-9]|[1-9]\d|two|three|four|five|six)\b|\blots?\b|\bbundles?\b|\bcombo\b|\bbulk\b|^\s*[2-9]\d?\s*x\b|\bx\s*[2-9]\d?\s*\)?\s*$|[([]\s*[2-9]\d?\s*x\s*[)\]]|[([]\s*x\s*[2-9]\d?\s*[)\]]|\b(?:[2-9]|[1-9]\d|two|three|four|five|six)\s*(?:x\s*)?(?:hobby\s*|blaster\s*|mega\s*|value\s*|jumbo\s*)?boxes\b|\bhalf\s*case\b|\b[2-9]\s*-?\s*tins?\b|\b(?:[2-9]|[1-9]\d)\s*x\s*(?:hobby|blaster|mega|value|jumbo|cello|hanger)?\s*(?:packs?|boxes?)\b|\s\+\s/i;

// A retailer's own edition (different parallels from the hobby or plain retail product): never merged with it.
const RETAIL_EDITION = /\bwalmart\b|\btarget\b|\bcostco\b|\bsam'?s\s*club\b|\bmeijer\b|\bdollar\s*general\b|\bbest\s*buy\b|\bamazon\s*exclusive\b|\bkmart\b|\bbig\s*w\b|\btesco\b|\basda\b|\bsmyths\b|\bfanatics\s*exclusive\b|\bexclusive\b/i;

// Words that make a title a different product from the line it matched, read once that line's own words are out: a sub-brand
// (Cosmic, Sapphire, No Huddle, Monopoly, Bowman University…), another league's edition (EuroLeague, NBL, Overtime Elite, USA), a
// second line (Stadium Club Chrome), a premium or "extra" version, a hobby-only "Preferred" box. Refused, never merged into the base
// release (found by the first import, 2026-11-07: a EuroLeague box was the cheapest "Prizm Basketball" hobby box).
const VARIANT =
  /\bcosmic\b|\bsapphire\b|\bno\s*huddle\b|\bstars\s*(?:&|and)\s*stripes\b|\busa\s*(?:baseball|basketball|national)\b|\bteam\s*usa\b|\beuro\s*league\b|\bturkish\s*airlines\b|\bebl\b|\bnbl\b|\bovertime\s*elite\b|\bote\b|\bmonopoly\b|\bblack\s*diamond\b|\bpreferred\b|\buniversity\b|\bbowman\b|\bstadium\s*club\b|\bpulse\b|\baura\b|\bupdate\b|\bextra\b|\beco\s*pack\b|\bpremium\b|\bsuper\s*jumbo\b|\bbest\s*u\b|\bu\b/i;

// ── release: year, line, sport, competition ──────────────────────────────────

export type ReleaseRejection = "no-year" | "two-years" | "no-line" | "no-sport" | "two-sports" | "two-competitions";

/** "2024-25", "2024/25", "2024-2025", "24-25" → "2024-25"; "2025" → "2025". Two different years in one title: refused. */
export function readYear(t: string): string | "none" | "two" {
  const found = new Set<string>();
  let rest = t;
  for (const m of t.matchAll(/\b(20[12]\d)\s*[-/]\s*(?:20)?(\d\d)\b/g)) {
    const y = Number(m[1]);
    if ((y + 1) % 100 !== Number(m[2])) continue;
    found.add(`${y}-${m[2]}`);
    rest = rest.replace(m[0], " ");
  }
  // "2024 25" (a store that dropped the dash), never "2024 25 packs".
  for (const m of rest.matchAll(/\b(20[12]\d)\s+(\d\d)\b(?!\s*(?:packs?|cards?|boxes|box|ct|count|pk)\b)/gi)) {
    const y = Number(m[1]);
    if ((y + 1) % 100 !== Number(m[2])) continue;
    found.add(`${y}-${m[2]}`);
    rest = rest.replace(m[0], " ");
  }
  for (const m of rest.matchAll(/(?<![\d/-])([12]\d)\s*-\s*([12]\d)(?![\d/-])/g)) {
    const a = Number(m[1]);
    if (a + 1 !== Number(m[2]) || a < 15) continue;
    found.add(`20${m[1]}-${m[2]}`);
    rest = rest.replace(m[0], " ");
  }
  const singles = [...rest.matchAll(/\b(20[12]\d)\b/g)].map((m) => m[1]);
  for (const y of singles) {
    // "2024-25 … 2025 release": a calendar year inside the season names nothing new.
    if ([...found].some((s) => s.startsWith(y) || `20${s.slice(5)}` === y)) continue;
    found.add(y);
  }
  if (!found.size) return "none";
  if (found.size > 1) return "two";
  return [...found][0];
}

const SOCCER_CONTEXT = /\bsoccer\b|\buefa\b|\bpremier\s*league\b|\bchampions\s*league\b|\bepl\b|\bmls\b|\bbundesliga\b|\bla\s*liga\b|\bserie\s*a\b|\bworld\s*cup\b|\bfifa\b|\bclub\s*competitions?\b|\beuro\s*20\d\d\b|\bmerlin\b|\bmatch\s*attax\b|\badrenalyn\b|\bspfl\b|\bscottish\b/i;

const SPORT_WORDS: [Sport, RegExp][] = [
  ["baseball", /\bbaseball\b|\bmlb\b/i],
  ["wnba", /\bwnba\b/i],
  ["basketball", /\bbasketball\b|\bnba\b/i],
  ["hockey", /\bhockey\b|\bnhl\b/i],
  ["f1", /\bf1\b|\bformula\s*(?:1|one)\b/i],
  ["ufc", /\bufc\b|\bmma\b/i],
  ["wrestling", /\bwwe\b|\bwrestling\b|\baew\b/i],
  ["nrl", /\bnrl\b|\brugby\s*league\b/i],
  ["afl", /\bafl\b|\baussie\s*rules\b/i],
  ["cricket", /\bcricket\b|\bbig\s*bash\b|\bipl\b/i],
  ["racing", /\bnascar\b|\bindycar\b|\bmotogp\b|\bracing\b/i],
  ["golf", /\bgolf\b|\bpga\b/i],
  ["tennis", /\btennis\b/i],
  ["multi", /\bmulti\s*-?\s*sports?\b/i],
];

export function readSports(t: string): Set<Sport> {
  const out = new Set<Sport>();
  for (const [s, re] of SPORT_WORDS) if (re.test(t)) out.add(s);
  if (out.has("wnba")) out.delete("basketball");
  const soccer = SOCCER_CONTEXT.test(t);
  if (soccer) out.add("soccer");
  // "Football" is soccer beside a competition or the word soccer, the American game beside "NFL" or alone.
  if (!soccer && /\bfootball\b|\bnfl\b/i.test(t)) out.add("football");
  if (soccer && /\bnfl\b/i.test(t)) out.add("football");
  return out;
}

const MAKER_NAMED: [Line["maker"], RegExp][] = [
  ["Topps", /\btopps\b|\bbowman\b/i],
  ["Panini", /\bpanini\b|\bdonruss\b/i],
  ["Upper Deck", /\bupper\s*deck\b/i],
  ["Leaf", /\bleaf\b/i],
  ["Futera", /\bfutera\b/i],
];

/** The release a title names, or why it can't be read. */
export function readRelease(title: string): ReleaseParts | ReleaseRejection {
  const t = normalizeTitle(title);
  const year = readYear(t);
  if (year === "none") return "no-year";
  if (year === "two") return "two-years";
  const sports = readSports(t);
  if (sports.size > 1) return "two-sports";
  const named = MAKER_NAMED.filter(([, re]) => re.test(t)).map(([m]) => m);
  const candidates = LINES.filter((l) => l.re.test(t) && (!l.needsMaker || namesMaker(l, t)) && (!named.length || named.includes(l.maker) || l.maker === "Select"));
  if (!candidates.length) return "no-line";
  let sport: Sport | undefined;
  let line: Line | undefined;
  if (sports.size === 1) {
    sport = [...sports][0];
    line = candidates.find((l) => l.sports.includes(sport!));
    if (!line) return "no-line";
  } else {
    line = candidates.find((l) => l.defaultSport);
    sport = line?.defaultSport;
    // The first line matched must be the one that gives the sport: "Topps Chrome Update" alone is baseball, but "Prizm" alone is
    // any of nine sports, and a later line's default must not decide it.
    if (!line || line !== candidates[0]) return "no-sport";
  }
  // Topps sells "Football" boxes in both games, and UK stores call soccer football: a Topps football title must say which.
  // A single calendar year settles it: Topps names its soccer boxes by season ("2024-25") or by a tournament the title then names
  // (Euro 2024, World Cup: soccer context above), and its NFL boxes by one year ("2024 Topps Chrome Football").
  if (sport === "football" && line.maker === "Topps" && !/^bowman-(?:chrome-)?university$/.test(line.key) && !/\bnfl\b|\bamerican\s*football\b/i.test(t) && year.includes("-")) return "no-sport";
  let competition: string | undefined;
  if (sport === "soccer") {
    const comps = COMPETITIONS.filter((c) => c.re.test(t));
    // "UEFA Women's Champions League" also reads as UEFA: keep the longest, refuse two that don't overlap.
    const distinct = comps.filter((c, i) => !comps.slice(0, i).some((p) => (p.key === "uwcl" && c.key === "uefa") || (p.key === "club-world-cup" && c.key === "world-cup") || (p.key === "euro" && c.key === "uefa")));
    if (distinct.length > 1) return "two-competitions";
    competition = distinct[0]?.key ?? line.defaultCompetition;
  }
  return { year, line, sport: sport!, ...(competition ? { competition } : {}) };
}

/** The release a title names, or null. */
export function detectSet(title: string): CardSet | null {
  const r = readRelease(title);
  return typeof r === "object" ? releaseFor(r) : null;
}

// ── box type ─────────────────────────────────────────────────────────────────

// Lines sold only as a hobby box (a "Box" with no other word is its hobby box).
const HOBBY_ONLY = new Set([
  "chrome-sapphire", "bowman-chrome-sapphire", "chrome-black", "chrome-platinum", "chrome-logofractor", "dynasty", "national-treasures", "immaculate", "flawless",
  "the-cup", "triple-threads", "five-star", "museum-collection", "tier-one", "definitive", "gold-label", "inception", "pristine",
  "ultimate-collection", "sp-game-used", "spx", "eminence", "one-and-one", "impeccable", "noir", "bowman-sterling", "bowman-inception",
  "tribute", "archives-signature", "spectra", "obsidian", "crown-royale", "origins",
]);
const STICKER_LINES = new Set(["panini-stickers", "topps-stickers", "match-attax", "adrenalyn", "turbo-attax"]);

/** The box type a title describes, or null when it isn't one we compare. Reads the lowercased, normalised title. */
export function readType(t: string, lineKey?: string): TypeKey | null {
  const s = t.toLowerCase().replace(/,/g, " "); // "Hobby, Pack", "Fat, Pack": a store's comma is not a word
  const stickers = lineKey ? STICKER_LINES.has(lineKey) : false;
  if (/\bcase\b/.test(s)) {
    if (/\binner\s*case\b|\bdisplay\s*case\b|\bcard\s*case\b|\bcase\s*breaks?\b/.test(s)) return null;
    if (/\b(?:blaster|mega|hanger|value|cello|tin|retail|jumbo\s*pack|fat\s*pack)\b/.test(s)) return null;
    return "hobby-case";
  }
  if (/\bfotl\b|\bfirst\s*off\s*the\s*line\b/.test(s)) return "fotl-box";
  if (/\bbreaker'?s?\s*delight\b/.test(s)) return "breakers-delight";
  if (/\bfast\s*break\b/.test(s)) return "fast-break-box";
  if (/\bchoice\b/.test(s)) return "choice-box";
  if (/\bh2\b|\bhybrid\b/.test(s)) return "hybrid-box";
  if (/\bvalue\s*box(?:es)?\b/.test(s)) return "value-box";
  if (/\bcello\s*box(?:es)?\b/.test(s)) return null;
  if (/\bjumbo\s*(?:packs?|value|fat|retail)\b|\bvalue\s*packs?\b|\bfat\s*packs?\b|\bmulti\s*-?\s*packs?\b/.test(s)) return "value-pack";
  if (/\bhta\b|\bjumbo\b/.test(s)) return "jumbo-box";
  if (/\bhobby\s*lite\b|\blite\s*box\b/.test(s)) return "lite-box";
  if (/\bsuper\s*box\b/.test(s)) return "super-box";
  if (/\btins?\b/.test(s)) return "tin";
  if (/\bmonster\s*box\b/.test(s)) return "monster-box";
  if (/\bmega\b/.test(s)) return "mega-box";
  if (/\bblaster\b/.test(s)) return "blaster-box";
  if (/\bhanger\b/.test(s)) return "hanger-box";
  if (/\bcello\b|\brack\s*packs?\b/.test(s)) return "cello-pack";
  if (/\bfactory\s*set\b|\bcomplete\s*set\b|\b(?:hobby|retail)\s*set\b/.test(s)) return "factory-set";
  if (stickers && /\balbums?\b/.test(s)) return "sticker-album";
  if (stickers && /\bstarter\s*(?:packs?|kit|set)\b/.test(s)) return "starter-pack";
  if (/\bgravity\s*feed\b|\bretail\s*(?:box|display)\b|\bdisplay\s*box\b|\bdisplay\b|\bbooster\s*box\b|\bsticker\s*box\b/.test(s)) return /\bhobby\b/.test(s) ? "hobby-box" : "display-box";
  if (/\bhobby\b/.test(s)) return /\bhobby\s*packs?\b/.test(s) && !/\bhobby\s*box\b/.test(s) ? "hobby-pack" : "hobby-box";
  if (/\bpacks?\b|\bpackets?\b|\bsachets?\b|\bboosters?\b/.test(s)) return "retail-pack";
  if (/\bbox\b/.test(s) && lineKey && HOBBY_ONLY.has(lineKey)) return "hobby-box";
  return null;
}

/** The product type a title describes, or null. */
export function classify(title: string): TypeKey | null {
  const r = readRelease(title);
  return readType(normalizeTitle(title), typeof r === "object" ? r.line.key : undefined);
}

// ── editions ─────────────────────────────────────────────────────────────────

// Boxes made for one market, with their own contents: an Asia or Tmall box is not the US hobby box.
const EDITIONS: { key: string; label: string; re: RegExp }[] = [
  { key: "asia", label: "Asia", re: /\basia(?:n)?\b|\btmall\b/i },
  { key: "international", label: "International", re: /\binternational\b|\bint'?l\b/i },
  { key: "european", label: "European", re: /\beuropean\s*(?:edition|version)\b|\beu\s*(?:edition|version)\b/i },
];

// ── identity ─────────────────────────────────────────────────────────────────

export interface SealedIdentity {
  groupKey: string;
  type: TypeKey;
  typeLabel: string;
  set: CardSet | null;
  name: string; // display name for a NEW product row
  slugBase: string; // preferred slug for a NEW product row
}

export type Rejection =
  | "foreign"
  | "not-sealed"
  | "accessory"
  | "multiple"
  | "retail-edition"
  | "not-sports"
  | "unclassified"
  | "no-set"
  | "vague";

export function slugify(s: string): string {
  return normalizeTitle(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "");
}

const ACRONYMS = new Set(["NBA", "NFL", "MLB", "NHL", "UFC", "WWE", "AEW", "NRL", "AFL", "UEFA", "MLS", "EPL", "FIFA", "WNBA", "F1", "FOTL", "HTA", "RC", "H2", "SP", "SPX", "OPC", "UD", "II", "III", "IV", "UK", "US", "USA"]);
const SMALL_WORDS = new Set(["of", "and", "the", "a", "an", "in", "on", "with", "&", "vs", "x"]);

/** An ALL-CAPS name in title case ("TOPPS CHROME HOBBY BOX" → "Topps Chrome Hobby Box"), keeping the hobby's acronyms. */
export function titleCase(t: string): string {
  return t.replace(/[\p{L}\p{N}'’]+/gu, (w, i: number) => {
    const up = w.toUpperCase();
    if (ACRONYMS.has(up)) return up;
    const low = w.toLowerCase();
    if (i > 0 && SMALL_WORDS.has(low)) return low;
    return low.replace(/^\p{L}/u, (c) => c.toUpperCase());
  });
}

/** The store's title, tidied: store notes and brackets out. Product rows take the release's own name instead (identify()). */
export function cleanName(title: string): string {
  const t = decodeEntities(title)
    .replace(/[\u2063\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s*[([][^)\]]*(?:\bpre[-\s]?orders?|\breleas|\bships?\b|\beta\b|\blimit|\barriv|\bper\s*(?:customer|household|order|person)\b|\bpick[\s-]*up)[^)\]]*[)\]]\s*/gi, " ")
    .replace(/\bpre[\s-]?orders?\b|\bpresale\b|\b(?:factory\s*)?sealed\b|\bbrand\s*new\b/gi, " ")
    .replace(/\(\s*\)|\[\s*\]/g, " ")
    .replace(/(?:\s*[-–—|:]\s*){2,}/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/^[\s:\-–—|,]+|[\s:\-–—|,]+$/g, "")
    .trim();
  const caps = (t.match(/\p{L}{3,}/gu) ?? []).filter((w) => !ACRONYMS.has(w.toUpperCase()));
  const shouted = caps.length >= 2 && caps.filter((w) => w === w.toUpperCase()).length >= caps.length * 0.6;
  const out = shouted ? titleCase(t) : t;
  return out.length >= 4 ? out : decodeEntities(title).trim();
}

/**
 * Identify a store title as a comparable sealed sports card product.
 *
 * `strict` is for titles read from a collection that isn't sports-specific ("pre-orders", "new arrivals"): those must name a maker
 * (Topps, Bowman, Panini, Donruss, Upper Deck, Select, Futera), since a line word alone ("Prizm", "Chrome") is safest with one.
 */
export function identify(title: string, opts: { strict?: boolean } = {}): SealedIdentity | Rejection {
  const t = normalizeTitle(title).replace(/\s*\|\s*[^|]*$/, (seg) => (readType(seg) || readYear(seg) !== "none" ? seg : ""));
  if (!t) return "unclassified";
  if (FOREIGN.test(t)) return "foreign";
  if (OTHER.test(t)) return "not-sports";
  if (NOT_SEALED.test(t)) return "not-sealed";
  // A print run or serial ("/99", "12/25"), read once the season ("2024/25") and a store's dated note ("Pre-Order, ships 10/15",
  // "Release Date: 11/20/2025") are out of the way.
  const undated = t
    .replace(/\b20[12]\d\s*\/\s*(?:20)?\d\d\b/g, " ")
    .replace(/[([][^)\]]*\b(?:pre[-\s]?orders?|releas\w*|ships?|shipping|eta|arriv\w*|available|out)\b[^)\]]*[)\]]/gi, " ")
    .replace(/\b(?:releas\w*|ships?|shipping|eta|arriv\w*|available|out|street)\s*(?:date|on)?\s*:?\s*\d{1,2}\s*\/\s*\d{1,2}(?:\s*\/\s*\d{2,4})?\b/gi, " ");
  if (/\b\d{1,4}\s*\/\s*\d{2,4}\b/.test(undated)) return "not-sealed";
  if (ACCESSORY.test(t)) return "accessory";
  if (MULTIPLE.test(t.replace(/\(\s*\d{1,3}\s*(?:packs?|boxes|cards)\s*(?:per\s*(?:box|case|pack))?\s*\)/gi, " ").replace(/\b\d{1,3}\s*(?:packs?|cards)\s*per\s*(?:box|pack|case)\b/gi, " ").replace(/\b\d{1,2}\s*boxes\s*per\s*case\b|\(\s*\d{1,2}\s*boxes\s*\)/gi, " ").replace(/\bcase\s*[-–:,]?\s*\d{1,2}\s*(?:hobby\s+|jumbo\s+)?boxes\b/gi, "case "))) return "multiple"; // "Hobby Case 12 Boxes": the case's own contents
  if (RETAIL_EDITION.test(t)) return "retail-edition";
  if (opts.strict && !/\btopps\b|\bbowman\b|\bpanini\b|\bdonruss\b|\bupper\s*deck\b|\bselect\b|\bfutera\b|\btap\s*'?n'?\s*play\b/i.test(t)) return "not-sports";

  const r = readRelease(t);
  if (typeof r !== "object") return r === "two-years" || r === "two-sports" || r === "two-competitions" ? "vague" : "no-set";
  if (VARIANT.test(t.replace(r.line.re, " "))) return "vague";
  const stickers = STICKER_LINES.has(r.line.key);
  if (!stickers && /\balbums?\b|\bstickers?\b/i.test(t)) return "accessory";
  const type = readType(t, r.line.key);
  if (!type) return "unclassified";
  const info = TYPE_BY_KEY.get(type)!;
  const set = releaseFor(r);
  const editions = EDITIONS.filter((e) => e.re.test(t));
  if (editions.length > 1) return "vague";
  const edition = editions[0];
  const label = edition ? `${edition.label} ${info.label}` : info.label;
  const name = `${set.name} ${label}`;
  return {
    groupKey: `${set.code}|${type}${edition ? `|${edition.key}` : ""}`,
    type,
    typeLabel: info.label,
    set,
    name,
    slugBase: slugify(name),
  };
}

/** The fixed name of a curated product key, or null. None yet; the importer calls it on full runs. */
export function canonicalName(groupKey: string): string | null {
  void groupKey;
  return null;
}

export function isIdentity(x: SealedIdentity | Rejection): x is SealedIdentity {
  return typeof x === "object";
}
