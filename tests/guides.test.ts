// The guides (src/content/guides) and the blog (src/lib/blog): the registries' rules, and every body rendered as a crawler sees it on
// fixture data: its copy never matches BANNED_COPY or talks about pull rates, EV or investing, never claims a pack count, and never
// carries a word of the Magic site it was ported from. WaxCompare is a new domain: no old URL to keep.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProductCardData } from "../src/lib/data";
import { findBannedCopy } from "../src/lib/copy-rules";
import { REGION_LIST, REGIONS, type Market, type Region } from "../src/lib/regions";
import { TYPE_BY_KEY } from "../src/lib/sealed-title";
import { GUIDE_BY_SLUG, GUIDES, guideFor, guideMetaTitle, guideRegions, guidesFor, type GuideSlug } from "../src/content/guides";
import { emptyGuideData, type GuideData } from "../src/content/guides/data";
import { GUIDE_MODULES } from "../src/content/guides/modules";
import { stripIndex } from "../src/content/guides/kit";
import { weekMoves } from "../src/content/guides/more-data";
import { familyOf, packsOf, perPackOf, type MarketCard } from "../src/content/live";
import { POST_BY_SLUG, POSTS, postMetaTitle } from "../src/lib/blog";
import { emptyPostData, type PostData } from "../src/lib/blog/data";
import { POST_MODULES } from "../src/lib/blog/modules";
import { jsonLdBlocks, validateJsonLd } from "./helpers/jsonld";

(globalThis as unknown as { React: typeof React }).React = React;

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const TODAY = "2026-11-07";
const CHECKED = "2026-11-07T08:00:00.000Z";
const CHROME = "2025|chrome|baseball";
const card = (name: string, cents: number, stores = 3, marketplace = false, setCode: string | null = CHROME): ProductCardData => ({
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

function guideFixture(): GuideData {
  return {
    ...emptyGuideData(TODAY, CHECKED),
    rows: {
      "hobby-box": [card("2025 Topps Chrome Baseball Hobby Box", 31999, 9), card("2025 Panini Prizm Football Hobby Box", 64999, 4, false, "2025|prizm|football")],
      "jumbo-box": [card("2025 Topps Chrome Baseball Jumbo Box", 54999, 3)],
      "mega-box": [card("2025 Topps Chrome Baseball Mega Box", 4999, 7)],
      "blaster-box": [card("2025 Topps Chrome Baseball Blaster Box", 3999, 12)],
      "hanger-box": [card("2025 Topps Chrome Baseball Hanger Box", 2499, 5)],
      "hobby-case": [],
      pack: [card("2025 Topps Chrome Baseball Hobby Pack", 1499, 6)],
    },
    stores: [
      { store: "store-a", name: "Store A", inStock: 210, listed: 340 },
      { store: "store-b", name: "Store B", inStock: 120, listed: 180 },
    ],
    types: [
      { productType: "Hobby Box", open: 40, fromCents: 9999 },
      { productType: "Blaster Box", open: 22, fromCents: 2999 },
    ],
  };
}

const renderGuide = (slug: GuideSlug, region: Region, data: GuideData = guideFixture()) => renderToStaticMarkup(React.createElement(GUIDE_MODULES[slug].Body, { r: REGIONS[region], data }));
const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
const PAIRS = GUIDES.flatMap((g) => guideRegions(g).map((region) => ({ g, region })));
const NO_VALUE_TALK = /\bexpected value\b|\bEV\b|\bpull rates?\b|\binvest/i;
const OTHER_SITE = /\bMTG\b|Magic|Pokémon|DexCompare|booster|Commander|Elite Trainer|Wizards/i;

// ─── The product families ──────────────────────────────────────────────────────

test("families: a name lands in one family; no pack count is ever claimed", () => {
  const fam = (n: string) => familyOf(`2025 Topps Chrome Baseball ${n}`)?.key;
  assert.equal(fam("Hobby Box"), "hobby-box");
  assert.equal(fam("Jumbo Box"), "jumbo-box");
  assert.equal(fam("Mega Box"), "mega-box");
  assert.equal(fam("Blaster Box"), "blaster-box");
  assert.equal(fam("Hanger Box"), "hanger-box");
  assert.equal(fam("Hobby Case"), "hobby-case", "a case is not a box");
  assert.equal(fam("Hobby Pack"), "pack");
  for (const n of ["Hobby Box", "Hobby Box (20 Packs)", "Blaster Box"]) {
    assert.equal(packsOf({ name: `2025 Topps Chrome Baseball ${n}` }), null, n);
    assert.equal(perPackOf({ name: `2025 Topps Chrome Baseball ${n}`, lowestPriceCents: 30000 }), null, n);
  }
});

// ─── The guides' registry ──────────────────────────────────────────────────────

test("registry: unique slugs, titles and descriptions, ISO editorial dates, descriptions ≤ 160, titles that fit a <title>, a body module each", () => {
  assert.equal(new Set(GUIDES.map((g) => g.slug)).size, GUIDES.length);
  assert.equal(new Set(GUIDES.map((g) => g.title)).size, GUIDES.length);
  assert.equal(new Set(GUIDES.map((g) => g.description)).size, GUIDES.length);
  assert.ok(GUIDES.length >= 3);
  for (const g of GUIDES) {
    assert.match(g.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (const d of [g.published, g.updated]) assert.equal(new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10), d, `${g.slug}: a real date`);
    assert.ok(g.updated >= g.published, g.slug);
    assert.ok(g.description.length <= 160, `${g.slug}: description is ${g.description.length} characters`);
    const t = guideMetaTitle(g.title);
    assert.ok((typeof t === "string" ? `${t} | WaxCompare` : t.absolute).length <= 60, `${g.slug}: <title> over 60 characters`);
    assert.doesNotMatch(`${g.title} ${g.description} ${g.kicker}`, OTHER_SITE, g.slug);
    assert.equal(findBannedCopy(`${g.title} ${g.description} ${g.kicker}`), null, g.slug);
    assert.ok(GUIDE_MODULES[g.slug], `${g.slug}: a body module`);
    for (const k of g.topic.types ?? []) assert.ok((TYPE_BY_KEY as ReadonlyMap<string, unknown>).has(k), `${g.slug}: type ${k}`);
    assert.ok(g.ebay.heading.length > 0 && g.ebay.heading.length <= 34, `${g.slug}: the strip heading fits one phone row`);
    assert.doesNotMatch(g.ebay.query, /\bmtg\b|magic/i, g.slug);
  }
});

test("every guide is in every region we serve", () => {
  for (const g of GUIDES) assert.equal(guideRegions(g).length, REGION_LIST.length, g.slug);
  for (const r of REGION_LIST) assert.equal(guidesFor(r.region).length, GUIDES.length, r.region);
  assert.equal(guideFor("no-such-guide", "au"), null);
  assert.equal(guideFor(GUIDES[0].slug, "au"), GUIDE_BY_SLUG.get(GUIDES[0].slug));
});

// ─── The guides, rendered ──────────────────────────────────────────────────────

test("every guide renders in every region: no banned copy, no value talk, no word of the old site, internal links, a valid FAQ", () => {
  for (const { g, region } of PAIRS) {
    for (const data of [guideFixture(), emptyGuideData(TODAY, null)]) {
      const html = renderGuide(g.slug, region, data);
      const t = text(html);
      assert.equal(findBannedCopy(t), null, `${g.slug} (${region}): ${findBannedCopy(t)}`);
      assert.doesNotMatch(t, NO_VALUE_TALK, `${g.slug} (${region})`);
      assert.doesNotMatch(t, OTHER_SITE, `${g.slug} (${region}): left from the Magic site`);
      assert.doesNotMatch(t, /\b\d+\s+packs\b(?! of)/i, `${g.slug} (${region}): a pack count`);
      assert.match(html, new RegExp(`href="/${region}/`), `${g.slug}: internal links`);
      const { docs, errors } = jsonLdBlocks(html);
      assert.deepEqual(errors, []);
      const faq = docs.find((d) => (d as { "@type"?: string })["@type"] === "FAQPage") as { mainEntity: { name: string }[] } | undefined;
      if (faq) {
        assert.deepEqual(validateJsonLd(faq), [], g.slug);
        for (const q of faq.mainEntity) assert.ok(t.includes(q.name), `${g.slug}: "${q.name}" is on the page`);
      }
    }
    assert.ok(GUIDE_MODULES[g.slug].outline(REGIONS[region], guideFixture()).sections.length >= 3, g.slug);
    assert.equal((renderGuide(g.slug, region).match(/guide-tcgplayer/g) ?? []).length, 0, `${g.slug}: no TCGplayer link (card games only)`);
  }
});

test("a guide prices in the region's own currency and links the products it prices", () => {
  const html = renderGuide("hobby-vs-blaster-vs-mega-box", "au");
  assert.match(text(html), /A\$/);
  assert.match(html, /href="\/au\/p\/2025-topps-chrome-baseball-blaster-box"/);
});

test("the strip goes after the first live section", () => {
  for (const g of GUIDES) {
    const s = GUIDE_MODULES[g.slug].outline(REGIONS.us, guideFixture()).sections;
    assert.ok(stripIndex(s) >= 0 && stripIndex(s) < s.length, g.slug);
  }
});

test("the market wrap: real week-over-week moves only; under a week of history, no move", () => {
  assert.deepEqual(weekMoves(null, "US").lower, []);
  const d = 20000;
  const h = { v: 1 as const, since: d - 10, through: d, series: { US: { a: [[d - 10, 10000, 3], [d - 3, 9000, 3]] as [number, number, number][], b: [[d - 10, 10000, 3], [d - 1, 11000, 4]] as [number, number, number][], c: [[d - 10, 10000, 1]] as [number, number, number][], z: [[d - 10, 10000, 3], [d, 2000, 3]] as [number, number, number][] } } };
  const w = weekMoves(h, "US");
  assert.deepEqual(w.lower.map((m) => [m.slug, m.before, m.after, m.pct]), [["a", 10000, 9000, -10]]);
  assert.deepEqual(w.higher.map((m) => [m.slug, m.pct]), [["b", 10]]);
  assert.equal(w.compared, 3, "c is at one store: not compared; z's 80% move is a misfiled listing, compared but not shown");
  const short = weekMoves({ ...h, since: d - 5 }, "US");
  assert.deepEqual([short.lower, short.higher], [[], []], "under eight days: no moves");
});

// ─── The blog ──────────────────────────────────────────────────────────────────

const mc = (market: Market, name: string, cents: number, setCode = CHROME): MarketCard => ({ ...card(name, cents, 3, false, setCode), market });
function postFixture(): PostData {
  const markets = REGION_LIST.map((r) => r.market);
  return {
    ...emptyPostData(TODAY, CHECKED),
    boxes: markets.flatMap((m, i) => [mc(m, "2025 Topps Chrome Baseball Hobby Box", 30000 + i * 1000), mc(m, "2025 Topps Chrome Baseball Blaster Box", 4000 + i * 100)]),
    counts: markets.map((m, i) => ({ market: m, stores: 5 + i, open: 100 + i })),
    stores: { US: [{ store: "store-a", name: "Store A", inStock: 99, listed: 120 }] },
  };
}

test("blog registry: unique slugs, real dates, short descriptions, a module each", () => {
  assert.equal(new Set(POSTS.map((p) => p.slug)).size, POSTS.length);
  for (const p of POSTS) {
    for (const d of [p.published, p.updated]) assert.equal(new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10), d, p.slug);
    assert.ok(p.description.length <= 160, `${p.slug}: description is ${p.description.length}`);
    const t = postMetaTitle(p.title);
    assert.ok((typeof t === "string" ? `${t} | WaxCompare` : t.absolute).length <= 70, `${p.slug}: <title>`);
    assert.equal(findBannedCopy(`${p.title} ${p.description}`), null, p.slug);
    assert.doesNotMatch(`${p.title} ${p.description}`, OTHER_SITE, p.slug);
    assert.ok(POST_MODULES[p.slug], p.slug);
    assert.equal(POST_BY_SLUG.get(p.slug), p);
  }
});

test("every post renders: no banned copy, no value talk, every market in its own currency", () => {
  for (const p of POSTS) {
    const o = POST_MODULES[p.slug].outline(postFixture());
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, o.intro, ...o.sections.map((s) => React.createElement("section", { key: s.id }, s.body))));
    const t = text(html);
    assert.equal(findBannedCopy(t), null, `${p.slug}: ${findBannedCopy(t)}`);
    assert.doesNotMatch(t, NO_VALUE_TALK, p.slug);
    assert.doesNotMatch(t, OTHER_SITE, p.slug);
    for (const amount of ["A$", "£", "€", "C$"]) assert.ok(t.includes(amount), `${p.slug}: ${amount}`);
    const empty = POST_MODULES[p.slug].outline(emptyPostData(TODAY));
    assert.ok(empty.sections.length >= 2, `${p.slug}: renders with no data`);
  }
});

// ─── URLs ──────────────────────────────────────────────────────────────────────

type Redirect = { source: string; destination: string; permanent: boolean };
const require = createRequire(import.meta.url);
const config = require("../next.config.js") as { redirects: () => Promise<Redirect[]> };
const nextMatch = require("next/dist/shared/lib/router/utils/path-match") as {
  getPathMatch: (source: string, opts: { strict: boolean; removeUnnamedParams: boolean; sensitive: boolean }) => (path: string) => false | Record<string, string>;
};
function to(rules: Redirect[], path: string): string | undefined {
  for (const rule of rules) {
    const m = nextMatch.getPathMatch(rule.source, { strict: true, removeUnnamedParams: true, sensitive: false })(path);
    if (m) return rule.destination.replace(/:(\w+)/g, (_, k) => m[k] ?? `:${k}`);
  }
  return undefined;
}

test("guide and blog URLs: every post and regional guide is served; a region-less guide path goes to the US guides, bar the by-country one", async () => {
  const rules = await config.redirects();
  for (const p of POSTS) assert.equal(to(rules, `/blog/${p.slug}`), undefined, `/blog/${p.slug} is served`);
  assert.equal(to(rules, "/blog"), undefined);
  for (const g of GUIDES) assert.equal(to(rules, `/us/guides/${g.slug}`), undefined, g.slug);
  assert.equal(to(rules, "/guides/sports-card-box-prices-by-country"), undefined, "the by-country guide is served");
  assert.equal(to(rules, "/guides/some-old-guide"), "/us/guides");
});
