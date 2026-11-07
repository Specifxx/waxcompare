// Sports card RELEASES: one year (or season) of one line in one sport, e.g. "2025 Topps Chrome Baseball",
// "2024-25 Panini Prizm Basketball", "2024-25 Topps Chrome UEFA Club Competitions". The engine calls a release a "set" (URL
// /<region>/sets/<slug>), as the card sites do.
//
// RELEASES FIND THEMSELVES. A release is read from a store title by lib/sealed-title.ts (line + sport + year, and the competition for
// soccer); its code, name and slug follow from those parts alone, so two stores' titles land on one release with no list to keep.
// After each import, scripts/discover-sets.ts adds every release that 2 or more stores now sell to data/sets/releases.json, the
// list the release pages, the calendar and the sitemap read. A release's slug is fixed the day it is first written.
//
// Release dates are facts or nothing: `releaseDate` is the maker's announced street date only when `dateKnown` is true (written by
// hand in data/sets/release-dates.json, each with its source). Otherwise it is the first day our import saw the release in stores,
// used only to sort, and pages say "in stores since", never "released".
import releasesFile from "../../data/sets/releases.json";
import datesFile from "../../data/sets/release-dates.json";
import { COMPETITIONS, LINES, SPORT_BY_KEY, type Line, type Sport } from "./lines";

/** Kept for code shared with the card sites, which read booster lines. Sports releases have none. */
export type BoosterLine = "play" | "draft" | "set" | "collector" | "jumpstart";

export interface CardSet {
  code: string; // "2025|chrome|baseball" or "2024-25|chrome|soccer|uefa"
  name: string; // "2025 Topps Chrome Baseball"
  slug: string; // "2025-topps-chrome-baseball"
  /** The sport's label: what the engine's set index groups by. */
  series: string;
  sport: Sport;
  line: string; // a Line key
  maker: string;
  year: string; // "2025" or "2024-25"
  competition?: string;
  /** YYYY-MM-DD: the announced release date when dateKnown, else the first day an import saw it in stores (sort only). */
  releaseDate: string;
  dateKnown: boolean;
  logo: string | null;
  generic?: boolean;
  aliases?: string[];
  boosters?: BoosterLine[];
  noBoosterBox?: boolean;
  pattern?: string;
}
/** The card sites' name for a set; the same shape. */
export type MtgSet = CardSet;

export interface ReleaseParts {
  year: string;
  line: Line;
  sport: Sport;
  competition?: string;
}

export interface StoredRelease {
  code: string;
  name: string;
  slug: string;
  firstSeen: string; // YYYY-MM-DD
}
export interface ReleaseDate {
  code: string;
  date: string; // YYYY-MM-DD, the maker's announced street date
  source: string; // where it was read
}

function slugOf(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function releaseCode(p: ReleaseParts): string {
  return [p.year, p.line.key, p.sport, ...(p.competition ? [p.competition] : [])].join("|");
}

export function releaseName(p: ReleaseParts): string {
  const sport = SPORT_BY_KEY.get(p.sport)!.label;
  const comp = p.competition ? COMPETITIONS.find((c) => c.key === p.competition)?.label : undefined;
  if (p.line.sportFirst) return `${p.year} ${sport} ${p.line.display}`;
  if (/-stickers$/.test(p.line.key)) return `${p.year} ${p.line.maker}${comp ? ` ${comp}` : ""} Stickers`;
  // Soccer: the competition names it ("Topps Chrome UEFA Club Competitions"), not the word "Soccer".
  const tail = p.sport === "soccer" ? comp ?? "Soccer" : sport;
  // A line whose name already says the sport (Topps Formula 1, Turbo Attax) does not repeat it.
  if (p.line.display.toLowerCase().includes(tail.toLowerCase()) || (p.sport === "f1" && /formula|turbo/i.test(p.line.display))) return `${p.year} ${p.line.display}`;
  // Sticker and Adrenalyn collections are named by competition too, and are always soccer.
  return `${p.year} ${p.line.display} ${tail}`;
}

const DATES = new Map((datesFile as ReleaseDate[]).map((d) => [d.code, d]));
const STORED = releasesFile as StoredRelease[];
const STORED_BY_CODE = new Map(STORED.map((r) => [r.code, r]));
const LINE_BY_KEY = new Map(LINES.map((l) => [l.key, l]));

export function partsOf(code: string): ReleaseParts | null {
  const [year, lineKey, sport, competition] = code.split("|");
  const line = LINE_BY_KEY.get(lineKey);
  if (!year || !line || !SPORT_BY_KEY.has(sport as Sport)) return null;
  return { year, line, sport: sport as Sport, ...(competition ? { competition } : {}) };
}

/** The release for parts read from a title: the stored row's slug when there is one (slugs never change), else a fresh one. */
export function releaseFor(p: ReleaseParts, today = new Date().toISOString().slice(0, 10)): CardSet {
  const code = releaseCode(p);
  const stored = STORED_BY_CODE.get(code);
  const name = stored?.name ?? releaseName(p);
  const date = DATES.get(code);
  return {
    code,
    name,
    slug: stored?.slug ?? slugOf(name),
    series: SPORT_BY_KEY.get(p.sport)!.label,
    sport: p.sport,
    line: p.line.key,
    maker: p.line.maker,
    year: p.year,
    ...(p.competition ? { competition: p.competition } : {}),
    releaseDate: date?.date ?? stored?.firstSeen ?? today,
    dateKnown: Boolean(date),
    logo: null,
  };
}

/** Every release 2+ stores have sold, newest first. */
export const SETS: CardSet[] = STORED.map((r) => {
  const p = partsOf(r.code);
  return p ? releaseFor(p) : null;
})
  .filter((s): s is CardSet => Boolean(s))
  .sort((a, b) => b.year.localeCompare(a.year) || b.releaseDate.localeCompare(a.releaseDate) || a.name.localeCompare(b.name));

/** The stored rows alone (scripts/discover-sets.ts merges new ones into them). */
export const STORED_RELEASES: StoredRelease[] = STORED;
export const HAND_SETS: CardSet[] = SETS;

export const SET_BY_CODE = new Map(SETS.map((s) => [s.code, s]));
export const SET_BY_SLUG = new Map(SETS.map((s) => [s.slug, s]));

/** A release by its code: the discovered one (releases.json), else the one its parts make (named, undated); null for a bad code. */
export function releaseOf(code: string | null | undefined): CardSet | null {
  if (!code) return null;
  const known = SET_BY_CODE.get(code);
  if (known) return known;
  const p = partsOf(code);
  return p ? releaseFor(p) : null;
}

/** Set index grouping: by sport, in this order. */
export const SERIES_ORDER = ["Baseball", "Basketball", "Football", "Soccer", "Hockey", "Formula 1", "UFC", "WWE", "WNBA", "NRL", "AFL", "Cricket", "Racing", "Golf", "Tennis", "Multi-Sport"];
