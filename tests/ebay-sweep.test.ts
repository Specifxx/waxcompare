import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSearchUrl, type SearchSpec } from "../src/lib/ebay-api";
import { runImport } from "../src/lib/ebay-import";
import { typeFloor } from "../src/lib/ebay-normalise";
import {
  buildSweepIndex,
  HOT_SHARE,
  HOT_TYPE_QUERY,
  hotSetWords,
  hotSweepQueries,
  isFiller,
  marketplaceShares,
  matchListing,
  setWordsIn,
  SWEEP_PAGE,
  SWEEP_QUERIES,
  SweepCollector,
  sweepMarketplace,
  sweepSignatureSets,
  sweepSpec,
  sweepVocabulary,
  sweepWithHot,
} from "../src/lib/ebay-sweep";
import type { PlanRow } from "../src/lib/ebay-store";
import { HOT_SET_QUERY, HOT_SETS } from "../src/lib/popular";
import { PRODUCT_TYPES } from "../src/lib/sealed-title";
import { fakeDb, harness, json, NOW, okToken, planRow, requestedReference, summary, withReference } from "./helpers/ebay-fakes";

// A small catalogue, as the store import files it (the real classifier makes the group keys). A sports product's identity is its
// release (year, line, sport) and its type, all in the group key: the sweep matches a listing by that key or not at all.
function catalogue(): PlanRow[] {
  return [
    planRow("hobby-box", "US", 32000, { name: "2025 Topps Chrome Baseball Hobby Box", productId: "hb" }),
    planRow("jumbo-box", "US", 55000, { name: "2025 Topps Chrome Baseball Jumbo Box", productId: "jb" }),
    planRow("blaster-box", "US", 4500, { name: "2025 Topps Chrome Baseball Blaster Box", productId: "bl" }),
    planRow("hobby-pack", "US", 1200, { name: "2025 Topps Chrome Baseball Hobby Pack", productId: "pack" }),
    planRow("hobby-box", "US", 70000, { name: "2025 Topps Chrome Sapphire Baseball Hobby Box", productId: "saph" }),
    planRow("hobby-box", "US", 60000, { name: "2025 Panini Prizm Football Hobby Box", productId: "pz" }),
    planRow("hobby-case", "US", 380000, { name: "2025 Topps Chrome Baseball Hobby Case", productId: "case" }),
    planRow("hobby-box", "AU", 50000, { name: "2025 Topps Chrome Baseball Hobby Box", productId: "hb" }),
  ];
}

const usIndex = () => {
  const rows = catalogue();
  return buildSweepIndex(rows, "EBAY_US", sweepVocabulary(rows));
};
const hit = (title: string) => {
  const m = matchListing(title, usIndex());
  return "product" in m ? m.product.productId : m.miss;
};
const CHROME = "2025|chrome|baseball";

test("sweep matching: a product by its release and type, whatever the seller adds", () => {
  assert.equal(hit("2025 Topps Chrome Baseball Hobby Box Factory Sealed FAST SHIP"), "hb");
  assert.equal(hit("IN HAND 2025 Topps Chrome Baseball Hobby Box"), "hb");
  assert.equal(hit("2025 Topps Chrome Baseball Hobby Box (20 Packs) Factory Sealed"), "hb", "a box's own pack count is not a lot");
  assert.equal(hit("2025 Topps Chrome Sapphire Edition Baseball Hobby Box"), "saph", "Sapphire is its own release");
  assert.equal(hit("2025 Panini Prizm Football Hobby Box Sealed"), "pz");
  assert.equal(hit("2025 Topps Chrome Baseball Hobby Pack"), "pack");
  assert.equal(hit("2025 Topps Chrome Baseball Hobby Case 12 Boxes"), "case", "a case's own contents");
});

test("sweep matching: another year, sport or type is another product, never this one", () => {
  assert.equal(hit("2025 Topps Chrome Baseball Mega Box"), "no-product", "a type this marketplace does not list");
  assert.equal(hit("2024 Topps Chrome Baseball Hobby Box"), "no-product", "last year's box");
  assert.equal(hit("2025 Topps Chrome Football Hobby Box"), "no-product", "another sport");
});

test("sweep matching: breaks, repacks, lots, several units, foreign editions, damage, pre-sales and titles without a year are never handed to a product", () => {
  for (const t of [
    "Topps Chrome Baseball Hobby Box",
    "2025 Topps Chrome Baseball Hobby Box x2",
    "2025 Topps Chrome Baseball Hobby Box 12 Boxes",
    "2025 Topps Chrome Baseball 5 Hobby Packs",
    "2025 Topps Chrome Baseball Hobby Box Japanese",
    "2025 Topps Chrome Baseball Hobby Box READ (DAMAGE)",
    "2025 Topps Chrome Baseball Hobby Box Presale",
    "2025 Topps Chrome Baseball Hobby Box EMPTY",
    "2025 Topps Chrome Baseball Hobby Box Break Random Team",
    "2025 Topps Chrome Baseball Hobby Box Case Fresh",
    "2025 Topps Chrome Baseball Hobby Box Resealed",
    "2025 Topps Chrome Baseball Repack",
    "2025 Topps Chrome Baseball Hobby Box - You Choose",
    "2025 Topps Chrome & Panini Prizm Hobby Box",
  ])
    assert.equal(hit(t), "rejected", t);
});

test("filler: seller and shipping words are filler; the words that tell sports products apart never", () => {
  for (const w of ["fast", "nib", "express", "factory", "sealed", "trading", "sports"]) assert.ok(isFiller(w), w);
  for (const w of ["hobby", "jumbo", "blaster", "mega", "fotl", "breakers", "choice", "case", "pack", "box", "chrome", "update", "sapphire", "cello"]) assert.ok(!isFiller(w), w);
  const words = setWordsIn("2025 Topps Chrome Baseball Hobby Box");
  for (const w of ["chrome", "hobby", "box"]) assert.ok(!words.has(w), `a release name never makes "${w}" filler`);
});

test("collector: a 'New other' or 'Like New' condition is not a sealed product", () => {
  const c = new SweepCollector(usIndex(), NOW);
  c.addPage([
    summary("n1", "2025 Topps Chrome Baseball Hobby Box", 320, "EBAY_US", { condition: "New other (see details)" }),
    summary("n2", "2025 Topps Chrome Baseball Hobby Box", 320, "EBAY_US", { condition: "Like New" }),
    summary("n3", "2025 Topps Chrome Baseball Hobby Box", 320, "EBAY_US", { condition: "Neu: Sonstige (siehe Arti" }),
  ]);
  assert.equal(c.stats.miss.condition, 3);
  assert.equal(c.feeds().size, 0);
});

test("collector: keeps lowest price first, de-duplicated, at most 8; refuses used, under-floor and unmatched listings; counts why", () => {
  const c = new SweepCollector(usIndex(), NOW);
  const page = [
    summary("1", "2025 Topps Chrome Baseball Hobby Box Sealed", 330),
    summary("2", "2025 Topps Chrome Baseball Hobby Box Sealed", 310),
    summary("2", "2025 Topps Chrome Baseball Hobby Box Sealed", 310), // the same listing twice
    summary("3", "2025 Topps Chrome Baseball Hobby Box Sealed", 20), // under the hobby box floor
    summary("4", "2025 Topps Chrome Baseball Hobby Box Sealed", 340, "EBAY_US", { condition: "Used" }),
    summary("5", "Mystery Lot of sports cards", 50),
    summary("6", "2025 Panini Prizm Football Hobby Box", 600),
  ];
  const gain = c.addPage(page);
  assert.equal(gain, 3);
  const feeds = c.feeds();
  assert.deepEqual(feeds.get("hb")!.map((i) => i.price.value), ["310.00", "330.00"]);
  assert.equal(feeds.get("pz")!.length, 1);
  assert.equal(c.stats.miss.floor, 1);
  assert.equal(c.stats.miss.condition, 1);
  assert.equal(c.stats.miss.rejected, 1);
  assert.equal(c.stats.matched, 3);
});

test("paging: 200 a page with the offset, round-robin across queries, stops at the end, when dry, at the budget and at eBay's depth", async () => {
  const spec = sweepSpec(SWEEP_QUERIES[0], "EBAY_US", 400);
  const u = new URL(buildSearchUrl(spec));
  assert.equal(u.searchParams.get("limit"), "200");
  assert.equal(u.searchParams.get("offset"), "400");
  assert.equal(u.searchParams.get("q"), "hobby box", "the query as written: no game word, no 'sealed'");
  assert.equal(new URL(buildSearchUrl(sweepSpec(SWEEP_QUERIES[0], "EBAY_US", 0))).searchParams.get("offset"), null);

  // query A: two good pages then the end (a short page); query B: always the same listings (dry after its minimum); query C: errors
  const queries = [
    { key: "a", q: "hobby box", types: ["hobby-box"] as const },
    { key: "b", q: "blaster box", types: ["blaster-box"] as const },
    { key: "c", q: "jumbo box", types: ["jumbo-box"] as const },
  ];
  const seen: string[] = [];
  const c = new SweepCollector(usIndex(), NOW);
  const progress = await sweepMarketplace(
    c,
    50,
    async (s) => {
      seen.push(`${s.q}@${s.offset ?? 0}`);
      if (s.q.endsWith("jumbo box")) throw new Error("boom");
      if (s.q.endsWith("hobby box")) {
        const n = (s.offset ?? 0) / SWEEP_PAGE;
        const items = Array.from({ length: n < 2 ? SWEEP_PAGE : 3 }, (_, i) => summary(`a${n}-${i}`, "2025 Topps Chrome Baseball Hobby Box Sealed", 300 + i));
        return { items, total: 403 };
      }
      return { items: Array.from({ length: SWEEP_PAGE }, () => summary("b-same", "2025 Topps Chrome Baseball Blaster Box", 60)), total: 9000 };
    },
    { concurrency: 1, queries, isFatal: () => false },
  );
  const by = Object.fromEntries(progress.map((p) => [p.key, p]));
  assert.equal(by.a.stopped, "end");
  assert.equal(by.a.pages, 3);
  assert.equal(by.b.stopped, "dry");
  assert.equal(by.b.pages, 3, "page 1 gains; pages 2 and 3 gain nothing: dry after two");
  assert.equal(by.c.stopped, "error");
  assert.ok(seen.indexOf("hobby box@200") > seen.indexOf("blaster box@0"), "round-robin: every query's first page before anyone's second");

  // the budget ends it
  const tight = await sweepMarketplace(new SweepCollector(usIndex(), NOW), 2, async () => ({ items: Array.from({ length: SWEEP_PAGE }, (_, i) => summary(`x${Math.random()}-${i}`, "2025 Topps Chrome Baseball Hobby Box", 300)), total: 100000 }), {
    concurrency: 2,
    queries: [queries[0]],
  });
  assert.equal(tight[0].pages, 2);
  assert.equal(tight[0].stopped, "budget");
});

test("shares: by product count x audience weight (the US first), with a floor for a small marketplace, never more than the budget", () => {
  const rows = [...catalogue(), ...Array.from({ length: 40 }, (_, i) => planRow("hobby-box", "CA", 40000, { name: `${2015 + (i % 10)} Topps ${["Chrome", "Heritage", "Finest", "Stadium Club"][Math.floor(i / 10)]} Baseball Hobby Box`, productId: `ca${i}` }))];
  const vocab = sweepVocabulary(rows);
  const ix = (["EBAY_US", "EBAY_AU", "EBAY_CA"] as const).map((m) => buildSweepIndex(rows, m, vocab));
  assert.deepEqual(ix.map((x) => x.products.length), [7, 1, 40]);
  const sh = marketplaceShares(ix, 1000);
  const total = [...sh.values()].reduce((a, b) => a + b, 0);
  assert.ok(total <= 1000);
  assert.ok(sh.get("EBAY_CA")! > sh.get("EBAY_US")!, "almost six times the products at a quarter of the weight: more pages");
  assert.ok(sh.get("EBAY_AU")! >= 70, "the floor");
  // the same products at the US's weight, the UK's and Canada's: the US's share is the largest, Canada's the smallest
  const same = (["EBAY_US", "EBAY_GB", "EBAY_DE", "EBAY_AU", "EBAY_CA"] as const).map((marketplace) => ({ ...ix[0], marketplace }));
  const s2 = marketplaceShares(same, 1000);
  assert.ok(s2.get("EBAY_US")! > s2.get("EBAY_GB")! && s2.get("EBAY_GB")! === s2.get("EBAY_DE")! && s2.get("EBAY_DE")! > s2.get("EBAY_AU")! && s2.get("EBAY_AU")! > s2.get("EBAY_CA")!, JSON.stringify([...s2]));
  // the first full run's catalogue (2026-10-11: US 2,538, UK 2,169, EU 1,593, AU 2,339, CA 3,526 products): the US gets the most
  const sized = (marketplace: "EBAY_US" | "EBAY_GB" | "EBAY_DE" | "EBAY_AU" | "EBAY_CA", n: number) => ({ ...ix[0], marketplace, products: Array.from({ length: n }, () => ix[0].products[0]) });
  const real = marketplaceShares([sized("EBAY_US", 2538), sized("EBAY_GB", 2169), sized("EBAY_DE", 1593), sized("EBAY_AU", 2339), sized("EBAY_CA", 3526)], 2100);
  const us = real.get("EBAY_US")!;
  assert.ok([...real].every(([m, v]) => m === "EBAY_US" || v < us), JSON.stringify([...real]));
  assert.ok(real.get("EBAY_GB")! > real.get("EBAY_AU")! && real.get("EBAY_GB")! > real.get("EBAY_CA")!, "the UK before Australia and Canada");
  assert.ok([...real.values()].reduce((a, b) => a + b, 0) <= 2100);
});

// ─── hot sets (src/lib/popular.ts) ──────────────────────────────────────────────

test("hot queries: none while HOT_SETS is empty; for a hot release, one per product type the catalogue has for it, by the release's own name", () => {
  assert.equal(HOT_SHARE, 0.5);
  assert.deepEqual([...HOT_SETS], [], "picked from data later");
  assert.deepEqual(HOT_SET_QUERY, {});
  assert.deepEqual(hotSweepQueries(catalogue(), "2026-11-07"), []);
  // an undated release (read from store titles) is in stores: its code alone makes its queries
  const qs = hotSweepQueries(catalogue(), "2026-11-07", [CHROME, "2025|prizm|football"]);
  assert.deepEqual(
    qs.map((x) => [x.key, x.q, [...x.types]]),
    [
      ["hot-2025|chrome|baseball-hobby-box", "2025 topps chrome baseball hobby box", ["hobby-box"]],
      ["hot-2025|chrome|baseball-jumbo-box", "2025 topps chrome baseball jumbo box", ["jumbo-box"]],
      ["hot-2025|chrome|baseball-case", "2025 topps chrome baseball hobby case", ["hobby-case"]],
      ["hot-2025|chrome|baseball-hobby-pack", "2025 topps chrome baseball hobby pack", ["hobby-pack"]],
      ["hot-2025|chrome|baseball-blaster", "2025 topps chrome baseball blaster box", ["blaster-box"]],
      ["hot-2025|prizm|football-hobby-box", "2025 panini prizm football hobby box", ["hobby-box"]],
    ],
  );
  assert.equal(new Set(qs.map((x) => x.q)).size, qs.length, "no query twice");
  assert.ok(!qs.some((x) => /sapphire/.test(x.q)), "only the hot releases");
  // "<release> <phrase>", 200 a page, the type's own floor
  const pack = qs.find((x) => x.key.endsWith("hobby-pack"))!;
  const u = new URL(buildSearchUrl(sweepSpec(pack, "EBAY_US", 0)));
  assert.equal(u.searchParams.get("q"), "2025 topps chrome baseball hobby pack");
  assert.equal(u.searchParams.get("limit"), "200");
  assert.equal(sweepSpec(pack, "EBAY_US", 0).minPrice, typeFloor("hobby-pack", "EBAY_US"));
  for (const t of PRODUCT_TYPES) assert.ok(HOT_TYPE_QUERY[t.key].phrase.length > 0, t.key);
  // an unknown code, or a hot release the catalogue has nothing of, makes no query
  assert.deepEqual(hotSweepQueries(catalogue(), "2026-11-07", ["nope", "2019|heritage|baseball"]), []);
  assert.equal(hotSetWords(CHROME), "2025 topps chrome baseball");
  assert.equal(hotSetWords("nope"), null);
});

test("the hot pass runs first, with at most half the marketplace's share; the general queries get the rest", async () => {
  const hot = hotSweepQueries(catalogue(), "2026-11-07", [CHROME]);
  const general = SWEEP_QUERIES.slice(0, 4);
  const seen: string[] = [];
  // a collector whose every page gains (no query runs dry): only the budget and the order are under test here
  const ix = () => ({ index: { marketplace: "EBAY_US" }, addPage: () => 1 }) as unknown as SweepCollector;
  const endless = async (s: SearchSpec) => {
    seen.push(s.q);
    return { items: Array.from({ length: SWEEP_PAGE }, () => ({})), total: 100_000 };
  };
  const hotQs = new Set(hot.map((x) => x.q));
  const r = await sweepWithHot(ix(), 41, endless, { concurrency: 3, hot, queries: general });
  const lastHot = seen.findLastIndex((q) => hotQs.has(q));
  const firstGeneral = seen.findIndex((q) => !hotQs.has(q));
  assert.ok(lastHot < firstGeneral, "every hot page before the first general one");
  assert.equal(r.hot.reduce((a, p) => a + p.pages, 0), 20, "half of 41, rounded down");
  assert.equal(r.general.reduce((a, p) => a + p.pages, 0), 21, "the rest");
  assert.equal(seen.length, 41, "never past the share");
  assert.equal(seen[0], "2025 topps chrome baseball hobby box", "the first type first");
  // round-robin inside the hot pass: every hot query's first page before any second page
  assert.deepEqual(seen.slice(0, hot.length).sort(), [...hotQs].sort());
  // a hot pass that ends early leaves the rest of the share to the general queries
  const short = async (s: SearchSpec) => (hotQs.has(s.q) ? { items: [], total: 0 } : endless(s));
  const r2 = await sweepWithHot(ix(), 41, short, { concurrency: 1, hot, queries: general });
  assert.equal(r2.hot.reduce((a, p) => a + p.pages, 0), hot.length);
  assert.equal(r2.general.reduce((a, p) => a + p.pages, 0), 41 - hot.length);
  // what the hot pass really cost (the importer's count, retries included) comes off the general pass
  let calls = 0;
  const retrying = async (s: SearchSpec) => {
    calls += hotQs.has(s.q) ? 2 : 1; // every hot page needed a retry
    return endless(s);
  };
  const r3 = await sweepWithHot(ix(), 40, retrying, { concurrency: 1, hot, queries: general, spent: () => calls });
  assert.equal(r3.hot.reduce((a, p) => a + p.pages, 0), 20);
  assert.equal(r3.general.reduce((a, p) => a + p.pages, 0), 0, "20 hot pages cost 40 calls: nothing left");
  assert.equal(calls, 40);
  // no hot query: the whole share for the general queries
  const r4 = await sweepWithHot(ix(), 10, endless, { concurrency: 1, hot: [], queries: general });
  assert.deepEqual([r4.hot.length, r4.general.reduce((a, p) => a + p.pages, 0)], [0, 10]);
  // once the run is over (a 429 elsewhere), the general pass does not start
  const r5 = await sweepWithHot(ix(), 10, endless, { concurrency: 1, hot, queries: general, shouldStop: () => true });
  assert.deepEqual(r5.general, []);
});

test("run: the sweep writes an item feed for every product it found listings for, then per-product searches fill only what it missed", async () => {
  const rows = catalogue();
  const db = fakeDb(rows);
  const h = harness((url, init) => {
    if (url.includes("/oauth2/token")) return okToken();
    const u = new URL(url);
    const q = u.searchParams.get("q") ?? "";
    const offset = Number(u.searchParams.get("offset") ?? 0);
    const ref = requestedReference(init);
    if (q === "hobby box" && offset === 0)
      return json({ total: 3, itemSummaries: withReference([summary("s1", "2025 Topps Chrome Baseball Hobby Box Sealed", 330), summary("s2", "2025 Topps Chrome Baseball Hobby Box", 320), summary("s3", "2025 Topps Chrome Baseball Hobby Box 20 packs", 340)], ref) });
    if (q === "jumbo box" && offset === 0)
      return json({ total: 2, itemSummaries: withReference([summary("t1", "2025 Topps Chrome Baseball Jumbo Box", 560), summary("t2", "2025 Topps Chrome Baseball Jumbo Box Sealed", 540)], ref) });
    if (q.startsWith("2025 Topps Chrome Baseball Blaster Box"))
      return json({ total: 2, itemSummaries: withReference([summary("e1", "2025 Topps Chrome Baseball Blaster Box", 48), summary("e2", "2025 Topps Chrome Baseball Blaster Box Sealed", 46)], ref) });
    return json({ total: 0, itemSummaries: [] });
  });
  const logs: string[] = [];
  const s = await runImport({ db, api: h.deps, env: { EBAY_SWEEP_CALLS: "200" }, log: (l) => logs.push(l) }, { only: ["sweep", "items"] });
  assert.equal(s.stopped, null, logs.join("\n"));
  // the sweep covered the hobby box and the jumbo box in the US
  assert.deepEqual(db.feeds.get("EBAY_US|item:hb")!.items.map((i) => i.price.value), ["320.00", "330.00", "340.00"]);
  assert.ok(db.feeds.has("EBAY_US|item:jb"));
  assert.ok(!db.feeds.has("EBAY_US|item:saph"), "nothing found: no feed");
  // the per-product search ran for the blaster the sweep did not cover, and never for the box it did
  const itemSearches = h.searches()
    .filter((c) => ((c.init?.headers ?? {}) as Record<string, string>)["X-EBAY-C-MARKETPLACE-ID"] === "EBAY_US")
    .map((c) => new URL(c.url).searchParams.get("q"));
  assert.ok(itemSearches.some((q) => q?.startsWith("2025 Topps Chrome Baseball Blaster Box")));
  assert.ok(!itemSearches.some((q) => q === "2025 Topps Chrome Baseball Hobby Box"), "the US box the sweep found is not bought again (Australia's is its own)");
  assert.ok(db.feeds.has("EBAY_US|item:bl"));
  assert.equal(s.buckets.items.covered >= 1, true);
  // every sweep link is eBay's own, tagged with the item feed's reference
  for (const it of db.feeds.get("EBAY_US|item:hb")!.items) assert.equal(new URL(it.url).searchParams.get("customid"), "wax-us-item");
  // budget: every search reserved, never more than the cap
  assert.equal([...db.days.values()].reduce((a, b) => a + b, 0), h.searches().length);
  assert.ok(s.sweep.some((m) => m.marketplace === "EBAY_US" && m.written >= 2));
});

test("run: a 429 during the sweep stops the run, keeps what the sweep already found, and buys no per-product search", async () => {
  const rows = catalogue();
  const db = fakeDb(rows);
  let n = 0;
  const h = harness((url, init) => {
    if (url.includes("/oauth2/token")) return okToken();
    n++;
    if (n === 1) return json({ total: 2, itemSummaries: withReference([summary("e1", "2025 Topps Chrome Baseball Hobby Box", 330), summary("e2", "2025 Topps Chrome Baseball Hobby Box Sealed", 325)], requestedReference(init)) });
    return json({ errors: [] }, 429, { "retry-after": "60" });
  });
  const s = await runImport({ db, api: h.deps, env: { EBAY_SWEEP_CALLS: "100" }, log: () => {} }, { only: ["sweep", "items"], concurrency: 1 });
  assert.equal(s.stopped, "rate-limited");
  assert.ok(db.feeds.has("EBAY_US|item:hb"), "the page that came back is written");
  assert.equal(s.buckets.items.planned, 0);
});

test("the sweep holds Germany, Australia and the UK to 20 pages; the freed calls search Canada then the US first (owner, 2026-11-10)", async () => {
  const { SWEEP_MARKETPLACE_CAP, sweepBudgetFor } = await import("../src/lib/ebay-sweep");
  const { prioritiseItems, ITEMS_FIRST_CALLS } = await import("../src/lib/ebay-import");
  assert.deepEqual(SWEEP_MARKETPLACE_CAP, { EBAY_DE: 20, EBAY_AU: 20, EBAY_GB: 20 });
  assert.equal(sweepBudgetFor("EBAY_DE", 300), 20);
  assert.equal(sweepBudgetFor("EBAY_GB", 12), 12, "a smaller share stays");
  assert.equal(sweepBudgetFor("EBAY_US", 900), 900, "the US is never capped");
  assert.equal(sweepBudgetFor("EBAY_CA", 300), 300);
  assert.equal(ITEMS_FIRST_CALLS, 113);
  const f = (mp: "EBAY_US" | "EBAY_CA" | "EBAY_GB", i: number) => ({ feed: `${mp}|item:${i}`, marketplace: mp });
  const open = [f("EBAY_GB", 1), f("EBAY_US", 1), f("EBAY_CA", 1), f("EBAY_US", 2), f("EBAY_CA", 2)];
  assert.deepEqual(prioritiseItems(open, 3).map((x) => x.feed), ["EBAY_CA|item:1", "EBAY_CA|item:2", "EBAY_US|item:1", "EBAY_GB|item:1", "EBAY_US|item:2"]);
  assert.equal(prioritiseItems(open, 0).length, open.length, "nothing lost, nothing doubled");
});
