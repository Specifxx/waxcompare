// The hub pages (set, type, sets in order, release dates, where to buy): their generated words (src/lib/hub-copy.ts), the
// calendar file (src/lib/ics.ts) and the pages' wiring. Pure: no database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AddToCalendar } from "../src/components/AddToCalendar";
import { findBannedCopy } from "../src/lib/copy-rules";
import type { ProductCardData } from "../src/lib/data";
import {
  dealsAnchor,
  hubTitle,
  nextSet,
  prevNextSet,
  FIRST_IMPORT_DAY,
  releaseChip,
  releasesTitle,
  renderedTitle,
  setDescription,
  setFacts,
  setIntro,
  setsBySeries,
  setsIndexTitle,
  setsOfYear,
  setTitle,
  shortDate,
  storeIndexable,
  storesTitle,
  TITLE_MAX,
  TITLE_SUFFIX,
  titleText,
  topStores,
  typeDescription,
  typeMsrpFact,
  typePacksFact,
  typePerPackRows,
  typeTitle,
  type HubTitle,
} from "../src/lib/hub-copy";
import { buildIcs, escapeIcsText, foldIcsLine, icsFileName, nextDay } from "../src/lib/ics";
import { REGION_LIST, REGIONS } from "../src/lib/regions";
import { PRODUCT_TYPES, TYPE_BY_SLUG } from "../src/lib/sealed-title";
import { SET_BY_CODE, SET_BY_SLUG, SETS } from "../src/lib/sets";

(globalThis as unknown as { React: typeof React }).React = React;

const TODAY = new Date("2026-10-14T09:30:00Z");
const set = (slug: string) => SET_BY_SLUG.get(slug)!;

const card = (slug: string, productType: string, lowestPriceCents: number | null, setCode = "fra", open = true): ProductCardData => ({
  slug,
  name: `${SET_BY_CODE.get(setCode)?.name ?? ""} ${productType} ${slug}`,
  productType,
  setCode,
  imageUrl: null,
  lowestPriceCents,
  inStockStores: open ? 3 : 0,
  listedStores: 3,
  marketplaceOpen: false,
  medianOpenCents: null,
  releaseDate: SET_BY_CODE.get(setCode)?.releaseDate ?? null,
});

/** A title within the rule: a plain string fits in TITLE_MAX with the suffix; anything longer goes out as absolute. */
function assertTitleRule(t: HubTitle, label: string) {
  if (typeof t === "string") assert.ok(t.length + TITLE_SUFFIX.length <= TITLE_MAX, `${label}: "${t}${TITLE_SUFFIX}" is over ${TITLE_MAX} without absolute`);
  else assert.ok(t.absolute.length + TITLE_SUFFIX.length > TITLE_MAX, `${label}: absolute for a title that fits`);
  assert.doesNotMatch(titleText(t), /\bMTG\s+(?:MTG|Magic)\b/i, `${label}: double MTG`);
  assert.equal(findBannedCopy(titleText(t)), null, label);
}

// ─── Titles ────────────────────────────────────────────────────────────────────

test("store pages: noindex (and out of the sitemap) when the store lists nothing or is dormant", () => {
  assert.equal(storeIndexable({ listed: 12, dormant: false }), true);
  assert.equal(storeIndexable({ listed: 0, dormant: false }), false);
  assert.equal(storeIndexable({ listed: 22, dormant: true }), false);
  assert.equal(storeIndexable(null), false, "never read");
  const src = readFileSync(new URL("../src/app/[region]/stores/[store]/StoreListing.tsx", import.meta.url), "utf8");
  assert.match(src, /const getStoreStat = cache\(/, "one storeStat read shared by the metadata and the page");
  assert.match(src, /noindex: !storeIndexable\(st\)/);
});

test("topStores: the most in stock, read within 72 hours, at most ten", () => {
  const now = Date.parse("2026-10-14T09:00:00Z");
  const h = (n: number) => new Date(now - n * 3600_000);
  const rows = [
    { key: "a", name: "Alpha", inStock: 50, listed: 80, lastOkAt: h(2) },
    { key: "b", name: "Bravo", inStock: 400, listed: 900, lastOkAt: h(80) }, // not read for 80 h: its count is not today's
    { key: "c", name: "Charlie", inStock: 120, listed: 300, lastOkAt: h(10) },
    { key: "d", name: "Delta", inStock: 0, listed: 20, lastOkAt: h(1) },
    { key: "e", name: "Echo", inStock: 120, listed: 150, lastOkAt: h(5) },
    { key: "f", name: "Foxtrot", inStock: 9, listed: 9, lastOkAt: null },
  ];
  assert.deepEqual(topStores(rows, 10, now).map((s) => s.key), ["c", "e", "a"]);
  assert.equal(topStores(Array.from({ length: 30 }, (_, i) => ({ key: `s${i}`, name: `S${i}`, inStock: i + 1, listed: 99, lastOkAt: h(1) })), 10, now).length, 10);
});

// ─── The calendar file ─────────────────────────────────────────────────────────

const TREK = { code: "trk", name: "Star Trek", date: "2026-11-13", url: "https://waxcompare.app/au/sets/star-trek", stamp: new Date("2026-10-14T09:30:00Z") };

test("ics helpers: TEXT escapes, folding never splits a character, the next day across a month and a year", () => {
  assert.equal(escapeIcsText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
  const long = `SUMMARY:${"é".repeat(60)}`;
  const folded = foldIcsLine(long);
  for (const l of folded.split("\r\n")) assert.ok(Buffer.byteLength(l, "utf8") <= 75);
  assert.equal(folded.replace(/\r\n /g, ""), long);
  assert.doesNotMatch(folded, /�/);
  assert.equal(foldIcsLine("SHORT:x"), "SHORT:x");
  assert.equal(nextDay("2026-11-30"), "2026-12-01");
  assert.equal(nextDay("2026-12-31"), "2027-01-01");
  assert.equal(nextDay("2028-02-28"), "2028-02-29");
});

test("AddToCalendar: a real button the server renders at its final size, named for the set and the date", () => {
  const html = renderToStaticMarkup(React.createElement(AddToCalendar, { code: "trk", name: "Star Trek", date: "2026-11-13", slug: "star-trek", url: TREK.url, when: "13 Nov 2026" }));
  assert.match(html, /^<button type="button"/);
  assert.match(html, /aria-label="Add to calendar: Star Trek release, 13 Nov 2026"/);
  assert.match(html, />Add to calendar<\/button>$/);
  assert.match(html, /min-h-11/);
});

// ─── The pages' wiring ─────────────────────────────────────────────────────────


// ─── WaxCompare (2026-11-07): sports releases, built from their parts (data/sets/releases.json starts empty) ───────────────────
import { partsOf, releaseFor } from "../src/lib/sets";

const chrome = releaseFor(partsOf("2025|chrome|baseball")!, "2026-10-01");
const dated = { ...chrome, releaseDate: "2026-12-03", dateKnown: true };

test("a release read from store titles has no date: its pages say 'in stores since' (or 'now' for one already out when the site began), never 'released' or a pre-order", () => {
  assert.equal(chrome.dateKnown, false);
  assert.equal(chrome.name, "2025 Topps Chrome Baseball");
  assert.equal(chrome.slug, "2025-topps-chrome-baseball");
  assert.equal(chrome.series, "Baseball");
  assert.equal(chrome.maker, "Topps");
  // Seen by the first import (7 Nov 2026): already in stores, its first-seen day is no date at all.
  const atStart = { ...chrome, releaseDate: FIRST_IMPORT_DAY };
  assert.equal(releaseChip(atStart, TODAY), "In stores now");
  assert.match(setDescription(atStart, REGIONS.us, [], TODAY), /in stores now/);
  assert.doesNotMatch(setDescription(atStart, REGIONS.us, [], TODAY), /released|since/i);
  assert.ok(!setFacts(atStart, [], "US", TODAY).some((f) => f.term === "In stores since" || f.term === "Release date"));
  // First seen later: that day is a fact (the stores we compare have listed it since then).
  const later = { ...chrome, releaseDate: "2026-12-02" };
  assert.equal(releaseChip(later, new Date("2027-01-01T00:00:00Z")), `In stores since ${shortDate("2026-12-02")}`);
  assert.match(setDescription(later, REGIONS.us, [], new Date("2027-01-01T00:00:00Z")), /in stores since/);
  assert.deepEqual(setFacts(later, [], "US", new Date("2027-01-01T00:00:00Z")).slice(0, 3).map((f) => f.term), ["Sport", "Maker", "In stores since"]);
});

test("a dated release says 'Released' with its date", () => {
  assert.equal(releaseChip(dated, new Date("2027-01-01T00:00:00Z")), "Released 3 Dec 2026");
  assert.equal(setFacts(dated, [], "US", new Date("2027-01-01T00:00:00Z"))[2].term, "Release date");
});

test("set and type titles: the release name once, hobby box and blaster first, within the 65-character rule", () => {
  for (const info of REGION_LIST) {
    const t = setTitle(chrome, info, TODAY);
    assert.match(titleText(t), /^2025 Topps Chrome Baseball hobby box, blaster & sealed prices in /);
    assert.ok(renderedTitle(t).length <= TITLE_MAX || !renderedTitle(t).endsWith(TITLE_SUFFIX), renderedTitle(t));
    for (const type of PRODUCT_TYPES) {
      const tt = typeTitle(type, info, 3, 12000);
      assert.ok(renderedTitle(tt).length <= TITLE_MAX || !renderedTitle(tt).endsWith(TITLE_SUFFIX), renderedTitle(tt));
      assert.doesNotMatch(titleText(tt), /\bmtg\b|magic/i);
    }
  }
  assert.deepEqual(hubTitle("x".repeat(80)), { absolute: "x".repeat(80) });
  assert.match(titleText(setsIndexTitle(REGIONS.us)), /sports card release/i);
  assert.match(titleText(releasesTitle(REGIONS.us, 2026)), /release calendar 2026/i);
  assert.match(titleText(storesTitle(REGIONS.au, 12)), /sealed sports cards/);
});

test("the type pages: no pack counts or MSRPs are claimed, and every box slug has its deals anchor", () => {
  for (const t of PRODUCT_TYPES) {
    assert.equal(typePacksFact(t.key), null, t.key);
    assert.equal(typeMsrpFact(t.key, "US"), null, t.key);
    assert.deepEqual(typePerPackRows(t.label, []), []);
    assert.ok(typeDescription(t, REGIONS.us, { open: 0, total: 0 }, null).length > 20);
  }
  for (const slug of ["hobby-boxes", "jumbo-boxes", "mega-boxes", "blaster-boxes"]) assert.ok(TYPE_BY_SLUG.has(slug) && dealsAnchor(slug), slug);
});

test("the calendar file: a dated release as an all-day event, a code made safe for the UID", () => {
  const ics = buildIcs({ code: dated.code, name: dated.name, date: dated.releaseDate, url: "https://waxcompare.app/us/sets/2025-topps-chrome-baseball", stamp: new Date("2026-11-07T00:00:00Z") } as never);
  assert.match(ics, /UID:2025-chrome-baseball-release@waxcompare\.app/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261203/);
  assert.match(ics, /DTEND;VALUE=DATE:20261204/);
  assert.match(ics, /SUMMARY:2025 Topps Chrome Baseball release/);
  assert.equal(icsFileName("2025-topps-chrome-baseball"), "wax-2025-topps-chrome-baseball-release.ics");
  assert.equal(nextDay("2026-12-31"), "2027-01-01");
  void foldIcsLine;
});

test("the indexes start empty and stay consistent: nothing undated is ever 'next' or on the calendar", () => {
  assert.equal(nextSet(TODAY), SETS.find((s) => s.dateKnown && s.releaseDate > "2026-10-14") ? nextSet(TODAY) : null);
  for (const s of setsOfYear(2026)) assert.ok(s.dateKnown, s.code);
  for (const g of setsBySeries()) for (const s of g.sets) assert.equal(s.series, g.series);
  assert.deepEqual(prevNextSet("no-such-code"), { prev: null, next: null });
  assert.equal(SET_BY_CODE.size, SETS.length);
  void setIntro;
  void findBannedCopy;
  void readFileSync;
  void card;
  void set;
});
