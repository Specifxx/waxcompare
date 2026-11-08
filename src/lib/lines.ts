// The product lines SportsCardCompare reads in a store title: maker, line, and which sports the line is sold in.
//
// A release is (year or season, line, sport, competition): "2025 Topps Chrome Baseball", "2024-25 Panini Prizm Basketball",
// "2024-25 Topps Chrome UEFA Club Competitions". The line is the part that repeats every year, so this list is short and stable,
// while the releases themselves are found in store titles by the import (lib/sets.ts, data/sets/releases.json).
//
// Refuse rather than guess: a title is a product only when its line, its sport and its year are all read without doubt.
// Longest pattern first ("Bowman Chrome" before "Bowman", "Donruss Optic" before "Donruss", "Chrome Update" before "Chrome").
// A line whose name is an everyday word ("Select", "Score", "Update", "Heritage", "Ice") is read only when the title also names
// its maker (`needsMaker`).
//
// ADDING A LINE: add a row, then a real store title for it in tests/sealed-title.test.ts. Never widen a pattern to catch a store's
// typo: a wrong merge puts one box's price on another box's page.

export type Sport =
  | "baseball"
  | "basketball"
  | "wnba"
  | "football"
  | "soccer"
  | "hockey"
  | "f1"
  | "racing"
  | "ufc"
  | "wrestling"
  | "nrl"
  | "afl"
  | "cricket"
  | "golf"
  | "tennis"
  | "multi";

export interface SportInfo {
  key: Sport;
  label: string; // as it reads in a product name: "2025 Topps Chrome Baseball"
  slug: string; // /<region>/sport/<slug>
  /** Sold by season ("2024-25") rather than by calendar year. */
  season: boolean;
}

export const SPORTS: SportInfo[] = [
  { key: "baseball", label: "Baseball", slug: "baseball", season: false },
  { key: "basketball", label: "Basketball", slug: "basketball", season: true },
  { key: "football", label: "Football", slug: "football", season: false },
  { key: "soccer", label: "Soccer", slug: "soccer", season: true },
  { key: "hockey", label: "Hockey", slug: "hockey", season: true },
  { key: "f1", label: "Formula 1", slug: "formula-1", season: false },
  { key: "ufc", label: "UFC", slug: "ufc", season: false },
  { key: "wrestling", label: "WWE", slug: "wrestling", season: false },
  { key: "wnba", label: "WNBA", slug: "wnba", season: false },
  { key: "nrl", label: "NRL", slug: "nrl", season: false },
  { key: "afl", label: "AFL", slug: "afl", season: false },
  { key: "cricket", label: "Cricket", slug: "cricket", season: false },
  { key: "racing", label: "Racing", slug: "racing", season: false },
  { key: "golf", label: "Golf", slug: "golf", season: false },
  { key: "tennis", label: "Tennis", slug: "tennis", season: false },
  { key: "multi", label: "Multi-Sport", slug: "multi-sport", season: false },
];
export const SPORT_BY_KEY = new Map(SPORTS.map((s) => [s.key, s]));
export const SPORT_BY_SLUG = new Map(SPORTS.map((s) => [s.slug, s]));

/** Soccer products are one per competition: a Premier League box and a UEFA box of the same line are two products. */
export interface Competition {
  key: string;
  label: string;
  re: RegExp;
}
// Longest first. "UEFA Women's Champions League" before "UEFA", "Club World Cup" before "World Cup".
export const COMPETITIONS: Competition[] = [
  { key: "uwcl", label: "UEFA Women's Champions League", re: /\bwomen'?s\s*champions\s*league\b|\buwcl\b|\buefa\s*women'?s\b/i },
  { key: "club-world-cup", label: "FIFA Club World Cup", re: /\bclub\s*world\s*cup\b/i },
  { key: "uefa", label: "UEFA Club Competitions", re: /\buefa\b|\bchampions\s*league\b|\bclub\s*competitions?\b|\bucc\b/i },
  { key: "premier-league", label: "Premier League", re: /\bpremier\s*league\b|\bepl\b/i },
  { key: "mls", label: "MLS", re: /\bmls\b|\bmajor\s*league\s*soccer\b/i },
  { key: "bundesliga", label: "Bundesliga", re: /\bbundesliga\b/i },
  { key: "laliga", label: "LaLiga", re: /\bla\s*liga\b/i },
  { key: "serie-a", label: "Serie A", re: /\bserie\s*a\b/i },
  { key: "spl", label: "Scottish Premiership", re: /\bscottish\s*premiership\b|\bspfl\b/i },
  { key: "world-cup", label: "World Cup", re: /\bworld\s*cup\b/i },
  { key: "euro", label: "Euro", re: /\beuro\s*(?:20\d\d|championship)\b|\buefa\s*euro\b/i },
];

export interface Line {
  key: string;
  maker: "Topps" | "Panini" | "Upper Deck" | "Leaf" | "Select" | "Futera";
  /** As it reads in a product name, maker included where buyers say it: "Topps Chrome", "Bowman Chrome", "Panini Prizm". */
  display: string;
  re: RegExp;
  sports: Sport[];
  /** The sport when the title names none (Merlin is always soccer). Only for lines sold in one sport. */
  defaultSport?: Sport;
  /** For soccer lines sold in one competition only (Merlin: UEFA). */
  defaultCompetition?: string;
  needsMaker?: boolean;
  /** Named sport first: "2026 NRL Traders", "2025 AFL Footy Stars" (the Australian makers' own wording). */
  sportFirst?: boolean;
}

const MAKER_RE: Record<Line["maker"], RegExp> = {
  Topps: /\btopps\b|\bbowman\b/i,
  Panini: /\bpanini\b/i,
  "Upper Deck": /\bupper\s*deck\b|\bud\b/i,
  Leaf: /\bleaf\b/i,
  Select: /\bselect\s*(?:cards|australia)\b|\btap\s*'?n'?\s*play\b|\bselect\b/i,
  Futera: /\bfutera\b/i,
};

export function namesMaker(line: Line, title: string): boolean {
  return MAKER_RE[line.maker].test(title);
}

const US4: Sport[] = ["baseball", "basketball", "football", "hockey"];
const BB: Sport[] = ["basketball"];
const FB: Sport[] = ["football"];
const MLB: Sport[] = ["baseball"];
const NHL: Sport[] = ["hockey"];

// Order is by pattern specificity: the first line whose pattern matches wins, so a longer name comes first.
export const LINES: Line[] = [
  // ── Sticker collections first: a sticker title can also carry a card line's word ──
  { key: "panini-stickers", maker: "Panini", display: "Panini Stickers", re: /\bpanini\b(?=.*\bstickers?\b)/i, sports: ["soccer"], defaultSport: "soccer" },
  { key: "topps-stickers", maker: "Topps", display: "Topps Stickers", re: /\btopps\b(?=.*\bstickers?\b)/i, sports: ["soccer"], defaultSport: "soccer" },
  // ── Topps / Bowman ─────────────────────────────────────────────────────────
  { key: "bowman-chrome-university", maker: "Topps", display: "Bowman Chrome University", re: /\bbowman\s*(?:u\s*chrome|chrome\s*(?:university|u)\b)/i, sports: ["football", "basketball"] },
  { key: "bowman-university", maker: "Topps", display: "Bowman University", re: /\bbowman\s*(?:university|u)\b(?!\s*chrome)/i, sports: ["football", "basketball"] },
  { key: "bowman-chrome-sapphire", maker: "Topps", display: "Bowman Chrome Sapphire", re: /\bbowman\s*chrome\s*sapphire\b/i, sports: MLB },
  { key: "bowman-draft", maker: "Topps", display: "Bowman Draft", re: /\bbowman\s*(?:chrome\s*)?draft\b/i, sports: MLB, defaultSport: "baseball" },
  { key: "bowman-chrome", maker: "Topps", display: "Bowman Chrome", re: /\bbowman\s*chrome\b/i, sports: MLB, defaultSport: "baseball" },
  { key: "bowmans-best", maker: "Topps", display: "Bowman's Best", re: /\bbowman'?s?\s*best\b/i, sports: MLB, defaultSport: "baseball" },
  { key: "bowman-sterling", maker: "Topps", display: "Bowman Sterling", re: /\bbowman\s*sterling\b/i, sports: MLB, defaultSport: "baseball" },
  { key: "bowman-inception", maker: "Topps", display: "Bowman Inception", re: /\bbowman\s*inception\b/i, sports: MLB, defaultSport: "baseball" },
  { key: "bowman-platinum", maker: "Topps", display: "Bowman Platinum", re: /\bbowman\s*platinum\b/i, sports: MLB, defaultSport: "baseball" },
  { key: "bowman", maker: "Topps", display: "Bowman", re: /\bbowman\b(?!\s*(?:chrome|draft|'?s?\s*best|sterling|inception|platinum|university|u\b))/i, sports: MLB, defaultSport: "baseball" },
  { key: "chrome-sapphire", maker: "Topps", display: "Topps Chrome Sapphire", re: /\btopps\s*chrome\s*sapphire\b|\bchrome\s*sapphire\s*edition\b/i, sports: ["baseball", "basketball", "soccer", "f1"] },
  { key: "chrome-black", maker: "Topps", display: "Topps Chrome Black", re: /\btopps\s*chrome\s*black\b|\bchrome\s*black\b/i, sports: ["baseball", "basketball"] },
  { key: "chrome-platinum", maker: "Topps", display: "Topps Chrome Platinum Anniversary", re: /\bchrome\s*platinum\b/i, sports: MLB, defaultSport: "baseball" },
  { key: "chrome-update", maker: "Topps", display: "Topps Chrome Update", re: /\bchrome\s*update\b|\bupdate\s*(?:series\s*)?chrome\b/i, sports: ["baseball", "basketball"], defaultSport: "baseball" },
  { key: "cosmic-chrome", maker: "Topps", display: "Topps Cosmic Chrome", re: /\bcosmic\s*chrome\b/i, sports: ["baseball", "basketball", "football", "soccer", "f1"] },
  { key: "chrome-logofractor", maker: "Topps", display: "Topps Chrome Logofractor", re: /\blogofractor\b/i, sports: ["baseball", "soccer", "f1"] },
  { key: "merlin", maker: "Topps", display: "Topps Merlin", re: /\bmerlin\b/i, sports: ["soccer"], defaultSport: "soccer", defaultCompetition: "uefa" },
  { key: "match-attax", maker: "Topps", display: "Topps Match Attax", re: /\bmatch\s*attax\b/i, sports: ["soccer"], defaultSport: "soccer" },
  { key: "turbo-attax", maker: "Topps", display: "Topps Turbo Attax", re: /\bturbo\s*attax\b/i, sports: ["f1"], defaultSport: "f1" },
  { key: "midnight", maker: "Topps", display: "Topps Midnight", re: /\btopps\s*midnight\b|\bmidnight\b(?=.*\btopps\b)/i, sports: ["basketball", "soccer", "football"] },
  { key: "topps-holiday", maker: "Topps", display: "Topps Holiday", re: /\bholiday\b/i, sports: ["baseball", "basketball", "football", "soccer"], needsMaker: true },
  { key: "signature-class", maker: "Topps", display: "Topps Signature Class", re: /\bsignature\s*class\b/i, sports: ["basketball", "football"], needsMaker: true },
  { key: "resurgence", maker: "Topps", display: "Topps Resurgence", re: /\bresurgence\b/i, sports: FB, defaultSport: "football", needsMaker: true },
  { key: "pro-debut", maker: "Topps", display: "Topps Pro Debut", re: /\bpro\s*debut\b/i, sports: MLB, defaultSport: "baseball", needsMaker: true },
  { key: "topps-hoops", maker: "Topps", display: "Topps Hoops", re: /\bhoops\b/i, sports: BB, defaultSport: "basketball", needsMaker: true },
  { key: "chrome", maker: "Topps", display: "Topps Chrome", re: /\bchrome\b(?!\s*(?:sapphire|black|platinum|update|university|u\b|draft))/i, sports: ["baseball", "basketball", "football", "soccer", "f1", "ufc", "wrestling", "racing", "cricket", "tennis"] },
  { key: "heritage-high-number", maker: "Topps", display: "Topps Heritage High Number", re: /\bheritage\s*high\s*(?:number|#)\b/i, sports: MLB, defaultSport: "baseball" },
  { key: "heritage", maker: "Topps", display: "Topps Heritage", re: /\bheritage\b(?!\s*high)/i, sports: ["baseball", "football"], defaultSport: "baseball", needsMaker: true },
  { key: "stadium-club", maker: "Topps", display: "Topps Stadium Club", re: /\bstadium\s*club\b/i, sports: ["baseball", "basketball", "football", "soccer", "ufc"] },
  { key: "finest", maker: "Topps", display: "Topps Finest", re: /\bfinest\b/i, sports: ["baseball", "basketball", "football", "soccer", "f1"], needsMaker: true },
  { key: "allen-ginter", maker: "Topps", display: "Topps Allen & Ginter", re: /\ballen\s*(?:&|and)?\s*ginter\b/i, sports: ["baseball", "multi"], defaultSport: "baseball" },
  { key: "gypsy-queen", maker: "Topps", display: "Topps Gypsy Queen", re: /\bgypsy\s*queen\b/i, sports: MLB, defaultSport: "baseball" },
  { key: "archives-signature", maker: "Topps", display: "Topps Archives Signature Series", re: /\barchives\s*signature\b/i, sports: MLB, defaultSport: "baseball" },
  { key: "archives", maker: "Topps", display: "Topps Archives", re: /\barchives\b(?!\s*signature)/i, sports: MLB, defaultSport: "baseball", needsMaker: true },
  { key: "big-league", maker: "Topps", display: "Topps Big League", re: /\bbig\s*league\b/i, sports: MLB, defaultSport: "baseball", needsMaker: true },
  { key: "tier-one", maker: "Topps", display: "Topps Tier One", re: /\btier\s*one\b/i, sports: MLB, defaultSport: "baseball" },
  { key: "museum-collection", maker: "Topps", display: "Topps Museum Collection", re: /\bmuseum\s*collection\b/i, sports: ["baseball", "soccer"] },
  { key: "five-star", maker: "Topps", display: "Topps Five Star", re: /\bfive\s*star\b/i, sports: MLB, defaultSport: "baseball", needsMaker: true },
  { key: "triple-threads", maker: "Topps", display: "Topps Triple Threads", re: /\btriple\s*threads\b/i, sports: MLB, defaultSport: "baseball" },
  { key: "tribute", maker: "Topps", display: "Topps Tribute", re: /\btribute\b/i, sports: MLB, defaultSport: "baseball", needsMaker: true },
  { key: "dynasty", maker: "Topps", display: "Topps Dynasty", re: /\bdynasty\b/i, sports: ["baseball", "f1", "soccer"], needsMaker: true },
  { key: "definitive", maker: "Topps", display: "Topps Definitive", re: /\bdefinitive\s*collection\b|\bdefinitive\b/i, sports: MLB, defaultSport: "baseball", needsMaker: true },
  { key: "gold-label", maker: "Topps", display: "Topps Gold Label", re: /\bgold\s*label\b/i, sports: ["baseball", "soccer"], needsMaker: true },
  { key: "inception", maker: "Topps", display: "Topps Inception", re: /\binception\b/i, sports: ["baseball", "basketball", "football", "soccer"], needsMaker: true },
  { key: "opening-day", maker: "Topps", display: "Topps Opening Day", re: /\bopening\s*day\b/i, sports: MLB, defaultSport: "baseball" },
  { key: "pristine", maker: "Topps", display: "Topps Pristine", re: /\bpristine\b/i, sports: ["baseball", "soccer"], needsMaker: true },
  { key: "update", maker: "Topps", display: "Topps Update", re: /\bupdate\s*series\b|\bupdate\b/i, sports: MLB, defaultSport: "baseball", needsMaker: true },
  { key: "series-2", maker: "Topps", display: "Topps Series 2", re: /\bseries\s*(?:2|two|ii)\b/i, sports: MLB, defaultSport: "baseball" },
  { key: "series-1", maker: "Topps", display: "Topps Series 1", re: /\bseries\s*(?:1|one|i)\b/i, sports: MLB, defaultSport: "baseball" },
  { key: "topps-f1", maker: "Topps", display: "Topps Formula 1", re: /\btopps\s*(?:f1|formula\s*(?:1|one))\b/i, sports: ["f1"], defaultSport: "f1" },
  { key: "topps-flagship", maker: "Topps", display: "Topps", re: /\btopps\s*(?:flagship|baseball|basketball|football|premier\s*league|uefa|ufc|wwe)\b/i, sports: ["baseball", "basketball", "football", "soccer", "ufc", "wrestling"] },

  // ── Panini ──────────────────────────────────────────────────────────────────
  { key: "prizm-draft-picks", maker: "Panini", display: "Panini Prizm Draft Picks", re: /\bprizm\s*draft\s*picks?\b/i, sports: ["basketball", "football"] },
  { key: "prizm-monopoly", maker: "Panini", display: "Panini Prizm Monopoly", re: /\bprizm\s*monopoly\b/i, sports: ["basketball", "wnba", "football", "soccer"] },
  { key: "prizm", maker: "Panini", display: "Panini Prizm", re: /\bprizm\b/i, sports: ["basketball", "wnba", "football", "baseball", "soccer", "f1", "ufc", "wrestling", "racing", "golf", "multi"] },
  { key: "donruss-optic", maker: "Panini", display: "Donruss Optic", re: /\b(?:donruss\s*)?optic\b/i, sports: ["basketball", "football", "baseball", "soccer"] },
  { key: "donruss-elite", maker: "Panini", display: "Donruss Elite", re: /\bdonruss\s*elite\b/i, sports: ["football", "basketball", "baseball"] },
  { key: "donruss", maker: "Panini", display: "Donruss", re: /\bdonruss\b(?!\s*(?:optic|elite))/i, sports: ["basketball", "wnba", "football", "baseball", "soccer", "racing", "ufc"] },
  { key: "mosaic", maker: "Panini", display: "Panini Mosaic", re: /\bmosaic\b/i, sports: ["basketball", "football", "soccer", "racing"] },
  { key: "select", maker: "Panini", display: "Panini Select", re: /\bselect\b/i, sports: ["basketball", "wnba", "football", "baseball", "soccer", "ufc", "wrestling", "racing"], needsMaker: true },
  { key: "national-treasures", maker: "Panini", display: "Panini National Treasures", re: /\bnational\s*treasures\b/i, sports: ["basketball", "football", "baseball", "soccer", "wrestling"] },
  { key: "immaculate", maker: "Panini", display: "Panini Immaculate", re: /\bimmaculate\b/i, sports: ["basketball", "football", "baseball", "soccer"] },
  { key: "flawless", maker: "Panini", display: "Panini Flawless", re: /\bflawless\b/i, sports: ["basketball", "football", "baseball", "soccer"] },
  { key: "contenders-optic", maker: "Panini", display: "Panini Contenders Optic", re: /\bcontenders\s*optic\b/i, sports: ["basketball", "football"] },
  { key: "contenders", maker: "Panini", display: "Panini Contenders", re: /\bcontenders\b(?!\s*optic)/i, sports: ["basketball", "football"] },
  { key: "chronicles", maker: "Panini", display: "Panini Chronicles", re: /\bchronicles\b/i, sports: ["basketball", "wnba", "football", "baseball", "soccer", "ufc", "wrestling"] },
  { key: "phoenix", maker: "Panini", display: "Panini Phoenix", re: /\bphoenix\b/i, sports: ["basketball", "football"], needsMaker: true },
  { key: "absolute", maker: "Panini", display: "Panini Absolute", re: /\babsolute\b/i, sports: ["football"], needsMaker: true },
  { key: "prestige", maker: "Panini", display: "Panini Prestige", re: /\bprestige\b/i, sports: ["football"], needsMaker: true },
  { key: "score", maker: "Panini", display: "Panini Score", re: /\bscore\b/i, sports: ["football", "soccer"], needsMaker: true },
  { key: "rookies-stars", maker: "Panini", display: "Panini Rookies & Stars", re: /\brookies\s*(?:and|&)?\s*(?:football\s*)?stars\b/i, sports: FB, defaultSport: "football", needsMaker: true },
  { key: "panini-black", maker: "Panini", display: "Panini Black", re: /\bpanini\s*black\b/i, sports: ["football", "basketball"] },
  { key: "flux", maker: "Panini", display: "Panini Flux", re: /\bflux\b/i, sports: ["basketball", "football", "soccer"], needsMaker: true },
  { key: "prospect-edition", maker: "Panini", display: "Panini Prospect Edition", re: /\bprospect\s*edition\b/i, sports: MLB, defaultSport: "baseball", needsMaker: true },
  { key: "boys-of-summer", maker: "Panini", display: "Panini Boys of Summer", re: /\bboys\s*of\s*summer\b/i, sports: MLB, defaultSport: "baseball", needsMaker: true },
  { key: "silhouette", maker: "Panini", display: "Panini Silhouette", re: /\bsilhouette\b/i, sports: FB, defaultSport: "football", needsMaker: true },
  { key: "photogenic", maker: "Panini", display: "Panini Photogenic", re: /\bphotogenic\b/i, sports: FB, defaultSport: "football", needsMaker: true },
  { key: "turn-four", maker: "Panini", display: "Panini Turn Four", re: /\bturn\s*four\b/i, sports: ["racing"], defaultSport: "racing", needsMaker: true },
  { key: "track-kings", maker: "Panini", display: "Panini Track Kings", re: /\btrack\s*kings\b/i, sports: ["racing"], defaultSport: "racing", needsMaker: true },
  { key: "pitch-kings", maker: "Panini", display: "Panini Pitch Kings", re: /\bpitch\s*kings\b/i, sports: ["soccer"], defaultSport: "soccer", needsMaker: true },
  { key: "hoops", maker: "Panini", display: "Panini NBA Hoops", re: /\bhoops\b/i, sports: BB, defaultSport: "basketball" },
  { key: "court-kings", maker: "Panini", display: "Panini Court Kings", re: /\bcourt\s*kings\b/i, sports: BB, defaultSport: "basketball" },
  { key: "revolution", maker: "Panini", display: "Panini Revolution", re: /\brevolution\b/i, sports: ["basketball", "wnba", "football", "soccer"], needsMaker: true },
  { key: "spectra", maker: "Panini", display: "Panini Spectra", re: /\bspectra\b/i, sports: ["basketball", "football", "soccer"] },
  { key: "obsidian", maker: "Panini", display: "Panini Obsidian", re: /\bobsidian\b/i, sports: ["basketball", "football", "soccer"] },
  { key: "noir", maker: "Panini", display: "Panini Noir", re: /\bnoir\b/i, sports: ["basketball", "football"], needsMaker: true },
  { key: "origins", maker: "Panini", display: "Panini Origins", re: /\borigins\b/i, sports: ["basketball", "football"], needsMaker: true },
  { key: "certified", maker: "Panini", display: "Panini Certified", re: /\bcertified\b/i, sports: ["football"], needsMaker: true },
  { key: "zenith", maker: "Panini", display: "Panini Zenith", re: /\bzenith\b/i, sports: ["football"], needsMaker: true },
  { key: "illusions", maker: "Panini", display: "Panini Illusions", re: /\billusions\b/i, sports: ["football"], needsMaker: true },
  { key: "luminance", maker: "Panini", display: "Panini Luminance", re: /\bluminance\b/i, sports: ["football"], needsMaker: true },
  { key: "playbook", maker: "Panini", display: "Panini Playbook", re: /\bplaybook\b/i, sports: ["football"], needsMaker: true },
  { key: "crown-royale", maker: "Panini", display: "Panini Crown Royale", re: /\bcrown\s*royale\b/i, sports: ["basketball", "football"] },
  { key: "eminence", maker: "Panini", display: "Panini Eminence", re: /\beminence\b/i, sports: ["basketball", "football"], needsMaker: true },
  { key: "one-and-one", maker: "Panini", display: "Panini One and One", re: /\bone\s*(?:and|&)\s*one\b/i, sports: ["basketball", "football"], needsMaker: true },
  { key: "impeccable", maker: "Panini", display: "Panini Impeccable", re: /\bimpeccable\b/i, sports: ["basketball", "football", "soccer"], needsMaker: true },
  { key: "adrenalyn", maker: "Panini", display: "Panini Adrenalyn XL", re: /\badrenalyn\b/i, sports: ["soccer"], defaultSport: "soccer" },

  // ── Leaf ────────────────────────────────────────────────────────────────────
  { key: "leaf-metal-draft", maker: "Leaf", display: "Leaf Metal Draft", re: /\bleaf\s*metal\s*draft\b/i, sports: ["baseball", "football", "basketball"] },
  { key: "leaf-metal", maker: "Leaf", display: "Leaf Metal", re: /\bleaf\s*metal\b(?!\s*draft)/i, sports: ["baseball", "football", "basketball", "multi"] },
  { key: "leaf-trinity", maker: "Leaf", display: "Leaf Trinity", re: /\bleaf\s*trinity\b/i, sports: ["baseball", "football", "basketball", "multi"] },
  { key: "leaf-vivid", maker: "Leaf", display: "Leaf Vivid", re: /\bleaf\s*vivid\b/i, sports: ["baseball", "football", "basketball", "multi"] },
  { key: "leaf-optichrome", maker: "Leaf", display: "Leaf Optichrome", re: /\boptichrome\b/i, sports: ["baseball", "football", "basketball", "multi"] },

  // ── Upper Deck ──────────────────────────────────────────────────────────────
  { key: "ud-extended", maker: "Upper Deck", display: "Upper Deck Extended Series", re: /\bextended\b/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "ud-series-2", maker: "Upper Deck", display: "Upper Deck Series 2", re: /\bseries\s*(?:2|two|ii)\b/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "ud-series-1", maker: "Upper Deck", display: "Upper Deck Series 1", re: /\bseries\s*(?:1|one|i)\b/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "opc-platinum", maker: "Upper Deck", display: "O-Pee-Chee Platinum", re: /\bo\s*-?\s*pee\s*-?\s*chee\s*platinum\b|\bopc\s*platinum\b/i, sports: NHL, defaultSport: "hockey" },
  { key: "opc", maker: "Upper Deck", display: "O-Pee-Chee", re: /\bo\s*-?\s*pee\s*-?\s*chee\b(?!\s*platinum)|\bopc\b(?!\s*platinum)/i, sports: NHL, defaultSport: "hockey" },
  { key: "sp-authentic", maker: "Upper Deck", display: "SP Authentic", re: /\bsp\s*authentic\b/i, sports: ["hockey", "football"], defaultSport: "hockey" },
  { key: "sp-game-used", maker: "Upper Deck", display: "SP Game Used", re: /\bsp\s*game\s*used\b/i, sports: NHL, defaultSport: "hockey" },
  { key: "spx", maker: "Upper Deck", display: "SPx", re: /\bspx\b/i, sports: NHL, defaultSport: "hockey" },
  { key: "ud-sp", maker: "Upper Deck", display: "Upper Deck SP", re: /\bsp\b(?!\s*(?:authentic|game|x\b))/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "ud-metal-universe", maker: "Upper Deck", display: "Skybox Metal Universe", re: /\bmetal\s*universe\b/i, sports: NHL, defaultSport: "hockey" },
  { key: "ud-team-canada", maker: "Upper Deck", display: "Upper Deck Team Canada", re: /\bteam\s*canada\b/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "ud-clear-cut", maker: "Upper Deck", display: "Upper Deck Clear Cut", re: /\bclear\s*cut\b/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "ud-stature", maker: "Upper Deck", display: "Upper Deck Stature", re: /\bstature\b/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "ud-chl", maker: "Upper Deck", display: "Upper Deck CHL", re: /\bchl\b/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "ud-ahl", maker: "Upper Deck", display: "Upper Deck AHL", re: /\bahl\b/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "ud-pwhl", maker: "Upper Deck", display: "Upper Deck PWHL", re: /\bpwhl\b/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "the-cup", maker: "Upper Deck", display: "The Cup", re: /\bthe\s*cup\b/i, sports: NHL, defaultSport: "hockey" },
  { key: "ultimate-collection", maker: "Upper Deck", display: "Ultimate Collection", re: /\bultimate\s*collection\b/i, sports: NHL, defaultSport: "hockey" },
  { key: "ud-premier", maker: "Upper Deck", display: "Upper Deck Premier", re: /\bpremier\b(?!\s*league)/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "ud-ice", maker: "Upper Deck", display: "Upper Deck Ice", re: /\bice\b(?!\s*hockey)/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "ud-artifacts", maker: "Upper Deck", display: "Upper Deck Artifacts", re: /\bartifacts\b/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "ud-trilogy", maker: "Upper Deck", display: "Upper Deck Trilogy", re: /\btrilogy\b/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "ud-black-diamond", maker: "Upper Deck", display: "Upper Deck Black Diamond", re: /\bblack\s*diamond\b/i, sports: NHL, defaultSport: "hockey" },
  { key: "ud-mvp", maker: "Upper Deck", display: "Upper Deck MVP", re: /\bmvp\b/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "ud-allure", maker: "Upper Deck", display: "Upper Deck Allure", re: /\ballure\b/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "ud-synergy", maker: "Upper Deck", display: "Upper Deck Synergy", re: /\bsynergy\b/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "ud-credentials", maker: "Upper Deck", display: "Upper Deck Credentials", re: /\bcredentials\b/i, sports: NHL, defaultSport: "hockey", needsMaker: true },
  { key: "ud-tim-hortons", maker: "Upper Deck", display: "Upper Deck Tim Hortons", re: /\btim\s*horton'?s\b/i, sports: NHL, defaultSport: "hockey" },
  { key: "parkhurst", maker: "Upper Deck", display: "Parkhurst", re: /\bparkhurst\b/i, sports: NHL, defaultSport: "hockey" },
  { key: "goodwin-champions", maker: "Upper Deck", display: "Goodwin Champions", re: /\bgoodwin\s*champions\b/i, sports: ["multi"], defaultSport: "multi" },
  { key: "ud-aew", maker: "Upper Deck", display: "Upper Deck AEW", re: /\bupper\s*deck\s*aew\b|\baew\b.*\bupper\s*deck\b/i, sports: ["wrestling"], defaultSport: "wrestling" },

  // ── Australia: Select Cards (Tap'n'Play) and Futera ─────────────────────────
  { key: "nrl-traders", maker: "Select", display: "Traders", sportFirst: true, re: /\btraders\b/i, sports: ["nrl", "afl"] },
  { key: "nrl-elite", maker: "Select", display: "Elite", sportFirst: true, re: /\belite\b(?!.*\bdonruss\b)/i, sports: ["nrl"] },
  { key: "league-heroes", maker: "Select", display: "League Heroes", sportFirst: true, re: /\bleague\s*heroes\b/i, sports: ["nrl"], defaultSport: "nrl" },
  { key: "footy-stars", maker: "Select", display: "Footy Stars", sportFirst: true, re: /\bfooty\s*stars\b/i, sports: ["afl"], defaultSport: "afl" },
  { key: "afl-optimum", maker: "Select", display: "Optimum", sportFirst: true, re: /\boptimum\b/i, sports: ["afl", "nrl"] },
  { key: "afl-legacy", maker: "Select", display: "Legacy", sportFirst: true, re: /\blegacy\b/i, sports: ["afl", "nrl"], needsMaker: true },
  { key: "afl-dominance", maker: "Select", display: "Dominance", sportFirst: true, re: /\bdominance\b/i, sports: ["afl", "nrl"] },
  { key: "afl-supremacy", maker: "Select", display: "Supremacy", sportFirst: true, re: /\bsupremacy\b/i, sports: ["afl", "nrl"] },
];

/** Lines the US four sports share: kept for the sport hub's "lines in this sport" lists. */
export const US_SPORTS = US4;
