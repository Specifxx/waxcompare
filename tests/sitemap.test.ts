import { test } from "node:test";
import assert from "node:assert/strict";
import { REGION_LIST, REGIONS } from "../src/lib/regions";
import { regionOfSitemapId, regionSitemap, SITEMAP_IDS, sitemapIdOf, STATIC_SITEMAP_ID, staticSitemap } from "../src/lib/sitemap";
import { SITE_URL } from "../src/lib/site";
import { STORES } from "../src/lib/stores";
import { GUIDE_BY_SLUG, GUIDES, guideRegions } from "../src/content/guides";
import { COUNTRY_GUIDE } from "../src/content/guides/country-prices";

const onSite = (entries: { url: string }[]) => {
  for (const e of entries) {
    assert.ok(e.url === SITE_URL || e.url.startsWith(`${SITE_URL}/`), `not on SITE_URL: ${e.url}`);
    assert.ok(!e.url.includes("dexcompare.com"), e.url);
    assert.ok(!/\/\/[^/]+\/.*\/\//.test(e.url), `double slash: ${e.url}`);
  }
};

test("SITE_URL has no trailing slash and defaults to waxcompare.app", () => {
  assert.ok(!SITE_URL.endsWith("/"));
  if (!process.env.NEXT_PUBLIC_SITE_URL) assert.equal(SITE_URL, "https://waxcompare.app");
});

test("sitemap ids: 0 = static, 1..N = REGION_LIST order", () => {
  assert.deepEqual(
    SITEMAP_IDS.map((s) => s.id),
    [0, 1, 2, 3, 4, 5],
  );
  assert.equal(STATIC_SITEMAP_ID, 0);
  assert.equal(sitemapIdOf("us"), 1);
  assert.equal(sitemapIdOf("au"), 3);
  assert.equal(regionOfSitemapId(4)?.region, "uk");
  assert.equal(regionOfSitemapId(0), null);
  assert.equal(regionOfSitemapId(6), null);
  for (const r of REGION_LIST) assert.equal(regionOfSitemapId(sitemapIdOf(r.region))?.region, r.region);
});

test("static sitemap: root, trust pages, every region's landing pages, every store; all on SITE_URL", () => {
  const when = new Date("2026-09-25T07:54:42Z");
  const entries = staticSitemap({ AU: when });
  onSite(entries);
  const urls = new Set(entries.map((e) => e.url));
  for (const p of ["", "/about", "/terms", "/privacy", "/contact"]) assert.ok(urls.has(`${SITE_URL}${p}`), p);
  for (const r of REGION_LIST) for (const p of ["", "/sealed", "/sets", "/stores", "/releases", "/deals", "/this-week", "/guides"]) assert.ok(urls.has(`${SITE_URL}/${r.region}${p}`), `${r.region}${p}`);
  const at = (p: string) => entries.find((e) => e.url === `${SITE_URL}${p}`)!;
  assert.deepEqual([at("/au/deals").changeFrequency, at("/au/deals").priority, at("/au/deals").lastModified], ["daily", 0.7, when]);
  assert.ok(!urls.has(`${SITE_URL}/au/cheapest-packs`) && !urls.has(`${SITE_URL}/au/preorders`), "routes WaxCompare does not have");
  assert.deepEqual([at("/au/this-week").changeFrequency, at("/au/this-week").priority], ["daily", 0.5]);
  assert.deepEqual([at("/au/guides").changeFrequency, at("/au/guides").priority, at("/au/guides").lastModified], ["weekly", 0.5, undefined], "an editorial index: no import-time lastmod");
  for (const s of STORES) assert.ok(urls.has(`${SITE_URL}/${s.market.toLowerCase()}/stores/${s.key}`), s.key);
  assert.equal(entries.find((e) => e.url === `${SITE_URL}/au`)?.lastModified, when);
  assert.equal(entries.find((e) => e.url === `${SITE_URL}/us`)?.lastModified, undefined);
  assert.equal(urls.size, entries.length, "no duplicate URLs");
});

test("static sitemap with activeStores: only the stores that list something and are not dormant get a URL", () => {
  const [kept, dropped] = [STORES[0], STORES[1]];
  const entries = staticSitemap({}, [kept.key, "not-a-store"]);
  onSite(entries);
  const storeUrls = entries.filter((e) => /\/stores\/[^/]+$/.test(e.url)).map((e) => e.url);
  assert.deepEqual(storeUrls, [`${SITE_URL}/${kept.market.toLowerCase()}/stores/${kept.key}`]);
  assert.ok(!entries.some((e) => e.url.endsWith(`/stores/${dropped.key}`)), "a store outside the active list is left out");
  for (const r of REGION_LIST) assert.ok(entries.some((e) => e.url === `${SITE_URL}/${r.region}/stores`), "the directory pages stay");
  assert.equal(staticSitemap({}).filter((e) => /\/stores\/[^/]+$/.test(e.url)).length, STORES.length, "without the list (the build), every store");
  assert.equal(staticSitemap({}, []).filter((e) => /\/stores\/[^/]+$/.test(e.url)).length, 0);
});

test("region sitemap: known types and sets only, every comparable product, all on SITE_URL", () => {
  const entries = regionSitemap(REGIONS.uk, {
    typeLabels: ["Hobby Box", "Blaster Box", "Not A Type"],
    setCodes: ["no-such-set"],
    productSlugs: ["a-box", "b-cbb"],
    lastmod: null,
  });
  onSite(entries);
  const urls = entries.map((e) => e.url);
  assert.deepEqual(urls, [
    `${SITE_URL}/uk/type/hobby-boxes`,
    `${SITE_URL}/uk/type/blaster-boxes`,
    `${SITE_URL}/uk/p/a-box`,
    `${SITE_URL}/uk/p/b-cbb`,
  ]);
  assert.ok(entries.every((e) => e.lastModified === undefined));
});

test("region sitemap: nothing comparable → empty, never a guess", () => {
  assert.deepEqual(regionSitemap(REGIONS.sg, { typeLabels: [], setCodes: [], productSlugs: [], lastmod: null }), []);
});

test("static sitemap: every guide in each region it is offered in, and nowhere else (the MSRP guide is US-only)", () => {
  const entries = staticSitemap({});
  onSite(entries);
  const urls = new Set(entries.map((e) => e.url));
  for (const g of GUIDES) {
    for (const r of REGION_LIST) {
      const u = `${SITE_URL}/${r.region}/guides/${g.slug}`;
      assert.equal(urls.has(u), guideRegions(g).includes(r.region), u);
    }
  }
  // The one by-country page at its region-less URL, and the blog.
  assert.ok(urls.has(`${SITE_URL}/blog`));
  assert.equal(entries.filter((e) => e.url === `${SITE_URL}/guides/sports-card-box-prices-by-country`).length, 1);
  assert.equal(`${SITE_URL}${COUNTRY_GUIDE.path}`, `${SITE_URL}/guides/sports-card-box-prices-by-country`);
  assert.ok(![...urls].some((u) => !u.includes("/stores/") && /magic|mtg/i.test(u)), "no MTG URL left (a store's own key aside)");
  const at = entries.find((e) => e.url === `${SITE_URL}/uk/guides/hobby-vs-blaster-vs-mega-box`)!;
  // lastmod is the guide's editorial `updated` date, never the import time.
  assert.deepEqual([at.changeFrequency, at.priority, at.lastModified], ["weekly", 0.6, new Date(`${GUIDE_BY_SLUG.get("hobby-vs-blaster-vs-mega-box")!.updated}T00:00:00Z`)], "editorial lastmod");
  for (const r of REGION_LIST) for (const p of ["/deals", "/black-friday", "/tools"]) assert.ok(urls.has(`${SITE_URL}/${r.region}${p}`), `${r.region}${p}`);
  assert.equal(urls.size, entries.length, "no duplicate URLs");
});

test("the creators hub is in the sitemap, linked from the footer, and no longer redirected to /about", async () => {
  const { staticSitemap } = await import("../src/lib/sitemap");
  const { footerColumns } = await import("../src/components/Footer");
  const { SITE_URL } = await import("../src/lib/site");
  assert.ok(staticSitemap({}).some((u) => u.url === `${SITE_URL}/creators`));
  assert.ok(footerColumns(null).flatMap((c) => c.links).some((l) => l.href === "/creators"));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cfg = require("../next.config.js") as { redirects: () => Promise<{ source: string; destination: string }[]> };
  const rules = await cfg.redirects();
  assert.ok(!rules.some((r) => r.destination === "/about" && /creators/.test(r.source)), "/creators is a page, not a redirect");
  assert.ok(rules.some((r) => r.source === "/creators/:rest+" && r.destination === "/creators"));
});
