// "Sports card box prices by country" (/guides/sports-card-box-prices-by-country): the pure selection on fixtures, the body as a
// crawler sees it (every market in its own currency, never converted), and the loaders (by-country, a guide's, a post's) run end to
// end through the public data files (the site's default source), so the engine answers their query shapes without falling to Neon.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { findBannedCopy } from "../src/lib/copy-rules";
import { REGION_LIST, type Market } from "../src/lib/regions";
import { COUNTRY_GUIDE, countryFaqs, marketLines, shownSets, whereOpen, type MarketCard } from "../src/content/guides/country-prices";
import { CountryBody } from "../src/content/guides/country-prices-body";
import { buildPublicFiles, type Tables } from "../src/lib/public-data/export";
import { resetPublicData } from "../src/lib/public-data/store";

(globalThis as unknown as { React: typeof React }).React = React;

const TODAY = "2026-10-21";
const card = (market: Market, setCode: string, name: string, cents: number, stores = 3, marketplace = false): MarketCard => ({
  market,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name,
  productType: "x",
  setCode,
  imageUrl: null,
  lowestPriceCents: cents,
  inStockStores: stores,
  listedStores: stores + 1,
  marketplaceOpen: marketplace,
  medianOpenCents: null,
  releaseDate: null,
});

const A = "2025|chrome|baseball";
const B = "2025|prizm|football";
const CARDS: MarketCard[] = [
  ...REGION_LIST.map((r, i) => card(r.market, A, "2025 Topps Chrome Baseball Hobby Box", 30000 + i * 1000, 3 + i)),
  ...REGION_LIST.slice(0, 3).map((r, i) => card(r.market, A, "2025 Topps Chrome Baseball Blaster Box", 4500 + i * 100)),
  card("US", B, "2025 Panini Prizm Football Hobby Box", 64000, 4, true),
  card("UK", B, "2025 Panini Prizm Football Hobby Box", 52000, 2),
  card("AU", "2025|bowman|baseball", "2025 Bowman Baseball Hobby Box", 40000), // one market only: not shown
];

test("the registry entry: a /guides path, a description that fits", () => {
  assert.equal(COUNTRY_GUIDE.path, `/guides/${COUNTRY_GUIDE.slug}`);
  assert.ok(COUNTRY_GUIDE.description.length <= 160);
  assert.equal(findBannedCopy(`${COUNTRY_GUIDE.title} ${COUNTRY_GUIDE.description}`), null);
});

test("selection: releases open in two or more markets, the widest first; lines in REGION_LIST order; never a per-pack price", () => {
  assert.deepEqual(shownSets(CARDS), [A, B]);
  const lines = marketLines(CARDS, A, "blaster-box");
  assert.deepEqual(lines.map((l) => l.r.market), REGION_LIST.map((r) => r.market));
  assert.equal(lines[0].p?.lowestPriceCents, 4500);
  assert.equal(lines.filter((l) => l.p).length, 3);
  for (const l of marketLines(CARDS, A, "hobby-box")) assert.equal(l.perPack, null, "no pack count is claimed");
  assert.equal(whereOpen({ inStockStores: 0, marketplaceOpen: true }), "—");
  assert.equal(whereOpen({ inStockStores: 2, marketplaceOpen: false }), "2 stores");
});

test("the body: every market in its own currency, no ranking of countries, no banned copy", () => {
  const html = renderToStaticMarkup(React.createElement(CountryBody, { data: { today: TODAY, checked: null, sets: shownSets(CARDS), cards: CARDS } }));
  const t = html.replace(/<[^>]+>/g, " ");
  for (const r of REGION_LIST) assert.ok(t.includes(r.name) || t.includes(r.inName), r.name);
  assert.doesNotMatch(t, /\bMTG\b|Magic|booster/i);
  for (const sym of ["A$", "£", "€", "C$"]) assert.ok(t.includes(sym), sym);
  assert.doesNotMatch(t, /cheapest country is|cheapest in (?:the )?(?:US|UK|Australia)/i);
  assert.equal(findBannedCopy(t), null);
  for (const f of countryFaqs({ name: "2025 Topps Chrome Baseball", lines: marketLines(CARDS, A, "hobby-box") })) assert.equal(findBannedCopy(`${f.q} ${f.a}`), null);
});

// ─── The loaders, end to end through the public data files ─────────────────────

const T0 = new Date("2026-10-20T23:18:41.716Z");
function fixtureDir(): string {
  const p = (id: string, name: string, productType: string, setCode: string) => ({ id, groupKey: id, slug: id, name, productType, setCode, imageUrl: null, createdAt: T0 });
  const stat = (productId: string, market: string, cents: number, inStock: number, marketplaceOpen = false) => ({
    productId,
    market,
    lowestPriceCents: cents,
    inStockStores: inStock,
    listedStores: inStock + 1,
    marketplaceOpen,
    medianOpenCents: null,
  });
  const tables: Tables = {
    Product: [
      p("a-hobby", "2025 Topps Chrome Baseball Hobby Box", "Hobby Box", "2025|chrome|baseball"),
      p("a-blaster", "2025 Topps Chrome Baseball Blaster Box", "Blaster Box", "2025|chrome|baseball"),
      p("b-hobby", "2025 Panini Prizm Football Hobby Box", "Hobby Box", "2025|prizm|football"),
      p("b-mega", "2025 Panini Prizm Football Mega Box", "Mega Box", "2025|prizm|football"),
    ],
    Offer: [],
    ProductStat: [
      stat("a-hobby", "AU", 44999, 9),
      stat("a-hobby", "US", 31999, 5, true),
      stat("a-hobby", "UK", 26000, 0), // listed, sold out: not open
      stat("a-blaster", "AU", 6999, 3),
      stat("a-blaster", "NZ", 7999, 2),
      stat("b-hobby", "US", 64999, 4),
      stat("b-mega", "UK", 5999, 2),
    ],
    StoreStat: [{ store: "store-a", market: "AU", listed: 5, inStock: 4, lastOkAt: T0, lastError: null, dormant: false, updatedAt: T0 }],
    EbayListing: [],
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wax-country-"));
  for (const [name, body] of buildPublicFiles(tables, { generatedAt: T0, source: "test" })) fs.writeFileSync(path.join(dir, name), body);
  return dir;
}

test("the by-country, guide and blog loaders run on the public data files alone (no Neon)", async () => {
  const saved = { mode: process.env.PUBLIC_DATA_MODE, dir: process.env.PUBLIC_DATA_DIR, db: process.env.DATABASE_URL, dc2: process.env.SEALED_DATABASE_URL };
  process.env.PUBLIC_DATA_MODE = "files";
  process.env.PUBLIC_DATA_DIR = fixtureDir();
  process.env.DATABASE_URL = "postgresql://nobody:nothing@127.0.0.1:1/none";
  delete process.env.SEALED_DATABASE_URL;
  resetPublicData();
  try {
    const { loadCountryData } = await import("../src/content/guides/country-prices-data");
    const d = await loadCountryData(new Date(`${TODAY}T12:00:00Z`));
    assert.deepEqual(d.sets, ["2025|chrome|baseball"]);
    assert.equal(d.checked, T0.toISOString());
    assert.deepEqual(d.cards.map((c) => `${c.market} ${c.slug}`).sort(), ["AU a-blaster", "AU a-hobby", "NZ a-blaster", "US a-hobby"]);

    const { loadGuideData } = await import("../src/content/guides/data");
    const { REGIONS } = await import("../src/lib/regions");
    const g = await loadGuideData("hobby-vs-blaster-vs-mega-box", REGIONS.au, new Date(`${TODAY}T12:00:00Z`));
    assert.deepEqual(g.rows["blaster-box"]?.map((c) => c.lowestPriceCents), [6999]);
    assert.deepEqual(g.rows["hobby-box"]?.map((c) => c.lowestPriceCents), [44999]);
    const w = await loadGuideData("where-to-buy-sealed-sports-cards-online", REGIONS.au);
    assert.equal(w.stores[0]?.store, "store-a");
    assert.ok(w.types.some((t) => t.productType === "Hobby Box" && t.open === 1));

    const { loadPostData } = await import("../src/lib/blog/data");
    const boxes = await loadPostData("cheapest-sports-card-boxes");
    assert.deepEqual(boxes.boxes.filter((c) => c.market === "AU").map((c) => c.slug), ["a-blaster", "a-hobby"]);
  } finally {
    for (const [k, v] of Object.entries({ PUBLIC_DATA_MODE: saved.mode, PUBLIC_DATA_DIR: saved.dir, DATABASE_URL: saved.db, SEALED_DATABASE_URL: saved.dc2 })) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    resetPublicData();
  }
});
