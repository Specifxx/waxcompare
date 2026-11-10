import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BREAKER_EMPTY,
  BREAKER_FAILURES,
  feedsShortfall,
  DEFAULT_DAILY_CAP,
  DEFAULT_RUN_CAP,
  DEFAULT_SWEEP_CALLS,
  MAX_DAILY_CAP,
  sweepCallsFromEnv,
  freshWindowMs,
  PROGRESS_EVERY,
  startReport,
  BUCKETS,
  buildPlan,
  CHASE_QUERIES,
  capsFromEnv,
  fixedFeeds,
  hotCoverage,
  hotItemKeys,
  itemKeys,
  itemQuery,
  MARKETPLACE_ORDER,
  perProductFeeds,
  purgeCutoff,
  retryAllowance,
  CANADA_ITEMS_FIRST,
  canadaFirst,
  SWEEP_CEILING,
  runCap,
  runImport,
  SEALED_QUERIES,
  selectFeedItems,
  setFeedSets,
  setQuery,
  SOLD_OUT_BOOST,
  TYPE_FEEDS,
  type ImportDeps,
} from "../src/lib/ebay-import";
import { ALWAYS_TYPES, GATED_MAX_USD, GATED_TYPES, ITEM_CORE_USD, ITEM_FLOOR_USD, referenceUsd, tierOf } from "../src/lib/ebay-eligibility";
import { budgetDay, DDL } from "../src/lib/ebay-store";
import { capacityReport, runReport } from "../src/lib/ebay-report";
import { hoursToMs, MARKET_WEIGHT, MARKETPLACE_OF_REGION } from "../src/lib/ebay-context";
import type { Region } from "../src/lib/regions";
import { PRODUCT_TYPES, fromRoughUsdCents, type TypeKey } from "../src/lib/sealed-title";
import { SETS } from "../src/lib/sets";
import { hotSweepQueries, SWEEP_PAGE, SWEEP_QUERIES } from "../src/lib/ebay-sweep";
import { HOT_SETS, PRIORITY_MARKETPLACES } from "../src/lib/popular";
import { fakeDb, harness, json, NOW, okToken, planRow, requestedReference, summary, withReference, type FakeDb, type Handler } from "./helpers/ebay-fakes";

const TODAY = "2026-10-07";
/** The fixed feeds' calls today: chase 40 + sealed 30 + types 35 + 5 per released set (none until releases are discovered). */
const FIXED = fixedFeeds(TODAY).reduce((a, f) => a + f.searches.length, 0);
const usdCents = (usd: number, market: string) => Math.round(fromRoughUsdCents(usd * 100, market));

// ─── the budget day ─────────────────────────────────────────────────────────────

test("the budget day is the PACIFIC day, across daylight-saving changes", () => {
  assert.equal(budgetDay(Date.parse("2026-10-07T06:37:00Z")), "2026-10-06", "06:37 UTC is still the previous Pacific day: the daily cron is NOT here (it runs after the reset, 08:37 UTC)");
  assert.equal(budgetDay(Date.parse("2026-10-07T06:59:59Z")), "2026-10-06");
  assert.equal(budgetDay(Date.parse("2026-10-07T07:00:00Z")), "2026-10-07", "midnight Pacific in summer is 07:00 UTC");
  // fall back (2026-11-01, 09:00 UTC): midnight Pacific moves to 08:00 UTC
  assert.equal(budgetDay(Date.parse("2026-11-01T06:59:00Z")), "2026-10-31");
  assert.equal(budgetDay(Date.parse("2026-11-01T07:00:00Z")), "2026-11-01");
  assert.equal(budgetDay(Date.parse("2026-11-02T07:59:00Z")), "2026-11-01", "winter: still the 1st at 07:59 UTC");
  assert.equal(budgetDay(Date.parse("2026-11-02T08:00:00Z")), "2026-11-02");
  // spring forward (2026-03-08, 10:00 UTC)
  assert.equal(budgetDay(Date.parse("2026-03-08T07:59:00Z")), "2026-03-07");
  assert.equal(budgetDay(Date.parse("2026-03-08T08:00:00Z")), "2026-03-08");
  assert.equal(budgetDay(Date.parse("2026-03-09T06:59:00Z")), "2026-03-08");
  assert.equal(budgetDay(Date.parse("2026-03-09T07:00:00Z")), "2026-03-09");
  assert.match(budgetDay(NOW), /^\d{4}-\d{2}-\d{2}$/);
});

test("the DDL is what prisma db push makes (so a self-healed table is the table db push expects)", () => {
  const sql = DDL.join("\n");
  for (const col of ['"feed" TEXT NOT NULL', '"rank" INTEGER NOT NULL', '"itemId" TEXT NOT NULL', '"imageUrl" TEXT NOT NULL', '"priceValue" TEXT NOT NULL', '"shipValue" TEXT,', '"shipFree" BOOLEAN,', '"condition" TEXT,', '"fetchedAt" TIMESTAMP(3) NOT NULL', 'PRIMARY KEY ("feed","rank")', '"day" TEXT NOT NULL', '"total" INTEGER NOT NULL']) assert.ok(sql.includes(col), col);
  assert.ok(DDL.every((s) => /IF NOT EXISTS/.test(s)));
  assert.ok(/EbayListing_fetchedAt_idx/.test(sql));
});

// ─── eligibility ────────────────────────────────────────────────────────────────

test("eligibility thresholds: US$50 core for the gated types, US$25 floor for all, never packs", () => {
  assert.equal(ITEM_CORE_USD, 50);
  assert.equal(ITEM_FLOOR_USD, 25);
  for (const t of ALWAYS_TYPES) {
    assert.equal(tierOf(t, 24.99), "no", `${t} under the floor`);
    assert.equal(tierOf(t, 25), "core", t);
    assert.equal(tierOf(t, 400), "core", t);
  }
  for (const t of GATED_TYPES) {
    assert.equal(tierOf(t, 24.99), "no", t);
    assert.equal(tierOf(t, 25), "extension", t);
    assert.equal(tierOf(t, 49.99), "extension", t);
    assert.equal(tierOf(t, 50), "core", t);
  }
  // packs, hangers, cellos, value packs and albums: never their own search
  const PACKS: TypeKey[] = PRODUCT_TYPES.map((t) => t.key).filter((k) => !ALWAYS_TYPES.has(k) && !GATED_TYPES.has(k));
  assert.deepEqual([...PACKS].sort(), ["cello-pack", "hanger-box", "hobby-pack", "retail-pack", "starter-pack", "sticker-album", "value-pack"]);
  for (const t of PACKS) for (const usd of [10, 25, 50, 500, 5000]) assert.equal(tierOf(t, usd), "no", t);
  assert.equal(tierOf("mega-box", null), "no");
  // every type is in exactly one class
  const all = new Set(PRODUCT_TYPES.map((t) => t.key));
  for (const t of all) assert.ok([ALWAYS_TYPES.has(t), GATED_TYPES.has(t), PACKS.includes(t)].filter(Boolean).length === 1, t);
});

test("eligibility edges per currency: US$50 and US$25 in each market's money", () => {
  // thresholds (rough FX table: AU 1.5, NZ 1.65, US 1, UK 0.78, CA 1.37, EU 0.9, SG 1.3)
  const core: Record<string, number> = { AU: 75, NZ: 82.5, US: 50, UK: 39, CA: 68.5, EU: 45, SG: 65 };
  for (const [market, c] of Object.entries(core)) {
    const at = (value: number) => referenceUsd({ market, openCents: Math.round(value * 100), anyCents: null });
    assert.equal(tierOf("mega-box", at(c + 0.01)), "core", `${market} just over US$50`);
    assert.equal(tierOf("mega-box", at(c - 0.5)), "extension", `${market} just under US$50`);
    assert.equal(tierOf("mega-box", at(c / 2 + 0.01)), "extension", `${market} just over US$25`);
    assert.equal(tierOf("mega-box", at(c / 2 - 0.5)), "no", `${market} under US$25`);
  }
  // best-known = the cheapest OPEN price, else the cheapest listed one (a sold-out product), else unknown
  assert.equal(referenceUsd({ market: "US", openCents: 6000, anyCents: 5000 }), 60);
  assert.equal(referenceUsd({ market: "US", openCents: null, anyCents: 5000 }), 50);
  assert.equal(referenceUsd({ market: "US", openCents: null, anyCents: null }), null);
  assert.equal(referenceUsd({ market: "US", openCents: 0, anyCents: 0 }), null);
});

test("item keys: only regions with a ProductStat row, one key per (marketplace, product), highest reference price of the marketplace's regions", () => {
  const etb = (market: string, usd: number, o = {}) => planRow("mega-box", market, usdCents(usd, market), { id: "etb1", name: "Aetherdrift Bundle", ...o });
  // AU and NZ share EBAY_AU: one key; SG and US share EBAY_US: one key; UK a second marketplace; EU none (no row)
  const keys = itemKeys([etb("AU", 60), etb("NZ", 70), etb("US", 55), etb("SG", 50), etb("UK", 60)]);
  assert.equal(keys.length, 3);
  assert.deepEqual(keys.map((k) => k.marketplace).sort(), ["EBAY_AU", "EBAY_GB", "EBAY_US"]);
  assert.equal(keys.find((k) => k.marketplace === "EBAY_AU")!.usd.toFixed(0), "70", "the higher of AU and NZ");
  assert.ok(!keys.some((k) => k.marketplace === "EBAY_DE" || k.marketplace === "EBAY_CA"), "no stat row there, no key");
  // an NZ-only product is an EBAY_AU key; an SG-only one an EBAY_US key
  assert.equal(itemKeys([etb("NZ", 60, { id: "n" })])[0].marketplace, "EBAY_AU");
  assert.equal(itemKeys([etb("SG", 60, { id: "s" })])[0].marketplace, "EBAY_US");
  // packs never; a price under the floor never; unknown price never
  assert.equal(itemKeys([planRow("hobby-pack", "US", 9999, { id: "bp" }), planRow("cello-pack", "US", 9999, { id: "sb" })]).length, 0);
  assert.equal(itemKeys([etb("US", 24, { id: "cheap" })]).length, 0);
  assert.equal(itemKeys([{ ...etb("US", 60, { id: "x" }), openCents: null, anyCents: null }]).length, 0);
});

test("ranking: core before extension; within a tier reference price x market weight, sold-out x1.5; stable", () => {
  const rows = [
    planRow("mega-box", "US", usdCents(60, "US"), { id: "c-us60", name: "Alpha Premium Collection" }),
    planRow("mega-box", "DE" === "DE" ? "EU" : "EU", usdCents(60, "EU"), { id: "c-eu60", name: "Alpha Premium Collection" }),
    planRow("mega-box", "US", usdCents(40, "US"), { id: "c-us40", name: "Beta Premium Collection" }), // extension
    planRow("blaster-box", "US", usdCents(55, "US"), { id: "t-us55-sold", name: "Gamma Commander Deck", soldOut: true }),
    planRow("blaster-box", "UK", usdCents(80, "UK"), { id: "t-uk80", name: "Delta Commander Deck" }),
    planRow("mega-box", "CA", usdCents(100, "CA"), { id: "e-ca100", name: "Aetherdrift Bundle" }),
  ];
  const order = itemKeys(rows).map((k) => `${k.productId}@${k.marketplace}`);
  // values: t-us55-sold = 55x1x1.5 = 82.5, c-us60 = 60, t-uk80 = 80x0.7 = 56, c-eu60 = 60x0.7 = 42, e-ca100 = 100x0.25 = 25; then the extension c-us40
  assert.deepEqual(order, ["t-us55-sold@EBAY_US", "c-us60@EBAY_US", "t-uk80@EBAY_GB", "c-eu60@EBAY_DE", "e-ca100@EBAY_CA", "c-us40@EBAY_US"]);
  assert.equal(SOLD_OUT_BOOST, 1.5);
  // the owner's priority: the US above all, then the UK and the EU, then Australia/NZ and Canada
  assert.deepEqual(MARKET_WEIGHT, { EBAY_US: 1, EBAY_GB: 0.7, EBAY_DE: 0.7, EBAY_AU: 0.35, EBAY_CA: 0.25 });
  // stable: the same input in any order gives the same ranking
  assert.deepEqual(itemKeys([...rows].reverse()).map((k) => `${k.productId}@${k.marketplace}`), order);
  // equal values tie-break by product id
  const tie = itemKeys([planRow("mega-box", "US", 6000, { id: "b", name: "Aetherdrift Bundle" }), planRow("mega-box", "US", 6000, { id: "a", name: "Tarkir: Dragonstorm Bundle" })]);
  assert.deepEqual(tie.map((k) => k.productId), ["a", "b"]);
  assert.ok(itemKeys(rows).find((k) => k.productId === "t-us55-sold")!.soldOut);
});

// ─── the plan ───────────────────────────────────────────────────────────────────

test("fixed feeds: chase 5x8 + sealed 5x6 + types 5x7 + sets 5 per released set, in priority order", () => {
  const feeds = fixedFeeds(TODAY);
  const calls = (b: string) => feeds.filter((f) => f.bucket === b).reduce((a, f) => a + f.searches.length, 0);
  assert.deepEqual([calls("chase"), calls("sealed"), calls("types"), calls("sets")], [40, 30, 35, 5 * setFeedSets(TODAY).length]);
  assert.equal(CHASE_QUERIES.length, 8);
  assert.equal(SEALED_QUERIES.length, 6);
  assert.equal(TYPE_FEEDS.length, 7);
  const order = feeds.map((f) => f.bucket);
  assert.deepEqual([...new Set(order)], ["chase", "sealed", "types", ...(setFeedSets(TODAY).length ? ["sets"] : [])]);
  assert.equal(order.lastIndexOf("chase") < order.indexOf("sealed"), true);
  // the owner's priority marketplaces first (US, UK, EU), then the rest by weight, so a cap hit drops EBAY_CA before EBAY_US
  assert.deepEqual(MARKETPLACE_ORDER, ["EBAY_US", "EBAY_GB", "EBAY_DE", "EBAY_AU", "EBAY_CA"]);
  assert.deepEqual(MARKETPLACE_ORDER.slice(0, PRIORITY_MARKETPLACES.length), [...PRIORITY_MARKETPLACES]);
  assert.deepEqual(feeds.filter((f) => f.bucket === "chase").map((f) => f.feed), MARKETPLACE_ORDER.map((m) => `${m}|chase`));
  for (const f of feeds) for (const s of f.searches) {
    assert.ok(s.q.length <= 100, s.q);
    assert.ok(!/\bmtg\b|magic|pokemon/i.test(s.q), s.q);
    assert.equal(s.marketplace, f.marketplace);
  }
  // the chase feed is high-end SEALED, never single cards: no query names a card, a grade or a player
  for (const q of CHASE_QUERIES) assert.ok(/hobby (?:box|case)/.test(q) && !/\b(?:psa|bgs|rookie|auto|card|single|refractor)\b/i.test(q), q);
  assert.ok(feeds.filter((f) => f.bucket === "types").every((f) => f.searches.length === 1));
  const slugs = new Set(feeds.filter((f) => f.bucket === "types").map((f) => f.feed.split("type:")[1]));
  assert.deepEqual([...slugs].sort(), ["blaster-boxes", "breakers-delight-boxes", "fotl-boxes", "hobby-boxes", "hobby-cases", "jumbo-boxes", "mega-boxes"]);
});

test("set feeds: the most recently RELEASED releases, never one not out yet; searched as '<release> sealed'", () => {
  const sets = setFeedSets(TODAY);
  assert.ok(sets.length <= 30);
  assert.ok(sets.every((s) => s.releaseDate <= TODAY && !s.generic));
  const chrome = { ...SETS[0], ...{ code: "2025|chrome|baseball", name: "2025 Topps Chrome Baseball", releaseDate: "2026-10-01", generic: false } };
  const upcoming = { ...chrome, code: "2026|bowman|baseball", name: "2026 Bowman Baseball", releaseDate: "2026-12-01" };
  const two = setFeedSets(TODAY, 30, [upcoming, chrome] as never);
  assert.deepEqual(two.map((s) => s.code), ["2025|chrome|baseball"], "not out yet: no set feed");
  assert.equal(setQuery(chrome as never), "2025 Topps Chrome Baseball sealed");
  assert.equal(setQuery({ ...chrome, name: "2025 Topps Chrome: Update & Series" } as never), "2025 Topps Chrome Update Series sealed", "':' and '&' dropped");
});

test("item queries: the cleaned product name (no 'sealed': eBay ANDs every keyword; no MTG), at most 100 characters, store noise removed", () => {
  assert.equal(itemQuery("2025 Topps Chrome Baseball Hobby Box"), "2025 Topps Chrome Baseball Hobby Box");
  assert.equal(itemQuery("2025 Topps Chrome Baseball Hobby Box [Limit 1 Per Customer] - Local Pickup Only"), "2025 Topps Chrome Baseball Hobby Box");
  const long = itemQuery("2025-26 Topps Chrome Basketball Breaker's Delight Box " + "Extraordinarily Long Product Name ".repeat(6));
  assert.ok(long.length <= 100 && long.startsWith("2025-26 Topps Chrome"));
  assert.ok(!long.endsWith(" "));
  for (const q of [itemQuery("2025 Topps Chrome Baseball Hobby Box"), long]) assert.ok(!/\bsealed\b|\bmtg\b/i.test(q), q);
});

const MANY = (n: number): ReturnType<typeof planRow>[] =>
  Array.from({ length: n }, (_, i) => planRow("mega-box", ["US", "AU", "UK", "CA", "EU"][i % 5], usdCents(50 + (i % 500), ["US", "AU", "UK", "CA", "EU"][i % 5]), { id: `c${String(i).padStart(4, "0")}`, name: `${2015 + (i % 11)} ${["Topps Chrome", "Topps Heritage", "Topps Finest", "Topps Stadium Club"][Math.floor(i / 11) % 4]} Baseball Mega Box` }));

test("a placeholder ask (a sold-out prerelease pack at CA$9,999) is not an eligible key, so it cannot eat the day's calls", () => {
  const real = planRow("mega-box", "US", usdCents(80, "US"), { id: "real", name: "Real Premium Collection" });
  const fake = planRow("hobby-pack", "CA", usdCents(7299, "CA"), { id: "fake", name: "Placeholder Prerelease Pack", soldOut: true });
  const edge = planRow("blaster-box", "US", usdCents(600, "US"), { id: "edge", name: "Edge Commander Deck" });
  const over = planRow("blaster-box", "US", usdCents(601, "US"), { id: "over", name: "Over Commander Deck" });
  assert.deepEqual(itemKeys([fake, real, edge, over]).map((k) => k.productId).sort(), ["edge", "real"]);
  assert.equal(GATED_MAX_USD, 600);
  assert.equal(tierOf("hobby-box", 9000), "core", "a real vintage box can cost thousands");
});

test("buildPlan: spends the cap in priority order; a cap hit drops the LEAST valuable; calls never exceed the cap", () => {
  const rows = MANY(300);
  // The per-product priority on its own (sweepCalls 0: no sweep share); the sweep's place in the order is checked below.
  const full = buildPlan(rows, { cap: 2000, sweepCalls: 0, today: TODAY });
  assert.equal(full.sweepBudget, 0);
  assert.equal(full.calls, FIXED + 300);
  assert.equal(full.byBucket.items.feeds, 300);
  assert.equal(full.items.core, 300);
  assert.equal(full.items.coreCovered, 300, "all fit");
  const items = full.feeds.filter((f) => f.bucket === "items");
  const values = items.map((f) => f.item!.value);
  for (let i = 1; i < values.length; i++) assert.ok(values[i - 1] >= values[i], "most valuable first");
  assert.equal(full.feeds.findIndex((f) => f.bucket === "items") > full.feeds.findLastIndex((f) => f.bucket === "sets"), true);
  const idx = (b: string) => BUCKETS.indexOf(b as never);
  for (const cap of [0, 1, 7, 8, 39, 40, 41, 70, 71, 100, 104, 105, 106, 115, 300, 560]) {
    const p = buildPlan(rows, { cap, sweepCalls: 0, today: TODAY });
    assert.ok(p.calls <= cap, `${cap}`);
    assert.equal(p.calls, p.feeds.reduce((a, f) => a + f.searches.length, 0));
    // strict priority: nothing of a lower bucket is planned while a higher bucket has an unplanned feed
    const planned = p.feeds.map((f) => idx(f.bucket));
    for (let i = 1; i < planned.length; i++) assert.ok(planned[i] >= planned[i - 1]);
  }
  assert.equal(buildPlan(rows, { cap: 0, today: TODAY }).feeds.length, 0);
  assert.equal(buildPlan(rows, { cap: 0, today: TODAY }).sweepBudget, 0);
  assert.equal(buildPlan(rows, { cap: 7, today: TODAY }).feeds.length, 0, "the first chase feed needs 8 calls");
  assert.equal(buildPlan(rows, { cap: 7, today: TODAY }).sweepBudget, 0, "nothing below a feed that did not fit, the sweep included");
  // 300 items but a cap of FIXED + 250: the 50 least valuable items miss out
  const tight = buildPlan(rows, { cap: FIXED + 250, sweepCalls: 0, today: TODAY });
  assert.equal(tight.byBucket.items.feeds, 250);
  assert.equal(tight.items.coreCovered, 250);
  const dropped = new Set(items.map((f) => f.feed));
  for (const f of tight.feeds.filter((x) => x.bucket === "items")) dropped.delete(f.feed);
  const minKept = Math.min(...tight.feeds.filter((x) => x.bucket === "items").map((x) => x.item!.value));
  for (const f of items) if (dropped.has(f.feed)) assert.ok(f.item!.value <= minKept);

  // The catalogue sweep's share comes after the sets and before the per-product (pre-plan) items: chase, sealed, types, sets, sweep, items.
  assert.deepEqual(BUCKETS, ["chase", "sealed", "types", "sets", "sweep", "items"]);
  assert.equal(DEFAULT_SWEEP_CALLS, 950);
  const withSweep = buildPlan(rows, { cap: FIXED + DEFAULT_SWEEP_CALLS + 300, today: TODAY }); // room for every fixed feed, the full share and all 300 items
  assert.equal(withSweep.sweepBudget, DEFAULT_SWEEP_CALLS);
  assert.equal(withSweep.calls, FIXED + DEFAULT_SWEEP_CALLS + 300);
  assert.deepEqual(withSweep.byBucket.sweep, { feeds: 5, calls: DEFAULT_SWEEP_CALLS, wanted: 5, wantedCalls: DEFAULT_SWEEP_CALLS, fresh: 0 }, "the sweep's 'feeds' are its marketplaces");
  assert.equal(withSweep.byBucket.items.feeds, 300);
  const edge = FIXED + DEFAULT_SWEEP_CALLS;
  for (const cap of [0, 7, 100, FIXED - 1, FIXED, FIXED + 1, 300, 1000, edge - 1, edge, edge + 1, 2100, 2360, 2500]) {
    const p = buildPlan(rows, { cap, today: TODAY });
    const fixedCalls = p.feeds.filter((f) => f.bucket !== "items").reduce((a, f) => a + f.searches.length, 0);
    const itemCalls = p.feeds.filter((f) => f.bucket === "items").reduce((a, f) => a + f.searches.length, 0);
    assert.ok(p.calls <= cap, `${cap}: ${p.calls}`);
    assert.equal(p.calls, fixedCalls + p.sweepBudget + itemCalls, `${cap}: the plan's calls are its feeds' searches plus the sweep's share`);
    // the sweep gets nothing while a fixed feed is unplanned; a per-product search nothing while the sweep is short of its share
    assert.equal(p.sweepBudget, cap >= FIXED ? Math.min(DEFAULT_SWEEP_CALLS, cap - FIXED) : 0, `${cap}`);
    if (p.sweepBudget > 0) assert.equal(fixedCalls, FIXED, `${cap}`);
    if (itemCalls > 0) assert.equal(p.sweepBudget, DEFAULT_SWEEP_CALLS, `${cap}`);
    const planned = p.feeds.map((f) => idx(f.bucket));
    for (let i = 1; i < planned.length; i++) assert.ok(planned[i] >= planned[i - 1]);
  }
  // the items that do fit after the sweep are still the most valuable ones
  const after = buildPlan(rows, { cap: FIXED + DEFAULT_SWEEP_CALLS + 100, today: TODAY });
  assert.equal(after.byBucket.items.feeds, 100);
  assert.deepEqual(after.feeds.filter((f) => f.bucket === "items").map((f) => f.feed), items.slice(0, 100).map((f) => f.feed));
  // EBAY_SWEEP_CALLS sets the share (buildPlan's sweepCalls)
  assert.equal(buildPlan(rows, { cap: 2500, sweepCalls: 100, today: TODAY }).sweepBudget, 100);
});

test("buildPlan: the extension (US$25-50) is bought only after EVERY core key, and never below US$25", () => {
  const core = MANY(20);
  const ext = Array.from({ length: 10 }, (_, i) => planRow("blaster-box", "US", usdCents(25 + i * 2, "US"), { id: `e${i}`, name: `Test Tin Extension ${i}` }));
  const below = [planRow("blaster-box", "US", usdCents(24, "US"), { id: "low", name: "Cheap Tin" })];
  const rows = [...ext, ...below, ...core];
  // the per-product pre-plan on its own (sweepCalls 0), as the run sizes it once the sweep has spent its share
  const p = buildPlan(rows, { cap: FIXED + 20, sweepCalls: 0, today: TODAY });
  assert.equal(p.items.coreCovered, 20);
  assert.equal(p.items.extensionCovered, 0, "the budget ended exactly at the last core key");
  const p2 = buildPlan(rows, { cap: FIXED + 25, sweepCalls: 0, today: TODAY });
  assert.equal(p2.items.extensionCovered, 5);
  const covered = p2.feeds.filter((f) => f.item?.tier === "extension").map((f) => f.item!.productId);
  assert.deepEqual(covered, ["e9", "e8", "e7", "e6", "e5"], "downward by price: the dearest of the extension first");
  const p3 = buildPlan(rows, { cap: 5000, sweepCalls: 0, today: TODAY });
  assert.equal(p3.items.extensionCovered, 10);
  assert.ok(!p3.feeds.some((f) => f.item?.productId === "low"), "never below US$25");
  assert.equal(p3.keys.length, 30);
  // the same order after the sweep's share
  const p4 = buildPlan(rows, { cap: FIXED + DEFAULT_SWEEP_CALLS + 25, today: TODAY });
  assert.equal(p4.items.coreCovered, 20);
  assert.deepEqual(p4.feeds.filter((f) => f.item?.tier === "extension").map((f) => f.item!.productId), ["e9", "e8", "e7", "e6", "e5"]);
  assert.ok(!buildPlan(rows, { cap: 5000, today: TODAY }).feeds.some((f) => f.item?.productId === "low"), "never below US$25");
});

test("buildPlan: --only buckets, and the plan reports what it wanted vs got", () => {
  const rows = MANY(10);
  const p = buildPlan(rows, { cap: 2000, today: TODAY, only: ["items"] });
  assert.equal(p.feeds.length, 10);
  assert.equal(p.byBucket.chase.wanted, 0);
  assert.equal(p.sweepBudget, 0, "the sweep is a bucket like the others: --only items leaves it out");
  assert.equal(p.byBucket.sweep.wanted, 0);
  const q = buildPlan(rows, { cap: 2000, today: TODAY, only: ["chase", "types"] });
  assert.deepEqual([...new Set(q.feeds.map((f) => f.bucket))], ["chase", "types"]);
  assert.equal(q.sweepBudget, 0);
  const sw = buildPlan(rows, { cap: 2000, today: TODAY, only: ["sweep"] });
  const share = Math.min(DEFAULT_SWEEP_CALLS, 2000);
  assert.deepEqual([sw.feeds.length, sw.sweepBudget, sw.calls], [0, share, share], "--only sweep: the sweep alone, within the cap");
  // the per-product pre-plan against the cap (no sweep share): what it wanted vs what it got
  const r = buildPlan(MANY(3000), { cap: 2000, sweepCalls: 0, today: TODAY });
  assert.equal(r.calls, 2000);
  assert.ok(r.byBucket.items.wanted === 3000 && r.byBucket.items.feeds === 2000 - FIXED && r.items.core === 3000 && r.items.coreCovered === 2000 - FIXED);
  const text = capacityReport(r).join("\n");
  assert.match(text, /NOT all core keys fit/);
  assert.match(capacityReport(buildPlan(rows, { cap: 2000, sweepCalls: 0, today: TODAY })).join("\n"), /ALL core keys fit/);
  // with the sweep's default share at the default caps: FIXED + 950 sweep + what is left for the pre-plan
  const d = buildPlan(MANY(3000), { cap: DEFAULT_RUN_CAP, today: TODAY });
  assert.equal(d.calls, DEFAULT_RUN_CAP);
  assert.equal(d.sweepBudget, DEFAULT_SWEEP_CALLS);
  assert.equal(d.byBucket.items.feeds, DEFAULT_RUN_CAP - FIXED - DEFAULT_SWEEP_CALLS);
  assert.equal(d.byBucket.items.wanted, 3000);
  const dt = capacityReport(d).join("\n");
  assert.ok(dt.includes(`| sweep | 5 | 950 | 5 | 950 |`), dt);
  assert.match(dt, /NOT all core keys fit/);
});

// ─── hot sets and priority marketplaces (src/lib/popular.ts) ────────────────────

/** Hot-set products (Reality Fracture, The Hobbit, Avatar, Final Fantasy) in several markets, and some that are not hot. */
function hotRows() {
  return [
    planRow("hobby-pack", "US", 1200, { name: "2025 Topps Chrome Baseball Hobby Pack", productId: "chr-pack" }),
    planRow("hobby-box", "US", 32000, { name: "2025 Topps Chrome Baseball Hobby Box", productId: "chr-box" }),
    planRow("blaster-box", "US", 4500, { name: "2025 Topps Chrome Baseball Blaster Box", productId: "chr-blaster" }),
    planRow("hobby-box", "UK", usdCents(300, "UK"), { name: "2025 Topps Chrome Baseball Hobby Box", productId: "chr-box" }),
    planRow("jumbo-box", "US", 55000, { name: "2025 Bowman Baseball Jumbo Box", productId: "bow-jumbo" }),
    planRow("mega-box", "CA", usdCents(60, "CA"), { name: "2025 Panini Prizm Football Mega Box", productId: "pz-mega" }),
    planRow("blaster-box", "US", 3000, { name: "2025 Panini Prizm Football Blaster Box", productId: "pz-blaster" }),
  ];
}
const feedOf = (k: { marketplace: string; productId: string }) => `${k.marketplace}|item:${k.productId}`;

test("hot keys: none until hot releases are picked (popular.ts HOT_SETS is empty), so nothing jumps the value order", () => {
  assert.deepEqual([...HOT_SETS], []);
  assert.deepEqual([...PRIORITY_MARKETPLACES], ["EBAY_US", "EBAY_GB", "EBAY_DE"]);
  assert.deepEqual(hotItemKeys(hotRows(), TODAY), []);
});

test("per-product searches: every eligible key by value, each one search of its cleaned name with the type's floor", () => {
  const rows = hotRows();
  const feeds = perProductFeeds(rows, undefined, TODAY);
  assert.ok(feeds.every((f) => !f.hot && f.item), "the eligible keys only");
  assert.deepEqual(feeds.map((f) => f.feed), itemKeys(rows).map(feedOf), "in itemKeys' order: core by value, then the extension");
  assert.equal(new Set(feeds.map((f) => f.feed)).size, feeds.length, "each (marketplace, product) once");
  const box = feeds.find((f) => f.feed === "EBAY_US|item:chr-box")!;
  assert.deepEqual(box.searches.map((x) => [x.q, x.limit, x.ref]), [["2025 Topps Chrome Baseball Hobby Box", 50, "wax-us-item"]]);
  assert.equal(box.rule.kind, "item");
  assert.ok(!feeds.some((f) => f.feed.endsWith(":chr-pack")), "a pack is never its own search");
  const plan = buildPlan(rows, { cap: FIXED + 2, sweepCalls: 0, today: TODAY });
  assert.deepEqual(plan.feeds.filter((f) => f.bucket === "items").map((f) => f.feed), feeds.slice(0, 2).map((f) => f.feed));
  assert.equal(plan.items.core + plan.items.extension, itemKeys(rows).length);
});

test("hot coverage: one row per hot set and priority marketplace (none while no release is hot), counts only", () => {
  const rows = hotRows();
  assert.deepEqual(hotCoverage(rows, () => true), []);
  const cov = hotCoverage(rows, (f) => f === "EBAY_US|item:chr-box", ["2025|chrome|baseball"]);
  assert.equal(cov.length, PRIORITY_MARKETPLACES.length);
  const us = cov.find((c) => c.marketplace === "EBAY_US")!;
  assert.deepEqual([us.withFeed, us.products], [1, 3]);
  assert.ok(!cov.some((c) => (c.marketplace as string) === "EBAY_AU"), "the priority marketplaces only");
});

// ─── caps ───────────────────────────────────────────────────────────────────────

test("caps: daily 1400 (clamped 0..1400), run 1400, sweep 950, and the run's allowance is what the database says is left", () => {
  assert.equal(MAX_DAILY_CAP, 1400);
  assert.deepEqual([DEFAULT_DAILY_CAP, DEFAULT_RUN_CAP, DEFAULT_SWEEP_CALLS], [1400, 1400, 950]);
  assert.deepEqual(capsFromEnv({}), { daily: 1400, run: 1400 });
  assert.deepEqual(capsFromEnv({ EBAY_DAILY_CAP: "3000", EBAY_RUN_CAP: "9999" }), { daily: 1400, run: 1400 }, "never above the hard ceiling");
  assert.deepEqual(capsFromEnv({ EBAY_DAILY_CAP: "-5", EBAY_RUN_CAP: "x" }), { daily: 0, run: 1400 });
  assert.deepEqual(capsFromEnv({ EBAY_DAILY_CAP: " 1000 ", EBAY_RUN_CAP: "400" }), { daily: 1000, run: 400 });
  // the sweep's allowance (EBAY_SWEEP_CALLS): default 950, clamped 0..1400; "0" turns the sweep off
  assert.equal(sweepCallsFromEnv({}), 950);
  assert.equal(sweepCallsFromEnv({ EBAY_SWEEP_CALLS: "0" }), 0);
  assert.equal(sweepCallsFromEnv({ EBAY_SWEEP_CALLS: " 600 " }), 600);
  assert.equal(sweepCallsFromEnv({ EBAY_SWEEP_CALLS: "99999" }), 1400);
  assert.equal(sweepCallsFromEnv({ EBAY_SWEEP_CALLS: "-1" }), 0);
  assert.equal(sweepCallsFromEnv({ EBAY_SWEEP_CALLS: "lots" }), 950);
  // the defaults: the whole run cap, bounded by what is left of the day
  assert.equal(runCap(capsFromEnv({}), 0), 1400);
  assert.equal(runCap(capsFromEnv({}), 640), 760);
  assert.equal(runCap(capsFromEnv({}), 2500), 0);
  assert.equal(runCap(capsFromEnv({}), 9999), 0);
  // a run cap below the daily cap (the compliant mode's EBAY_RUN_CAP)
  assert.equal(runCap({ daily: 2400, run: 2000 }, 0), 2000);
  assert.equal(runCap({ daily: 2400, run: 2000 }, 1000), 1400);
  assert.equal(runCap({ daily: 2400, run: 2000 }, 2400), 0);
  assert.equal(runCap({ daily: 2400, run: 2000 }, 2999), 0);
  assert.equal(runCap({ daily: 2400, run: 2000 }, 0, 300), 300);
  assert.equal(runCap({ daily: 2400, run: 2000 }, 0, 5000), 2000);
  assert.equal(retryAllowance(2000), 105);
  assert.equal(retryAllowance(2500), 130);
  assert.equal(hoursToMs(30), purgeCutoff(NOW, {}).getTime() === NOW - hoursToMs(30) ? hoursToMs(30) : -1, "purge: 26 h bound + 4 h");
  assert.equal(purgeCutoff(NOW, { EBAY_LISTING_MAX_AGE_HOURS: "5.5" }).getTime(), NOW - hoursToMs(9.5));
});

// ─── the run ────────────────────────────────────────────────────────────────────

/**
 * A search handler: high-end sealed (collector boxes) for the chase queries, a set's Commander deck set for a set query, nothing a
 * product matches for a sweep query, and the product's own title for any other (sealed, type and item) query; counts searches.
 */
function ebay(over: { onSearch?: (n: number, url: string) => Response | undefined } = {}): { handler: Handler; n: () => number } {
  let n = 0;
  const chase = new Set<string>(CHASE_QUERIES);
  const sweep = new Set(SWEEP_QUERIES.map((x) => x.q));
  const handler: Handler = (url, init) => {
    if (url.includes("/oauth2/token")) return okToken();
    n++;
    const forced = over.onSearch?.(n, url);
    if (forced) return forced;
    const q = new URL(url).searchParams.get("q") ?? "";
    const mp = ((init?.headers ?? {}) as Record<string, string>)["X-EBAY-C-MARKETPLACE-ID"] ?? "EBAY_US";
    const subject = q.replace(/ sealed$/, "");
    const items = chase.has(q)
      ? Array.from({ length: 4 }, (_, i) => summary(`${n}${i}`, `2025 Topps Chrome Baseball Hobby Box Factory Sealed NEW ${i}`, 300 + i * 10, mp))
      : sweep.has(q)
        ? Array.from({ length: 4 }, (_, i) => summary(`${n}${i}`, `Mystery Lot of sports cards ${i}`, 60 + i, mp))
        : /^(?:.+) sealed$/.test(q) && !TYPE_FEEDS.some((t) => q === t.query) && !SEALED_QUERIES.some((x) => q === x)
          ? Array.from({ length: 3 }, (_, i) => summary(`${n}${i}`, `${subject} Hobby Box Sealed NEW ${i}`, 200 + i * 10, mp))
          : Array.from({ length: 3 }, (_, i) => summary(`${n}${i}`, `${subject} Sealed NEW ${i}`, 70 + i * 10, mp));
    return json({ itemSummaries: withReference(items, requestedReference(init)) });
  };
  return { handler, n: () => n };
}

function deps(db: FakeDb, h: ReturnType<typeof harness>, env: ImportDeps["env"] = {}): ImportDeps {
  return { db, api: h.deps, env, log: () => {} };
}

test("run: every search is reserved BEFORE it is made; the database counter equals the searches made", async () => {
  const e = ebay();
  const h = harness(e.handler);
  const db = fakeDb(MANY(40));
  const order: string[] = [];
  const reserve = db.reserve.bind(db);
  db.reserve = async (...a) => (order.push("reserve"), reserve(...a));
  const fetch0 = h.deps.fetch;
  h.deps.fetch = async (u, i) => (u.includes("/item_summary/search") && order.push("search"), fetch0(u, i));
  const s = await runImport(deps(db, h), { concurrency: 1 });
  // the fixed feeds (FIXED), the sweep (every query's first page in each of the 5 marketplaces: the mock's pages are short, so each
  // query ends after one), then one search per eligible key the sweep did not cover (the mock's cards match no product: all 40)
  const sweepCalls = SWEEP_QUERIES.length * MARKETPLACE_ORDER.length;
  const total = FIXED + sweepCalls + 40;
  assert.equal(s.buckets.sweep.calls, sweepCalls);
  assert.equal(s.sweep.length, 5);
  assert.equal(h.searches().length, total);
  assert.equal(s.searches, total);
  assert.equal(db.days.get(s.day), total, "the counter equals the calls made");
  assert.equal(s.usedAfter, total);
  assert.equal(BUCKETS.reduce((a, b) => a + s.buckets[b].calls, 0), total, "every search is counted against its bucket");
  // never a search without its reservation first
  let reserved = 0;
  let searched = 0;
  for (const o of order) {
    if (o === "reserve") reserved++;
    else {
      searched++;
      assert.ok(searched <= reserved, "a search happened before its reservation");
    }
  }
  assert.equal(h.tokens().length, 1);
  assert.equal(db.ensured, 1, "the tables are created if missing");
  assert.ok(s.buckets.chase.refreshed === 5 && s.buckets.sets.refreshed === 5 * setFeedSets(TODAY).length);
  assert.ok(s.buckets.items.refreshed === 40, JSON.stringify(s.buckets.items));
  assert.equal(s.buckets.items.covered, 0);
  assert.ok(db.purges.length >= 2, "purged at the start and at the end");
  // phase order: every fixed feed's search, then the sweep's pages, then the per-product searches
  const kinds = h.searches().map((c) => requestedReference(c.init)!.split("-")[2]);
  const qs = h.searches().map((c) => new URL(c.url).searchParams.get("q") ?? "");
  const sweepQs = new Set(SWEEP_QUERIES.map((x) => x.q));
  const firstSweep = qs.findIndex((q) => sweepQs.has(q));
  assert.equal(firstSweep, FIXED);
  assert.ok(kinds.slice(0, FIXED).every((k) => k !== "item"), "fixed feeds first");
  assert.ok(qs.slice(FIXED, FIXED + sweepCalls).every((q) => sweepQs.has(q)), "then the sweep");
  assert.ok(qs.slice(FIXED + sweepCalls).every((q) => !sweepQs.has(q)) && kinds.slice(FIXED).every((k) => k === "item"), "then the per-product searches");
});

test("run: three overlapping runs and a manual dispatch can never pass the daily cap", async () => {
  const e = ebay();
  const db = fakeDb(MANY(200));
  const env = { EBAY_DAILY_CAP: "500", EBAY_RUN_CAP: "400" };
  const runs = await Promise.all([0, 1, 2, 3].map(() => {
    const h = harness(e.handler);
    return runImport(deps(db, h, env), { concurrency: 3 }).then((s) => ({ s, h }));
  }));
  const day = runs[0].s.day;
  const made = runs.reduce((a, r) => a + r.h.searches().length, 0);
  assert.equal(made, e.n());
  assert.ok(made <= 500, `${made} searches against a 500 cap`);
  assert.equal(db.days.get(day), made, "reservations == calls");
  assert.ok(made >= 450, "the cap is used, not left idle");
  for (const r of runs) assert.ok(r.s.searches <= 400);
  // a later run the same day sees what is left
  const later = harness(e.handler);
  const s = await runImport(deps(db, later, env));
  assert.equal(later.searches().length, 500 - made);
  assert.equal(s.plan.cap, 500 - made);
  // and once it is spent, nothing is called at all
  const none = harness(e.handler);
  await runImport(deps(db, none, env));
  assert.equal(none.searches().length, 0);
  assert.equal(none.tokens().length, 0, "no token is fetched for a run with nothing to do");
});

test("run: the day rolls over in Pacific time, with a fresh counter", async () => {
  const e = ebay();
  const db = fakeDb(MANY(5));
  const h = harness(e.handler);
  const env = { EBAY_DAILY_CAP: "60", EBAY_RUN_CAP: "60" };
  const a = await runImport(deps(db, h, env), { concurrency: 1 });
  assert.equal(a.day, "2026-10-06");
  assert.equal(a.plan.calls, 58, "a feed that does not fit is not bought");
  assert.equal(a.usedAfter, 58);
  h.clock.t = Date.parse("2026-10-07T07:00:01Z"); // midnight Pacific has passed
  const b = await runImport(deps(db, h, env), { concurrency: 1, force: true }); // force: the feeds the first run stored are only minutes old
  assert.equal(b.day, "2026-10-07");
  assert.equal(b.usedBefore, 0);
  assert.equal(b.searches, 58);
  assert.equal(db.days.get("2026-10-06"), 58);
  assert.equal(db.days.get("2026-10-07"), 58);
});

test("run: a 429 stops the whole run, keeps the previous rows, and says so", async () => {
  const e = ebay({ onSearch: (n) => (n >= 30 ? json({ errors: [{ message: "too many" }] }, 429, { "retry-after": "60" }) : undefined) });
  const h = harness(e.handler);
  const db = fakeDb(MANY(40));
  db.feeds.set("EBAY_US|set:reality-fracture", { items: [{ id: "old", title: "old", imageUrl: "https://i.ebayimg.com/x", price: { value: "1.00", currency: "USD" }, url: "https://www.ebay.com/itm/1" }], fetchedAt: new Date(NOW - 3600_000) });
  const s = await runImport(deps(db, h), { concurrency: 3 });
  assert.equal(s.stopped, "rate-limited");
  assert.ok(h.searches().length <= 30 + 3, `${h.searches().length} searches after a 429`);
  assert.equal(db.days.get(s.day), h.searches().length);
  assert.equal(db.feeds.get("EBAY_US|set:reality-fracture")!.items[0].id, "old", "a feed the run never refreshed keeps its rows");
  assert.ok(s.feedsRefreshed < s.feedsPlanned);
  assert.ok(runReport(s).join("\n").includes("rate-limited"));
});

test("run: a token failure stops before any search and reports only eBay's OAuth category", async () => {
  const h = harness((url) => (url.includes("/oauth2/token") ? new Response(JSON.stringify({ error: "invalid_client", error_description: "secret-ish client authentication failed" }), { status: 401 }) : json({})));
  const db = fakeDb(MANY(10));
  const s = await runImport(deps(db, h), {});
  assert.equal(s.stopped, "token");
  assert.equal(s.tokenError, "token-http-401:invalid_client");
  assert.equal(h.searches().length, 0);
  assert.equal(db.days.size, 0, "no budget spent");
  const text = JSON.stringify(s.tokenError) + runReport(s).join("\n");
  assert.ok(!/secret-ish|SECRET|MtgComp-/.test(text));
});

test("run: retries once on a 5xx or a timeout, and once without the price filter on a 400; each retry is reserved", async () => {
  const seen: string[] = [];
  const e = ebay({
    onSearch: (n, url) => {
      seen.push(`${n}:${new URL(url).searchParams.get("filter")?.includes("price:[") ? "price" : "noprice"}`);
      if (n === 1) return json({}, 503);
      if (n === 3) return json({}, 400);
      return undefined;
    },
  });
  const h = harness(e.handler);
  const db = fakeDb(MANY(0));
  const s = await runImport(deps(db, h), { only: ["chase"], concurrency: 1 });
  assert.equal(s.retries, 2);
  assert.equal(h.searches().length, 40 + 2);
  assert.equal(db.days.get(s.day), 42);
  assert.ok(seen[2].endsWith("price") && seen[3].endsWith("noprice"), seen.slice(0, 5).join(" "));
  assert.equal(s.buckets.chase.refreshed, 5);
  // a second 5xx for the same search is a failure of that search only
  const e2 = ebay({ onSearch: (n) => (n <= 2 ? json({}, 500) : undefined) });
  const h2 = harness(e2.handler);
  const s2 = await runImport(deps(fakeDb([]), h2), { only: ["chase"], concurrency: 1 });
  assert.equal(s2.buckets.chase.refreshed, 5, "the feed is still built from its other searches");
  // a network failure also retries once
  let k = 0;
  const h3 = harness((url) => (url.includes("/oauth2/token") ? okToken() : (++k === 1 ? (() => { throw new Error("socket"); })() : ebay().handler(url, undefined, 0))));
  const s3 = await runImport(deps(fakeDb([]), h3), { only: ["chase"], concurrency: 1 });
  assert.equal(s3.retries, 1);
});

// ─── circuit breaker, fresh feeds, stop inside a feed (review F1, F8, SEC-11) ────

test("breaker: a 403 on a search (no Buy API access) stops the run at once and reports only the code", async () => {
  const h = harness((url) => (url.includes("/oauth2/token") ? okToken() : json({ errors: [{ message: "Insufficient permissions to fulfill the request. secret-ish" }] }, 403)));
  const db = fakeDb(MANY(200));
  const s = await runImport(deps(db, h), { concurrency: 3 });
  assert.equal(s.stopped, "forbidden");
  assert.equal(s.tokenError, "search-http-403");
  assert.ok(h.searches().length <= 3, `${h.searches().length} searches after the first refusal (3 workers in flight)`);
  assert.equal(db.days.get(s.day), h.searches().length);
  assert.equal(s.feedsRefreshed, 0);
  assert.ok(!runReport(s).join("\n").includes("secret-ish"));
});

test("breaker: a 401 that survives the token refresh is also 'forbidden'", async () => {
  const h = harness((url) => (url.includes("/oauth2/token") ? okToken() : json({}, 401)));
  const s = await runImport(deps(fakeDb(MANY(50)), h), { concurrency: 1 });
  assert.equal(s.stopped, "forbidden");
  assert.ok(h.searches().length <= 3);
});

test("breaker: 6 searches in a row that fail (400/5xx/malformed/warned-empty) stop the run, with the error category only; a success in between resets the count", async () => {
  assert.equal(BREAKER_FAILURES, 6);
  for (const mode of ["500", "400", "malformed", "warning"] as const) {
    const h = harness((url) => {
      if (url.includes("/oauth2/token")) return okToken();
      if (mode === "malformed") return new Response("<html>not json secret-ish</html>", { status: 200 });
      if (mode === "warning") return json({ total: 0, warnings: [{ errorId: 12006, message: "secret-ish" }] });
      return json({ errors: [{ message: "secret-ish" }] }, Number(mode));
    });
    const db = fakeDb(MANY(300));
    const s = await runImport(deps(db, h), { concurrency: 1 });
    assert.equal(s.stopped, "failing", mode);
    assert.ok(h.searches().length <= BREAKER_FAILURES * 2 + 2, `${mode}: ${h.searches().length} searches`); // each failure may have one retry; far from the run cap
    assert.equal(db.days.get(s.day), h.searches().length, "the counter equals the calls made");
    assert.match(s.tokenError ?? "", /^search-(http-\d+|malformed|warning)$/, "only the error category");
    assert.ok(!runReport(s).join("\n").includes("secret-ish"));
  }
  // alternating failure and success never reaches 6 in a row
  const e = ebay({ onSearch: (n) => (n % 6 !== 0 ? json({ errors: [] }, 404) : undefined) }); // 5 failures, then a success, again and again
  const h2 = harness(e.handler);
  const s2 = await runImport(deps(fakeDb(MANY(0)), h2), { only: ["chase", "sealed", "types"], concurrency: 1 });
  assert.notEqual(s2.stopped, "failing");
  assert.ok(h2.searches().length >= 30, "ran past several cycles of 5 failures");
});

test(`breaker: ${BREAKER_EMPTY} searches in a row with no listings at all stop the run (HTTP 200, nothing in itemSummaries, no warning)`, async () => {
  assert.equal(BREAKER_EMPTY, 30);
  const h = harness((url) => (url.includes("/oauth2/token") ? okToken() : json({ total: 0 })));
  const db = fakeDb(MANY(300));
  const s = await runImport(deps(db, h), { concurrency: 1 });
  assert.equal(s.stopped, "empty");
  assert.equal(h.searches().length, BREAKER_EMPTY);
  assert.equal(db.days.get(s.day), BREAKER_EMPTY);
  // some empties between good answers do not trip it
  const e = ebay({ onSearch: (n) => (n % 3 === 0 ? json({ total: 0 }) : undefined) });
  const s2 = await runImport(deps(fakeDb(MANY(0)), harness(e.handler)), { only: ["chase", "sealed"], concurrency: 1 });
  assert.equal(s2.stopped, null);
});

test("the retry allowance running out is reported as 'retries', not 'cap'", async () => {
  // every 2nd search fails once and succeeds on the retry: retries are 1 per 2 calls, far above the 5% allowance
  let n = 0;
  const e = ebay({ onSearch: () => (++n % 2 === 1 ? json({}, 503) : undefined) });
  const s = await runImport(deps(fakeDb(MANY(0)), harness(e.handler)), { only: ["chase", "sealed", "types"], concurrency: 1 });
  assert.equal(s.stopped, "retries");
});

test("after a 429 no worker starts another search for the feed it is in (chase feeds hold 8 searches)", async () => {
  const e = ebay({ onSearch: (n) => (n === 1 ? json({}, 429, { "retry-after": "60" }) : undefined) });
  const h = harness(e.handler);
  const s = await runImport(deps(fakeDb(MANY(0)), h), { only: ["chase"], concurrency: 3 });
  assert.equal(s.stopped, "rate-limited");
  assert.ok(h.searches().length <= 3 + 2, `${h.searches().length} searches after a 429 on the first`);
});

test("after a 429 in the catalogue sweep no worker starts another search (three in flight at most), even if eBay would answer again", async () => {
  // full pages that keep paging; ONE 429 (the third call), then eBay answers normally again
  let n = 0;
  const h = harness((url, init) => {
    if (url.includes("/oauth2/token")) return okToken();
    n++;
    if (n === 3) return json({ errors: [{ message: "too many" }] }, 429, { "retry-after": "60" });
    const items = Array.from({ length: SWEEP_PAGE }, (_, i) => summary(`p${n}-${i}`, `MTG Test Mega Box Number ${i} Pulled From Collector Booster Box`, 70));
    return json({ total: 100_000, itemSummaries: withReference(items, requestedReference(init)) });
  });
  const db = fakeDb(MANY(40));
  const s = await runImport(deps(db, h), { only: ["sweep", "items"], concurrency: 3 });
  assert.equal(s.stopped, "rate-limited");
  assert.ok(h.searches().length <= 3 + 2, `${h.searches().length} searches after a 429 on the third`);
  assert.equal(db.days.get(s.day), h.searches().length);
  assert.equal(s.buckets.items.calls, 0, "no per-product search after a 429");
});

test("fresh feeds are not bought again (a re-run, an overlapping run, a retry after a crash) unless forced; stale ones are", async () => {
  // Feed by feed: the fixed feeds and the per-product item feeds (EBAY_SWEEP_CALLS=0). The sweep's own freshness is checked below.
  const NOSWEEP = { EBAY_SWEEP_CALLS: "0" };
  const db = fakeDb(MANY(30));
  const e = ebay();
  const first = await runImport(deps(db, harness(e.handler), NOSWEEP), { concurrency: 3 });
  assert.equal(first.searches, FIXED + 30);
  assert.equal(first.buckets.sweep.calls, 0);
  // the same instant again: every feed that has rows is fresh and is not bought again (only feeds that came back empty are tried again)
  const h2 = harness(e.handler);
  const again = await runImport(deps(db, h2, NOSWEEP), { concurrency: 3 });
  const stored = first.buckets.chase.refreshed + first.buckets.sealed.refreshed + first.buckets.types.refreshed + first.buckets.sets.refreshed + first.buckets.items.refreshed;
  assert.equal(again.buckets.chase.fresh, 5);
  assert.equal(again.buckets.items.fresh, 30);
  assert.equal(again.buckets.items.refreshed, 0);
  assert.equal(again.buckets.chase.refreshed, 0);
  assert.ok(h2.searches().length < FIXED + 30 && stored >= 30, `${h2.searches().length} searches the second time, ${stored} feeds stored the first`);
  assert.equal(again.plan.items.coreCovered, again.plan.items.core, "fresh item feeds still count as covered");
  assert.ok(runReport(again).join("\n").includes("Fresh (not bought)"));
  assert.ok(h2.searches().every((c) => requestedReference(c.init) !== "wax-us-item"), "no item feed bought again");
  // forced: everything again
  const h3 = harness(e.handler);
  await runImport(deps(db, h3, NOSWEEP), { concurrency: 3, force: true });
  assert.equal(h3.searches().length, FIXED + 30);
  // the window is 2 hours (a quarter of the bound at most): 1.9 h on a feed is still fresh, 2.1 h on it is bought again
  assert.equal(freshWindowMs({}), hoursToMs(2));
  assert.equal(freshWindowMs({ EBAY_LISTING_MAX_AGE_HOURS: "5.5" }), hoursToMs(1.375), "compliant mode: a quarter of 5.5 h");
  assert.equal(freshWindowMs({ EBAY_LISTING_MAX_AGE_HOURS: "72" }), hoursToMs(2), "never more than 2 h");
  const h3b = harness(e.handler);
  h3b.clock.t = NOW + 1.9 * 3600_000;
  const soon = await runImport(deps(db, h3b, NOSWEEP), { concurrency: 3 });
  assert.equal(soon.buckets.chase.fresh, 5);
  assert.equal(soon.buckets.items.fresh, 30);
  assert.ok(h3b.searches().length < FIXED + 30, "an accidental re-dispatch within 2 h re-buys nothing that has rows");
  const h4 = harness(e.handler);
  h4.clock.t = NOW + 3 * 3600_000 + 1;
  db.feeds.forEach((v) => (v.fetchedAt = new Date(NOW))); // as the forced run left them
  const later = await runImport(deps(db, h4, NOSWEEP), { concurrency: 3 });
  assert.equal(h4.searches().length, FIXED + 30);
  assert.equal(later.buckets.chase.fresh, 0);
  // a feed fresher than the share is skipped and the budget goes further down the plan instead
  const hourOld = () => ({ items: [{ id: "o", title: "o", imageUrl: "https://i.ebayimg.com/x", price: { value: "1.00", currency: "USD" }, url: "https://www.ebay.com/itm/1" }], fetchedAt: new Date(NOW - 3600_000) });
  const db2 = fakeDb(MANY(30));
  for (const f of fixedFeeds(TODAY)) db2.feeds.set(f.feed, hourOld());
  const h5 = harness(e.handler);
  const s5 = await runImport(deps(db2, h5, { EBAY_RUN_CAP: "20", ...NOSWEEP }), { concurrency: 1 });
  // the per-product phase holds back its own retry allowance from what is left of the run cap
  assert.equal(s5.buckets.items.refreshed, 20 - retryAllowance(20), "the cap is spent on item feeds, not on feeds that are an hour old");
  assert.equal(s5.buckets.chase.refreshed, 0);
  assert.ok(h5.searches().length <= 20 && h5.searches().every((c) => requestedReference(c.init)!.endsWith("-item")), "every search an item search");
  // with the sweep (the default), the same cap goes to the sweep first, never to the hour-old fixed feeds
  const db2b = fakeDb(MANY(30));
  for (const f of fixedFeeds(TODAY)) db2b.feeds.set(f.feed, hourOld());
  const h5b = harness(e.handler);
  const s5b = await runImport(deps(db2b, h5b, { EBAY_RUN_CAP: "20" }), { concurrency: 1 });
  assert.equal(s5b.plan.sweepBudget, 20);
  assert.ok(s5b.buckets.sweep.calls > 0 && h5b.searches().length <= 20, `${h5b.searches().length}`);
  assert.equal(s5b.buckets.chase.calls + s5b.buckets.sealed.calls + s5b.buckets.types.calls + s5b.buckets.sets.calls, 0);
  assert.equal(s5b.buckets.chase.fresh, 5);

  // The sweep: a marketplace whose item feeds are fresh (a re-dispatch after a run that swept it) is not swept again unless forced;
  // and the per-product searches skip those fresh feeds too. 60 US products, every one with an hour-old item feed.
  const usRows = Array.from({ length: 60 }, (_, i) => planRow("mega-box", "US", usdCents(60 + i, "US"), { id: `u${String(i).padStart(2, "0")}`, name: `Fresh Test Collection ${i}` }));
  const db4 = fakeDb(usRows);
  for (const r of usRows) db4.feeds.set(`EBAY_US|item:${r.productId}`, hourOld());
  const h7 = harness(e.handler);
  const s7 = await runImport(deps(db4, h7), { concurrency: 3 });
  assert.equal(s7.buckets.sweep.fresh, 1);
  assert.equal(s7.buckets.sweep.planned, 0);
  assert.equal(s7.buckets.sweep.calls, 0, "the marketplace is not swept again");
  assert.equal(s7.buckets.items.fresh, 60);
  assert.equal(s7.buckets.items.calls, 0, "nor its fresh item feeds searched one by one");
  assert.equal(h7.searches().length, FIXED, "only the fixed feeds, which had no rows");
  // forced: swept again (one page per query: the mock's pages are short), and every item feed bought again
  const h8 = harness(e.handler);
  const s8 = await runImport(deps(db4, h8), { concurrency: 3, force: true });
  assert.equal(s8.buckets.sweep.fresh, 0);
  assert.equal(s8.buckets.sweep.calls, SWEEP_QUERIES.length);
  assert.equal(h8.searches().length, FIXED + SWEEP_QUERIES.length + 60);
  // stale (older than the window): swept again without forcing
  const h9 = harness(e.handler);
  h9.clock.t = NOW + 3 * 3600_000;
  const s9 = await runImport(deps(db4, h9), { concurrency: 3 });
  assert.equal(s9.buckets.sweep.fresh, 0);
  assert.equal(s9.buckets.sweep.calls, SWEEP_QUERIES.length);
  // compliant mode (bound 5.5 h): the window is 1.4 h, so a 4-hourly run always buys again
  const db3 = fakeDb(MANY(0));
  await runImport(deps(db3, harness(e.handler)), { only: ["chase"], concurrency: 3 });
  const h6 = harness(e.handler);
  h6.clock.t = NOW + 4 * 3600_000;
  const s6 = await runImport(deps(db3, h6, { EBAY_LISTING_MAX_AGE_HOURS: "5.5" }), { only: ["chase"], concurrency: 3 });
  assert.equal(s6.buckets.chase.fresh, 0);
  assert.equal(s6.buckets.chase.refreshed, 5);
});

test("strict caps: EBAY_RUN_CAP and --max-calls bound the searches of a run INCLUDING retries; three workers never overshoot", async () => {
  // --max-calls 10 against a mock that fails every search once: retries come out of the 10, not on top of it
  const flaky = () => {
    let n = 0;
    return ebay({ onSearch: () => (++n % 2 === 1 ? json({}, 503) : undefined) });
  };
  for (const concurrency of [1, 3]) {
    const h = harness(flaky().handler);
    const db = fakeDb(MANY(0));
    const s = await runImport(deps(db, h), { only: ["chase"], maxCalls: 10, concurrency });
    assert.ok(h.searches().length <= 10, `concurrency ${concurrency}: ${h.searches().length} searches under --max-calls 10`);
    assert.equal(s.searches, h.searches().length);
    assert.equal(db.days.get(s.day), h.searches().length, "the counter equals the calls made");
  }
  // EBAY_RUN_CAP=50 with every 5th search failing once: exactly 50 searches, retries included
  let k = 0;
  const e = ebay({ onSearch: () => (++k % 5 === 0 ? json({}, 500) : undefined) });
  for (const concurrency of [1, 3]) {
    k = 0;
    const h = harness(e.handler);
    const s = await runImport(deps(fakeDb(MANY(100)), h, { EBAY_RUN_CAP: "50" }), { concurrency });
    assert.ok(h.searches().length <= 50, `concurrency ${concurrency}: ${h.searches().length} searches under EBAY_RUN_CAP=50`);
    assert.equal(s.plan.cap, 50);
    assert.ok(s.stopped === "cap" || s.stopped === "retries", String(s.stopped)); // whichever bound is reached first
    assert.equal(s.searches, h.searches().length);
  }
  // the repeat after a 401 is inside the cap too
  const h401 = harness((url, init) => {
    if (url.includes("/oauth2/token")) return okToken();
    return json({}, 401);
  });
  const s401 = await runImport(deps(fakeDb(MANY(0)), h401), { only: ["chase"], maxCalls: 4, concurrency: 1 });
  assert.ok(h401.searches().length <= 4);
  void s401;
});

test("the importer says what it will do with today's budget BEFORE the first search, and logs its running total against the caps", async () => {
  const lines: string[] = [];
  const e = ebay();
  const db = fakeDb(MANY(300)); // enough products that the per-product searches fill what the sweep leaves
  const day = budgetDay(NOW);
  db.days.set(day, 640); // a manual run earlier in the Pacific day
  const h = harness(e.handler);
  const first = { searched: false };
  const fetch0 = h.deps.fetch;
  h.deps.fetch = async (u, i) => {
    if (u.includes("/item_summary/search") && !first.searched) {
      first.searched = true;
      assert.ok(lines.some((l) => /Budget day 2026-10-0\d/.test(l)), "the budget was printed before the first search");
    }
    return fetch0(u, i);
  };
  const s = await runImport({ db, api: h.deps, env: {}, log: (l) => lines.push(l) }, { concurrency: 3, maxCalls: 300 });
  const text = lines.join("\n");
  assert.match(text, /Budget day \d{4}-\d{2}-\d{2} \(the Pacific day/);
  assert.match(text, /reserved so far today: 640 of the 1,400 daily cap \(760 left\)/);
  assert.match(text, /at most 300 searches, retries included \(the smallest of: run cap 1,400, 760 left of today's 1,400, --max-calls 300\)/);
  assert.match(text, /Plan: \d+ feeds in 300 searches \(chase 5 feeds\/40 calls/);
  // 300 - FIXED fixed for the sweep; nothing left for per-product searches
  assert.match(text, new RegExp(`sweep up to ${300 - FIXED} calls over 5 marketplaces, items: whatever the sweep leaves`));
  assert.match(text, /stops early on a 429, a 401\/403 on a search, 6 failed searches in a row, or 30 with no listings in a row/);
  assert.match(text, /another application on the same eBay keyset is invisible/);
  assert.ok(!/SECRET|MtgComp-|Bearer/.test(text));
  // the run spends close to its cap (44 distinct product names: repeats share a search) and reserves exactly what it spent
  assert.ok(s.searches > 250 && s.searches <= 300, String(s.searches));
  assert.equal(db.days.get(day), 640 + s.searches);
  // the running total against the caps, every PROGRESS_EVERY searches
  assert.equal(PROGRESS_EVERY, 250);
  const progress = lines.filter((l) => l.startsWith("progress:"));
  assert.equal(progress.length, 1);
  assert.match(progress[0], /^progress: 250 searches this run \(\d+ retries, run cap 300\); 890 of the 1,400 daily cap used today; \d+ feeds refreshed\.$/);
  // the sweep logs counts per marketplace, nothing else
  const sweepLines = lines.filter((l) => l.startsWith("sweep "));
  assert.equal(sweepLines.length, 5);
  for (const l of sweepLines) assert.match(l, /^sweep EBAY_[A-Z]{2}: \d+ pages \(\d+ on the hot sets\), \d+ listings matched to \d+ of \d+ products; \d+ item feeds written\.$/);
  assert.deepEqual(sweepLines.map((l) => l.split(":")[0].slice(6)), [...MARKETPLACE_ORDER], "swept in the priority order: US, UK, EU, then AU and CA");
  assert.ok(lines.some((l) => l.startsWith("Priorities (src/lib/popular.ts): marketplaces in the order EBAY_US, EBAY_GB, EBAY_DE, EBAY_AU, EBAY_CA; no hot sets yet")));
  // nothing left today: it says so
  const spent = fakeDb(MANY(10));
  spent.days.set(day, 2500);
  const lines2: string[] = [];
  const s2 = await runImport({ db: spent, api: harness(e.handler).deps, env: {}, log: (l) => lines2.push(l) }, {});
  assert.equal(s2.searches, 0);
  assert.match(lines2.join("\n"), /at most 0 searches.*Nothing to do: the budget for today is spent/);
  // a dry run prints the same, and is marked
  const lines3: string[] = [];
  await runImport({ db: fakeDb(MANY(10)), api: harness(e.handler).deps, env: {}, log: (l) => lines3.push(l) }, { dryRun: true });
  assert.match(lines3[0], /^DRY RUN \(no eBay call, no database write\)\. Budget day/);
  assert.equal(startReport(s2, { force: true, freshMs: hoursToMs(2) }).join("\n").includes("--force"), true);
});

test("each feed asks eBay for its own affiliateReferenceId (wax-<market>-<kind>) and the stored links keep eBay's URL as returned", async () => {
  const refs = new Map<string, Set<string>>();
  const e = ebay();
  const h = harness((url, init) => {
    if (!url.includes("/item_summary/search")) return e.handler(url, init, 0);
    const hd = init?.headers as Record<string, string>;
    const set = refs.get(hd["X-EBAY-C-MARKETPLACE-ID"]) ?? new Set<string>();
    set.add(requestedReference(init)!);
    refs.set(hd["X-EBAY-C-MARKETPLACE-ID"], set);
    return e.handler(url, init, 0);
  });
  const db = fakeDb(MANY(40));
  await runImport(deps(db, h), { concurrency: 1 });
  // (a set feed's reference, wax-<market>-set, appears once releases are discovered)
  const sets = setFeedSets(TODAY).length ? ["set"] : [];
  assert.deepEqual([...(refs.get("EBAY_US") ?? [])].sort(), ["chase", "item", "sealed", ...sets, "type"].map((k) => `wax-us-${k}`).sort());
  assert.deepEqual([...(refs.get("EBAY_AU") ?? [])].sort(), ["chase", "sealed", ...sets, "type"].map((k) => `wax-au-${k}`).concat(refs.get("EBAY_AU")?.has("wax-au-item") ? ["wax-au-item"] : []).sort());
  for (const [feed, v] of db.feeds) {
    const kind = feed.split("|")[1].split(":")[0];
    const mp = { EBAY_US: "us", EBAY_AU: "au", EBAY_GB: "uk", EBAY_CA: "ca", EBAY_DE: "eu" }[feed.split("|")[0] as "EBAY_US"];
    for (const it of v.items) assert.equal(new URL(it.url).searchParams.get("customid"), `wax-${mp}-${kind}`, `${feed}: the URL is eBay's, with the feed's sub-id`);
  }
  assert.ok(db.feeds.size > 40, String(db.feeds.size)); // the fixed feeds with listings, plus the products' item feeds
});

test("replaceFeed's advisory lock and UTC timestamps are in the SQL (source check: the SQL itself runs against Postgres in the verification)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/lib/ebay-store.ts", import.meta.url), "utf8");
  assert.match(src, /pg_advisory_xact_lock\(hashtext\(\$\{feed\}\)\)/);
  assert.equal((src.match(/utcTimestamp\(/g) ?? []).length >= 2, true);
  const t = (await import("../src/lib/pg-time")).utcTimestamp(new Date("2026-10-07T06:37:00Z"));
  assert.match(t.sql, /::timestamptz AT TIME ZONE 'UTC'/);
  assert.deepEqual(t.values, ["2026-10-07T06:37:00.000Z"]);
});

test("run: a feed's rows are REPLACED (never appended); an empty or failed refresh keeps the old rows; a refresh failure of one feed does not stop the rest", async () => {
  const rows = [planRow("mega-box", "US", 6000, { id: "bun-us", name: "2025 Topps Chrome Baseball Mega Box" }), planRow("mega-box", "US", 7000, { id: "bun-none", name: "2025 Panini Prizm Football Mega Box" })];
  const db = fakeDb(rows);
  const old = (id: string) => ({ items: [{ id, title: "old", imageUrl: "https://i.ebayimg.com/x", price: { value: "1.00", currency: "USD" }, url: "https://www.ebay.com/itm/1" }], fetchedAt: new Date(NOW - 20 * 3600_000) });
  db.feeds.set("EBAY_US|item:bun-us", old("a"));
  db.feeds.set("EBAY_US|item:bun-none", old("b"));
  const handler: Handler = (url) => {
    if (url.includes("/oauth2/token")) return okToken();
    const q = new URL(url).searchParams.get("q") ?? "";
    if (q.includes("Prizm")) return json({ itemSummaries: [summary("1", "2025 Panini Prizm Football Mega Box Japanese", 80), summary("2", "2025 Panini Prizm Football Mega Box EMPTY box", 80)] }); // nothing relevant
    return json({ itemSummaries: [summary("11", "2025 Topps Chrome Baseball Mega Box Factory Sealed", 90), summary("12", "2025 Topps Chrome Baseball Mega Box NEW", 70)] });
  };
  const h = harness(handler);
  const s = await runImport(deps(db, h), { only: ["items"], concurrency: 1 });
  const fresh = db.feeds.get("EBAY_US|item:bun-us")!;
  assert.deepEqual(fresh.items.map((i) => i.price.value), ["70.00", "90.00"], "replaced, lowest price first");
  assert.equal(fresh.fetchedAt.getTime(), NOW);
  assert.equal(db.feeds.get("EBAY_US|item:bun-none")!.items[0].id, "b", "an empty result keeps the old rows");
  assert.equal(s.buckets.items.emptied, 1);
  assert.equal(s.buckets.items.refreshed, 1);
  // every search of a feed failing keeps the rows too
  const h2 = harness((url) => (url.includes("/oauth2/token") ? okToken() : json({}, 500)));
  const db2 = fakeDb(rows);
  db2.feeds.set("EBAY_US|item:bun-us", old("a"));
  const s2 = await runImport(deps(db2, h2), { only: ["items"], concurrency: 1 });
  assert.equal(db2.feeds.get("EBAY_US|item:bun-us")!.items[0].id, "a");
  assert.equal(s2.buckets.items.failed, 2);
  // a database failure on one feed is that feed's failure only
  const db3 = fakeDb(rows, { failReplace: (f) => f.includes("bun-us") });
  const e3 = ebay();
  const s3 = await runImport(deps(db3, harness(e3.handler)), { only: ["items"], concurrency: 1 });
  assert.equal(s3.buckets.items.failed, 1);
});

test("run: the purge deletes rows older than the bound + 4 h (26 + 4 by default, 5.5 + 4 in compliant mode), at the start and the end", async () => {
  const mk = (ageH: number) => ({ items: [{ id: "x", title: "x", imageUrl: "https://i.ebayimg.com/x", price: { value: "1.00", currency: "USD" }, url: "https://www.ebay.com/itm/1" }], fetchedAt: new Date(NOW - ageH * 3600_000) });
  const db = fakeDb([]);
  db.feeds.set("old", mk(31));
  db.feeds.set("edge", mk(29));
  db.feeds.set("fresh", mk(2));
  const s = await runImport(deps(db, harness(ebay().handler)), { dryRun: false, only: ["chase"], maxCalls: 0 });
  assert.ok(!db.feeds.has("old") && db.feeds.has("edge") && db.feeds.has("fresh"));
  assert.equal(s.purged, 1);
  const strict = fakeDb([]);
  strict.feeds.set("a", mk(10));
  strict.feeds.set("b", mk(9));
  await runImport(deps(strict, harness(ebay().handler), { EBAY_LISTING_MAX_AGE_HOURS: "5.5" }), { maxCalls: 0 });
  assert.ok(!strict.feeds.has("a") && strict.feeds.has("b"));
  assert.ok(strict.purges.every((c) => c.getTime() === NOW - hoursToMs(9.5)));
});

test("run: a dry run makes no call and writes nothing", async () => {
  const e = ebay();
  const h = harness(e.handler);
  const db = fakeDb(MANY(30));
  const s = await runImport(deps(db, h), { dryRun: true });
  assert.equal(h.calls.length, 0);
  assert.equal(db.ensured, 0);
  assert.equal(db.purges.length, 0);
  assert.equal(db.days.size, 0);
  assert.equal(db.feeds.size, 0);
  assert.equal(db.replaced.length, 0);
  // the plan it prints: the fixed feeds, the sweep's share and the per-product pre-plan
  assert.equal(s.plan.sweepBudget, DEFAULT_SWEEP_CALLS);
  assert.equal(s.plan.calls, FIXED + DEFAULT_SWEEP_CALLS + 30);
  assert.equal(s.searches, 0);
  assert.deepEqual(s.sweep, []);
  assert.ok(runReport(s).join("\n").startsWith("DRY RUN"));
  // the same without the sweep (EBAY_SWEEP_CALLS=0)
  const h2 = harness(e.handler);
  const s2 = await runImport(deps(fakeDb(MANY(30)), h2, { EBAY_SWEEP_CALLS: "0" }), { dryRun: true });
  assert.equal(h2.calls.length, 0);
  assert.equal(s2.plan.calls, FIXED + 30);
});

test("selectFeedItems: each rule keeps what it should, and an item feed keeps 8 at most", () => {
  const feed = (kind: "item" | "chase") => ({ ...fixedFeeds(TODAY)[0], rule: kind === "chase" ? { kind: "chase" as const } : { kind: "item" as const, target: { groupKey: "2025|chrome|baseball|blaster-box", type: "blaster-box" as const, setCode: "2025|chrome|baseball" } }, marketplace: "EBAY_US" as const });
  const bundles = Array.from({ length: 20 }, (_, i) => summary(String(i), "2025 Topps Chrome Baseball Blaster Box Factory Sealed", 100 - i));
  const out = selectFeedItems(feed("item"), [bundles], NOW);
  assert.equal(out.length, 8);
  assert.deepEqual(out.map((o) => Number(o.price.value)), [81, 82, 83, 84, 85, 86, 87, 88]);
  assert.deepEqual(selectFeedItems(feed("chase"), [bundles], NOW), [], "a blaster is sealed, but not high-end");
  assert.deepEqual(selectFeedItems(feed("item"), [], NOW), []);
});

test("reports: counts and ages only, no titles or prices", async () => {
  const e = ebay();
  const s = await runImport(deps(fakeDb(MANY(20)), harness(e.handler)), { only: ["chase", "sweep", "items"] });
  const text = runReport(s).join("\n");
  assert.match(text, /Calls today: \d+/);
  assert.match(text, /Oldest row/);
  assert.match(text, /Item feeds in the database/);
  assert.match(text, /\| Sweep \| Products \| Pages \|/, "the sweep's table is in the report");
  assert.ok(s.sweep.length > 0);
  assert.ok(!/Special Illustration|A\$|US\$|\$\d/.test(text.replace(/US\$\d+/g, "")));
  assert.match(text, /No hot sets yet \(src\/lib\/popular\.ts HOT_SETS\)/, "the report says there is no hot pass");
});

test("run: with no hot sets the sweep has no hot pass, and the products it missed are searched one by one in value order; the report counts only", async () => {
  const rows = hotRows();
  const db = fakeDb(rows);
  let n = 0;
  const h = harness((url, init) => {
    if (url.includes("/oauth2/token")) return okToken(n);
    n++;
    h.clock.t += 60_000;
    const mp = ((init?.headers ?? {}) as Record<string, string>)["X-EBAY-C-MARKETPLACE-ID"];
    // one single card pulled from a box, which no product takes
    return json({ total: 1, itemSummaries: withReference([summary(`c${n}`, "2025 Topps Chrome Baseball Rookie Auto Pulled From Hobby Box", 50, mp)], requestedReference(init)) });
  });
  const s = await runImport(deps(db, h, { EBAY_SWEEP_CALLS: "300" }), { only: ["sweep", "items"], concurrency: 1 });
  assert.equal(s.stopped, null);
  const calls = h.searches().map((c) => {
    const u = new URL(c.url);
    return { q: u.searchParams.get("q")!, mp: ((c.init?.headers ?? {}) as Record<string, string>)["X-EBAY-C-MARKETPLACE-ID"], limit: u.searchParams.get("limit") };
  });
  assert.deepEqual(hotSweepQueries(rows, TODAY), []);
  const sweep = calls.filter((c) => c.limit === "200");
  // only the marketplaces the rows list (US, UK, CA), in the priority order
  assert.deepEqual([...new Set(sweep.map((c) => c.mp))], MARKETPLACE_ORDER.filter((mp) => ["EBAY_US", "EBAY_GB", "EBAY_CA"].includes(mp)));
  assert.ok(s.sweep.every((m) => m.hotPages === 0 && m.hotQueries.length === 0));
  const perProduct = calls.filter((c) => c.limit === "50").map((c) => `${c.mp} ${c.q}`);
  // Canadian products first (CANADA_ITEMS_FIRST), then the value order
  assert.deepEqual(perProduct, canadaFirst(perProductFeeds(rows, undefined, TODAY)).map((f) => `${f.marketplace} ${f.searches[0].q}`));
  assert.deepEqual(s.hotItems, { keys: 0, fresh: 0, covered: 0, searched: 0, refreshed: 0 });
  assert.equal(db.days.get(s.day), h.searches().length);
  assert.equal(s.buckets.sweep.calls + s.buckets.items.calls, h.searches().length);
  const text = runReport(s).join("\n");
  assert.match(text, /No hot sets yet/);
  assert.ok(!/Pulled|Rookie|\$\d|£|€|50\.00/.test(text), text);
});

test("DEPLOY.md says what the owner must know: both prongs of 8.1(c), the whole switch, the shared keyset, the reporting granularity", async () => {
  const { readFileSync } = await import("node:fs");
  const doc = readFileSync(new URL("../DEPLOY.md", import.meta.url), "utf8");
  const wf = readFileSync(new URL("../.github/workflows/ebay-import.yml", import.meta.url), "utf8");
  // both prongs of the Age clause, quoted, with the section as the live agreement numbers it
  for (const needle of ["8.1(c)", "Age of Displayed eBay Content", "six (6) hours older than information displayed on the eBay Site", "twenty-four (24) hours older than content displayed on the eBay Site", "how much older your displayed item listing is", "8.1(b)(1)", "3.1(b)"]) assert.ok(doc.includes(needle), `DEPLOY.md quotes ${needle}`);
  // the switch: cron + the age variable (GitHub and Vercel) + the run cap; the copy follows by itself
  for (const needle of ['"37 8 * * *"', '"13 */4 * * *"', "EBAY_LISTING_MAX_AGE_HOURS=5.5", "EBAY_RUN_CAP", "380", "follows the bound by itself"]) assert.ok(doc.includes(needle), `DEPLOY.md's switch says ${needle}`);
  assert.ok(wf.includes('cron: "37 8 * * *"') && wf.includes("13 */4 * * *") && wf.includes("EBAY_RUN_CAP = 380"));
  // the shared keyset, prominently (before the first subsection), with both remedies
  const head = doc.slice(doc.indexOf("## eBay listings: the daily import"), doc.indexOf("### Why daily"));
  assert.match(head, /READ THIS FIRST/);
  assert.match(head, /separate eBay application/);
  assert.match(head, /EBAY_DAILY_CAP/);
  assert.match(head, /BOTH sites/);
  // what EPN reports for listing tiles
  for (const needle of ["wax-us-chase", "wax-au-item", "affiliateReferenceId", "exactly as returned"]) assert.ok(doc.includes(needle), `DEPLOY.md explains ${needle}`);
  // the numbers the code enforces appear in the doc as they are
  assert.ok(doc.includes(`**${BREAKER_FAILURES} searches in a row that fail**`) && doc.includes(`${BREAKER_EMPTY} in a row that come back with no listings`));
  assert.ok(doc.includes("less than 2 hours old") && doc.includes("strict upper bound"));
});

test("exit check: a per-product search that completed with no listing is finished work, not a shortfall (2026-11-01/02)", () => {
  // The 2026-11-02 run: 454 planned, 270 of them per-product searches; 18 of those found listings and 252 answered with none.
  assert.equal(feedsShortfall({ feedsPlanned: 454, feedsRefreshed: 208, feedsEmpty: 252 }), false);
  // Failed or unfinished searches still fail the job, and so does a run whose fixed feeds came back empty (feedsEmpty counts items only).
  assert.equal(feedsShortfall({ feedsPlanned: 454, feedsRefreshed: 208, feedsEmpty: 0 }), true);
  assert.equal(feedsShortfall({ feedsPlanned: 0, feedsRefreshed: 0, feedsEmpty: 0 }), false);
});

test("region split (owner, 2026-11-10): the UK, EU and AU sweeps stop at 20 pages; the freed calls go to Canadian products first", () => {
  assert.equal(SWEEP_CEILING.EBAY_US, undefined, "the US sweep has no ceiling");
  assert.equal(SWEEP_CEILING.EBAY_CA, undefined, "nor Canada's");
  assert.deepEqual(SWEEP_CEILING, { EBAY_GB: 20, EBAY_DE: 20, EBAY_AU: 20 });
  assert.equal(CANADA_ITEMS_FIRST, 113, "the 173 - 3 x 20 calls freed from the sweep");
  const f = (feed: string) => ({ feed });
  const order = canadaFirst([f("EBAY_US|item:a"), f("EBAY_CA|item:b"), f("EBAY_GB|item:c"), f("EBAY_CA|item:d"), f("EBAY_US|item:e"), f("EBAY_CA|item:g")], 2);
  assert.deepEqual(order.map((x) => x.feed), ["EBAY_CA|item:b", "EBAY_CA|item:d", "EBAY_US|item:a", "EBAY_GB|item:c", "EBAY_US|item:e", "EBAY_CA|item:g"], "at most n Canadian first, then the usual order (US first)");
  assert.deepEqual(canadaFirst([f("EBAY_US|item:a")]).map((x) => x.feed), ["EBAY_US|item:a"]);
});
