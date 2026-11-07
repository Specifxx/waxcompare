// Search & browse: the browse index (lib/search-index.ts), the typeahead's ranking, the browse order shared by SQL and the
// browser, the recently-viewed list (components/Recent.tsx) and the query's marketplace box (components/QueryEbayBox.tsx).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AFFILIATE_NOTE, REL_SPONSORED } from "../src/lib/affiliate";
import { expandCard } from "../src/lib/compact";
import type { ProductCardData } from "../src/lib/data";
import { findBannedCopy } from "../src/lib/copy-rules";
import { REGION_LIST } from "../src/lib/regions";
import { PRODUCT_TYPES } from "../src/lib/sealed-title";
import { SETS } from "../src/lib/sets";
import {
  browseIndexResponse,
  buildIndex,
  codePointCompare,
  highlightRanges,
  isBrowseIndex,
  isBrowsePath,
  queryWords,
  rankSearch,
  relevanceCompare,
  searchCards,
  searchHref,
  searchOptions,
  SET_CODES_NEWEST_FIRST,
  TYPE_LABELS_BY_RANK,
  type BrowseIndex,
} from "../src/lib/search-index";
import { clearRecent, pushRecent, readRecent, RECENT_MAX, recentCards, recentKey, RecentlyViewed, rememberRecent, type RecentStorage } from "../src/components/Recent";
import { QueryEbayBox, shownQuery } from "../src/components/QueryEbayBox";
import { BrowseGrid } from "../src/components/BrowseGrid";
import { compactCard } from "../src/lib/compact";

// The components are compiled with the classic JSX runtime here (tsconfig "jsx": "preserve"; Next uses its own).
(globalThis as unknown as { React: typeof React }).React = React;

let n = 0;
function card(over: Partial<ProductCardData> & Pick<ProductCardData, "name">): ProductCardData {
  n++;
  return {
    slug: over.slug ?? `p-${n}`,
    productType: "Hobby Box",
    setCode: null,
    imageUrl: null,
    lowestPriceCents: 10000,
    inStockStores: 3,
    listedStores: 4,
    marketplaceOpen: false,
    medianOpenCents: null,
    releaseDate: null,
    ...over,
  };
}

// A small US-like market: Chrome and Prizm boxes of three types, a case, a sold-out box (releases undated: no set order yet).
const CH_HOBBY = card({ slug: "2025-topps-chrome-baseball-hobby-box", name: "2025 Topps Chrome Baseball Hobby Box", productType: "Hobby Box", lowestPriceCents: 32000 });
const CH_JUMBO = card({ slug: "2025-topps-chrome-baseball-jumbo-box", name: "2025 Topps Chrome Baseball Jumbo Box", productType: "Jumbo Box", lowestPriceCents: 55000 });
const CH_BLASTER = card({ slug: "2025-topps-chrome-baseball-blaster-box", name: "2025 Topps Chrome Baseball Blaster Box", productType: "Blaster Box", lowestPriceCents: 3999 });
const CH_CASE = card({ slug: "2025-topps-chrome-baseball-hobby-case", name: "2025 Topps Chrome Baseball Hobby Case", productType: "Hobby Case", lowestPriceCents: 360000 });
const PZ_HOBBY = card({ slug: "2025-panini-prizm-football-hobby-box", name: "2025 Panini Prizm Football Hobby Box", productType: "Hobby Box", lowestPriceCents: 85000 });
const PZ_MEGA = card({ slug: "2025-panini-prizm-football-mega-box", name: "2025 Panini Prizm Football Mega Box", productType: "Mega Box", lowestPriceCents: 7999 });
const PZ_SOLD = card({ slug: "2025-panini-prizm-football-blaster-box", name: "2025 Panini Prizm Football Blaster Box", productType: "Blaster Box", lowestPriceCents: null, inStockStores: 0, listedStores: 6 });
const FOTL = card({ slug: "2025-26-topps-chrome-basketball-fotl-hobby-box", name: "2025-26 Topps Chrome Basketball FOTL Hobby Box", productType: "FOTL Hobby Box", lowestPriceCents: 45000 });
const MARKET = [PZ_SOLD, CH_CASE, PZ_MEGA, CH_BLASTER, FOTL, CH_JUMBO, PZ_HOBBY, CH_HOBBY];

const slugs = (cs: ProductCardData[]) => cs.map((c) => c.slug);

// ─── The browse order ────────────────────────────────────────────────────────

test("SET_CODES_NEWEST_FIRST and TYPE_LABELS_BY_RANK come from sets.ts and sealed-title.ts", () => {
  assert.equal(SET_CODES_NEWEST_FIRST.length, SETS.length);
  assert.deepEqual([...SET_CODES_NEWEST_FIRST].sort(), SETS.map((s) => s.code).sort(), "every release, once");
  const date = new Map(SETS.map((s) => [s.code, s.releaseDate]));
  for (let i = 1; i < SET_CODES_NEWEST_FIRST.length; i++) {
    assert.ok(date.get(SET_CODES_NEWEST_FIRST[i - 1])! >= date.get(SET_CODES_NEWEST_FIRST[i])!, `newest first at ${i}`);
  }
  assert.deepEqual(TYPE_LABELS_BY_RANK, PRODUCT_TYPES.map((t) => t.label));
  assert.equal(TYPE_LABELS_BY_RANK[0], "Hobby Box");
});

test("relevanceCompare: open first, then type rank, then name and slug by code point", () => {
  const sorted = [...MARKET].sort(relevanceCompare);
  assert.deepEqual(slugs(sorted), [PZ_HOBBY.slug, CH_HOBBY.slug, CH_JUMBO.slug, FOTL.slug, CH_CASE.slug, PZ_MEGA.slug, CH_BLASTER.slug, PZ_SOLD.slug]);
});

test("codePointCompare orders by code point, as Postgres COLLATE \"C\" does", () => {
  const words = ["b", "B", "é", "e", "a b", "ab", "Ω", "\u{1F600}", "�", "Æther", "Aether"];
  const sorted = [...words].sort(codePointCompare);
  const byCodePoints = [...words].sort((a, b) => {
    const x = [...a].map((c) => c.codePointAt(0)!);
    const y = [...b].map((c) => c.codePointAt(0)!);
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
    return x.length - y.length;
  });
  assert.deepEqual(sorted, byCodePoints);
  assert.ok(codePointCompare("�", "\u{1F600}") < 0, "an astral character sorts after U+FFFD (UTF-16 units would not)");
});

test("the browse SQL is relevanceCompare: the same keys, in the same order, COLLATE \"C\"", () => {
  const src = readFileSync(new URL("../src/lib/browse-data.ts", import.meta.url), "utf8");
  const order = /const RELEVANCE = Prisma\.sql`([\s\S]*?)`;/.exec(src)?.[1].replace(/\s+/g, " ").trim();
  assert.equal(
    order,
    '(s."inStockStores" > 0 OR s."marketplaceOpen") DESC, array_position(${SET_CODES_NEWEST_FIRST}::text[], p."setCode") NULLS LAST, array_position(${TYPE_LABELS_BY_RANK}::text[], p."productType") NULLS LAST, p.name COLLATE "C", p.slug COLLATE "C"',
  );
  assert.match(src, /const from = \(page - 1\) \* PAGE_SIZE;/);
  assert.match(src, /LIMIT \$\{PAGE_SIZE\} OFFSET \$\{from\}/, "a page is 48 rows in SQL");
  // The files answer the same page with the same order (relevanceCompare over the comparable rows), the SQL only in "db" mode.
  assert.match(src, /comparableFromFiles\(market\)\.slice\(from, from \+ PAGE_SIZE\)/);
  assert.match(src, /\.sort\(relevanceCompare\)/);
  assert.match(src, /LIMIT \$\{INDEX_CAP\}/, "the index read is capped");
  assert.doesNotMatch(src, /\$queryRawUnsafe|unstable_cache/);
});

// ─── The index ───────────────────────────────────────────────────────────────

test("buildIndex: v1, the region, checkedAt, every card as a compact tuple in relevance order, round-tripping through expandCard", () => {
  const withDates = MARKET.map((c) => expandCard(compactCard(c)));
  const idx = buildIndex("us", withDates, new Date("2026-10-14T06:00:00Z"));
  assert.equal(idx.v, 1);
  assert.equal(idx.region, "us");
  assert.equal(idx.checkedAt, "2026-10-14T06:00:00.000Z");
  assert.equal(idx.rows.length, MARKET.length);
  assert.ok(idx.rows.every((r) => Array.isArray(r) && r.length === 10));
  const back = idx.rows.map(expandCard);
  assert.deepEqual(slugs(back), slugs([...withDates].sort(relevanceCompare)));
  assert.deepEqual(back, [...withDates].sort(relevanceCompare), "every field survives the round trip");
  assert.equal(buildIndex("au", [], null).checkedAt, null);
  // JSON and back is still an index of its region, and only of its region.
  const json = JSON.parse(JSON.stringify(idx)) as BrowseIndex;
  assert.ok(isBrowseIndex(json, "us"));
  assert.ok(!isBrowseIndex(json, "au"));
  assert.ok(!isBrowseIndex({ ...idx, v: 2 }, "us"));
  assert.ok(!isBrowseIndex("<!doctype html>", "us"));
});

test("the index route: 404 for anything but a region (no read), the loader's index as JSON for each of the seven", async () => {
  let reads = 0;
  const load = async (region: (typeof REGION_LIST)[number]["region"]): Promise<BrowseIndex> => {
    reads++;
    return buildIndex(region, [CH_HOBBY], null);
  };
  for (const bad of ["xx", "US", "", "us ", "constructor", "__proto__"]) {
    const res = await browseIndexResponse(bad, load);
    assert.equal(res.status, 404, JSON.stringify(bad));
  }
  assert.equal(reads, 0, "an unknown region never reaches the database");
  for (const r of REGION_LIST) {
    const res = await browseIndexResponse(r.region, load);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    assert.equal(res.headers.get("cache-control"), "s-maxage=86400, stale-while-revalidate", "CDN-cached for a day, like every ISR page");
    const body = await res.json();
    assert.ok(isBrowseIndex(body, r.region));
    assert.equal(body.rows[0][0], CH_HOBBY.slug);
  }
  assert.equal(reads, REGION_LIST.length);
  const route = readFileSync(new URL("../src/app/api/browse/[region]/route.ts", import.meta.url), "utf8");
  assert.match(route, /export const dynamic = "force-static";/);
  assert.match(route, /export const revalidate = 86400;/);
  assert.match(route, /export function generateStaticParams\(\) \{\s*return \[\];\s*\}/);
  assert.doesNotMatch(route, /export (async )?function (POST|PUT|PATCH|DELETE)/, "GET only");
});

// ─── Search ──────────────────────────────────────────────────────────────────

test("rankSearch: accents never matter, and every word must match", () => {
  assert.deepEqual(slugs(rankSearch(MARKET, "chrome hobby").products), [CH_HOBBY.slug, FOTL.slug, CH_CASE.slug]);
  assert.deepEqual(slugs(rankSearch(MARKET, "CHRÓME HÖBBY").products), [CH_HOBBY.slug, FOTL.slug, CH_CASE.slug]);
  assert.deepEqual(slugs(rankSearch(MARKET, "prizm mega").products), [PZ_MEGA.slug]);
  assert.equal(rankSearch(MARKET, "prizm baseball").total, 0);
  assert.deepEqual(queryWords("  Sealed   Prizm-Football!  "), ["prizm", "football"], "'sealed' is dropped when other words remain");
  assert.deepEqual(queryWords("sealed"), ["sealed"], "…but not when it is the only word");
  assert.equal(rankSearch(MARKET, "").total, 0);
  assert.equal(rankSearch(MARKET, " & ").total, 0);
});

test("rankSearch: collectors' words (hta, fotl, plurals) and a word inside a name", () => {
  assert.deepEqual(slugs(rankSearch(MARKET, "hta").products), [CH_JUMBO.slug]);
  assert.deepEqual(slugs(rankSearch(MARKET, "first off the line").products), [FOTL.slug]);
  assert.deepEqual(slugs(rankSearch(MARKET, "blaster boxes").products), [CH_BLASTER.slug, PZ_SOLD.slug], "a plural finds the singular label");
  assert.deepEqual(slugs(rankSearch(MARKET, "izm").products), [PZ_HOBBY.slug, PZ_MEGA.slug, PZ_SOLD.slug], "three letters or more match inside a word");
  assert.equal(rankSearch(MARKET, "zm").total, 0, "two letters match word starts only");
  assert.deepEqual(slugs(rankSearch(MARKET, "2025-26 basketball").products), [FOTL.slug], "a season is two words");
});

test("rankSearch order: open first, chase types first, cheaper within a type", () => {
  assert.deepEqual(slugs(rankSearch(MARKET, "football").products), [PZ_HOBBY.slug, PZ_MEGA.slug, PZ_SOLD.slug]);
  const two = [card({ name: "2025 Topps Chrome Baseball Blaster Box A", productType: "Blaster Box", lowestPriceCents: 4500 }), card({ name: "2025 Topps Chrome Baseball Blaster Box B", productType: "Blaster Box", lowestPriceCents: 3900 })];
  assert.deepEqual(rankSearch(two, "chrome blaster").products.map((p) => p.name), ["2025 Topps Chrome Baseball Blaster Box B", "2025 Topps Chrome Baseball Blaster Box A"]);
  const r = slugs(searchCards([PZ_SOLD, CH_BLASTER], "blaster"));
  assert.deepEqual(r, [CH_BLASTER.slug, PZ_SOLD.slug], "sold out always after open");
});

test("rankSearch: the limit, the total, and the 'See all' option last", () => {
  const many = Array.from({ length: 20 }, (_, i) => card({ name: `Marvel Super Heroes Commander Deck ${String(i).padStart(2, "0")}`, productType: "Commander Deck", setCode: "msh", lowestPriceCents: 1000 + i }));
  const r = rankSearch(many, "super", 8);
  assert.equal(r.products.length, 8);
  assert.equal(r.total, 20);
  assert.equal(rankSearch(many, "super").products.length, 8, "8 by default");
  assert.equal(rankSearch(many, "super", 3).products.length, 3);
  const opts = searchOptions("au", " marvel  super ", r);
  assert.equal(opts.length, 9);
  assert.deepEqual(
    opts.slice(0, 8).map((o) => o.kind),
    Array(8).fill("product"),
  );
  assert.equal(opts[0].href, `/au/p/${many[0].slug}`);
  const all = opts[8];
  assert.equal(all.kind, "all");
  assert.equal(all.kind === "all" && all.label, "See all results for “marvel  super”");
  assert.equal(all.href, "/au/sealed?q=marvel%20%20super");
  assert.equal(all.kind === "all" && all.total, 20);
  // No matches: still the one way through to the full results.
  const none = searchOptions("us", "zzz", rankSearch(MARKET, "zzz"));
  assert.deepEqual(none.map((o) => o.kind), ["all"]);
  assert.deepEqual(searchOptions("us", "   ", rankSearch(MARKET, "   ")), []);
  assert.equal(searchHref("uk", ""), "/uk/sealed");
  assert.equal(searchHref("uk", "d&d 2"), "/uk/sealed?q=d%26d%202");
});

test("highlightRanges: the query's words where they start a word, in the original string's indices", () => {
  const name = "Marvel Super Heroes Collector Booster Box";
  const marked = (q: string) => highlightRanges(name, q).map(([a, b]) => name.slice(a, b));
  assert.deepEqual(marked("marvel su"), ["Marvel", "Su"]);
  assert.deepEqual(marked("mtg collector booster"), ["Collector", "Booster"]);
  assert.deepEqual(marked("cóllector"), ["Collector"]);
  assert.deepEqual(marked("boxes"), ["Box"], "a plural marks its singular");
  assert.deepEqual(marked("per"), [], "never inside a word");
  const accented = "Ætherdrift Ultimé Bundle";
  assert.deepEqual(highlightRanges(accented, "ultime").map(([a, b]) => accented.slice(a, b)), ["Ultimé"], "an accent in the name still marks");
  assert.deepEqual(highlightRanges("Décor décor", "de"), [[0, 2], [6, 8]]);
});

test("isBrowsePath: the region's browse page and its numbered pages only", () => {
  assert.ok(isBrowsePath("/us/sealed", "us"));
  assert.ok(isBrowsePath("/us/sealed/", "us"));
  assert.ok(isBrowsePath("/us/sealed/page/3", "us"));
  assert.ok(!isBrowsePath("/au/sealed", "us"));
  assert.ok(!isBrowsePath("/us/sets/marvel-super-heroes", "us"));
  assert.ok(!isBrowsePath(null, "us"));
});

// ─── Recently viewed ─────────────────────────────────────────────────────────

function memoryStorage(): RecentStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
}

const throwing: RecentStorage = {
  getItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("full", "QuotaExceededError");
  },
  removeItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
};

test("recently viewed: most recent first, deduped, at most 12, per region", () => {
  assert.deepEqual(pushRecent(["a", "b", "c"], "b"), ["b", "a", "c"]);
  assert.deepEqual(pushRecent([], "a"), ["a"]);
  assert.equal(pushRecent(Array.from({ length: 12 }, (_, i) => `s-${i}`), "new").length, RECENT_MAX);
  assert.equal(pushRecent(Array.from({ length: 12 }, (_, i) => `s-${i}`), "new").at(-1), "s-10", "the oldest drops off");

  const s = memoryStorage();
  for (const slug of ["bloomburrow-play-booster-box", "tarkir-dragonstorm-bundle", "bloomburrow-play-booster-box", "aetherdrift-play-booster-box"]) {
    rememberRecent("us", slug, s);
  }
  assert.deepEqual(readRecent("us", s), ["aetherdrift-play-booster-box", "bloomburrow-play-booster-box", "tarkir-dragonstorm-bundle"]);
  assert.equal(recentKey("us"), "wax-recent-us");
  assert.ok(s.data.has("wax-recent-us"));
  assert.deepEqual(readRecent("au", s), [], "each region keeps its own list");
  // Junk in storage is ignored, never trusted: non-strings, odd slugs and duplicates go.
  s.data.set("wax-recent-uk", JSON.stringify(["ok-slug", 7, "<script>", "ok-slug", "../x", null]));
  assert.deepEqual(readRecent("uk", s), ["ok-slug"]);
  s.data.set("wax-recent-uk", "{not json");
  assert.deepEqual(readRecent("uk", s), []);
  s.data.set("wax-recent-uk", JSON.stringify({ a: 1 }));
  assert.deepEqual(readRecent("uk", s), []);
  clearRecent("us", s);
  assert.deepEqual(readRecent("us", s), []);
});

test("recently viewed with blocked storage (private mode, a full quota): nothing remembered, nothing thrown", () => {
  assert.deepEqual(readRecent("us", throwing), []);
  assert.deepEqual(rememberRecent("us", "bloomburrow-play-booster-box", throwing), []);
  assert.doesNotThrow(() => clearRecent("us", throwing));
  assert.deepEqual(readRecent("us", null), []);
  assert.deepEqual(rememberRecent("us", "bloomburrow-play-booster-box", null), []);
  // Outside a browser (no window): the default storage is "none", not an exception.
  assert.deepEqual(readRecent("us"), []);
  assert.deepEqual(rememberRecent("us", "bloomburrow-play-booster-box"), []);
});

test("recentCards: the remembered products the index still lists, in visit order, at most 8; the rail renders nothing on the server", () => {
  const bySlug = new Map(MARKET.map((c) => [c.slug, c]));
  assert.deepEqual(slugs(recentCards([PZ_MEGA.slug, "gone", CH_HOBBY.slug], bySlug)), [PZ_MEGA.slug, CH_HOBBY.slug]);
  assert.equal(recentCards(MARKET.map((c) => c.slug), bySlug).length, 8);
  assert.equal(renderToStaticMarkup(React.createElement(RecentlyViewed, { region: "us" })), "", "never in the server HTML");
});

// ─── The query's marketplace box and the grid's server HTML ──────────────────

test("QueryEbayBox: one labelled browse-search unit, eBay for the words typed (no TCGplayer: it sells no sealed sports cards), sponsored rel", () => {
  const us = renderToStaticMarkup(React.createElement(QueryEbayBox, { region: "us", q: "  chrome   hta " }));
  assert.match(us, /^<div data-ad="browse-search" role="group" aria-label="Sponsored: marketplace searches"/);
  assert.match(us, /class="ad-pill ">Ad<\/span>/);
  assert.ok(us.includes(AFFILIATE_NOTE));
  assert.match(us, /See “chrome hta” on eBay — Buy It Now/);
  const links = [...us.matchAll(/<a [^>]*href="([^"]+)"[^>]*rel="([^"]+)"/g)].map((m) => ({ href: m[1].replace(/&amp;/g, "&"), rel: m[2] }));
  assert.equal(links.length, 1);
  assert.equal(links[0].rel, REL_SPONSORED);
  const ebay = new URL(links[0].href);
  assert.equal(ebay.hostname, "www.ebay.com");
  assert.equal(ebay.searchParams.get("_nkw"), "chrome hta sealed");
  assert.equal(ebay.searchParams.get("customid"), "wax-us-browse-search");
  assert.doesNotMatch(us, /tcgplayer/i);
  const au = renderToStaticMarkup(React.createElement(QueryEbayBox, { region: "au", q: "hta" }));
  assert.match(au, /ebay\.com\.au/);
  assert.equal(renderToStaticMarkup(React.createElement(QueryEbayBox, { region: "au", q: "   " })), "");
  assert.equal(shownQuery("x".repeat(80)).length, 60);
  assert.equal(findBannedCopy(us.replace(/<[^>]+>/g, " ")), null);
});

test("BrowseGrid's server HTML: the page's rows in order, the strip, real page links; never the search box or a query", () => {
  const rows = [...MARKET].sort(relevanceCompare).map(compactCard);
  const strip = React.createElement("div", { "data-testid": "strip" }, "STRIP");
  const html = renderToStaticMarkup(React.createElement(BrowseGrid, { rows, total: 2230, region: "us", base: "/us/sealed", page: 1, strip }));
  const hrefs = [...html.matchAll(/href="\/us\/p\/([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, rows.map((r) => r[0]), "the server rows, in the server's order");
  assert.ok(html.indexOf("STRIP") > html.indexOf(`/us/p/${rows[3][0]}`) && html.indexOf("STRIP") < html.indexOf(`/us/p/${rows[4][0]}`), "the strip after the 4th");
  assert.match(html, /<b class="text-ink">2,230<\/b> products · page 1 of 47/);
  assert.match(html, /href="\/us\/sealed\/page\/2"/);
  assert.match(html, /href="\/us\/sealed\/page\/47"/);
  assert.doesNotMatch(html, /browse-search|Loading all/);
  assert.match(html, /class="card sticky top-\[calc\(var\(--hdr\)\+0\.5rem\)\] z-30 /, "sticks under the header");
  assert.match(html, /<dialog aria-label="Filters" class="[^"]*"><\/dialog>/, "the phone's filter sheet is a dialog, empty until first opened");
  const p2 = renderToStaticMarkup(React.createElement(BrowseGrid, { rows: rows.slice(0, 2), total: 50, region: "us", base: "/us/sealed", page: 2 }));
  assert.match(p2, /<a (?=[^>]*rel="prev")(?=[^>]*href="\/us\/sealed")/, "page 2 links back to the bare URL");
});
