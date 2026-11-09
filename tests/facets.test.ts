// Navigation by sport and brand (owner, 2026-11-09): the slugs, the facets read from set codes, what the menus offer, and the sitemap.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableFrom,
  BRAND_BY_SLUG,
  BRANDS,
  brandsOfSport,
  comboHref,
  facetOf,
  filterTagged,
  sportOfSlug,
  sportsAvailable,
  tagCards,
} from "../src/lib/facets";
import { brandsMenuColumns, sportsMenuColumns } from "../src/components/ShopMenu";
import { navGroups } from "../src/lib/nav";
import { facetSitemapKeys } from "../src/lib/facet-rules";
import { regionSitemap } from "../src/lib/sitemap";
import { REGIONS } from "../src/lib/regions";
import { SPORTS } from "../src/lib/lines";
import type { ProductCardData } from "../src/lib/data";

const card = (slug: string, setCode: string | null, over: Partial<ProductCardData> = {}): ProductCardData => ({
  slug, name: slug, productType: "Hobby Box", setCode, imageUrl: null, lowestPriceCents: 10000, inStockStores: 2, listedStores: 2, marketplaceOpen: false, medianOpenCents: null, releaseDate: null, ...over,
});

test("every sport and brand has a unique URL slug the pages can resolve", () => {
  assert.equal(new Set(SPORTS.map((s) => s.slug)).size, SPORTS.length);
  for (const s of SPORTS) assert.equal(sportOfSlug(s.slug), s.key);
  assert.equal(sportOfSlug("nope"), null);
  assert.equal(new Set(BRANDS.map((b) => b.slug)).size, BRANDS.length);
  assert.equal(BRAND_BY_SLUG.get("upper-deck")!.maker, "Upper Deck");
});

test("a product's sport and brand come from its set code; an unknown code has none", () => {
  const f = facetOf("2024-25|prizm|basketball")!;
  assert.equal(f.sport, "basketball");
  assert.equal(f.brand.slug, "panini");
  assert.equal(facetOf("2025|chrome|baseball")!.brand.slug, "topps");
  assert.equal(facetOf("2024-25|ud-series-1|hockey")!.brand.slug, "upper-deck");
  assert.equal(facetOf("2025|nonsense|baseball"), null);
  assert.equal(facetOf(null), null);
});

test("menus offer only what is listed: no listed sets, no links; one set, its sport, brand and pair", () => {
  const none = availableFrom(new Set());
  assert.equal(sportsAvailable(none).length, 0);
  assert.deepEqual(sportsMenuColumns("us", new Set()), []);
  assert.deepEqual(brandsMenuColumns("us", new Set()), []);
  const one = availableFrom(new Set(["2024-25|prizm|basketball"]));
  assert.deepEqual(sportsAvailable(one).map((s) => s.key), ["basketball"]);
  assert.deepEqual(brandsOfSport(one, "basketball").map((b) => b.slug), ["panini"]);
  const cols = sportsMenuColumns("us", new Set(["2024-25|prizm|basketball"]));
  assert.deepEqual(cols.flatMap((c) => c.links.map((l) => l.href)), ["/us/sport/basketball", "/us/sport/basketball/panini"]);
  const brands = brandsMenuColumns("au", new Set(["2024-25|prizm|basketball"]));
  assert.deepEqual(brands.flatMap((c) => c.links.map((l) => l.href)), ["/au/brand/panini", "/au/sport/basketball/panini"]);
});

test("the sidebar leads with sports and brands, each sport carrying its brands", () => {
  const g = navGroups("us", "2026-11-09", new Set(["2024-25|prizm|basketball", "2025|chrome|baseball"]));
  assert.deepEqual(g.slice(0, 2).map((x) => x.title), ["Shop by sport", "Shop by brand"]);
  assert.deepEqual(g[0].links.map((l) => l.href), ["/us/sport/basketball", "/us/sport/baseball"]);
  assert.deepEqual(g[0].links[0].children!.map((l) => l.href), [comboHref("us", "basketball", BRAND_BY_SLUG.get("panini")!)]);
  assert.deepEqual(g[1].links.map((l) => l.href), ["/us/brand/topps", "/us/brand/panini"]);
});

test("the sitemap lists a sport, brand or pair only with 3 or more comparable products; thin and sold-out ones do not count", () => {
  const cards = [
    card("a", "2024-25|prizm|basketball"),
    card("b", "2024-25|select|basketball"),
    card("c", "2023-24|prizm|basketball"),
    card("d", "2025|chrome|baseball"),
    card("e", "2025|chrome|baseball", { inStockStores: 0, listedStores: 1 }), // sold out at one store: not comparable
  ];
  const tagged = tagCards(cards);
  assert.equal(filterTagged(tagged, { sport: "baseball" }).length, 2, "the page lists it");
  const keys = facetSitemapKeys(tagged);
  assert.deepEqual(keys.sports, ["basketball"]);
  assert.deepEqual(keys.brands, ["panini"]);
  assert.deepEqual(keys.combos, ["basketball/panini"]);
  const urls = regionSitemap(REGIONS.us, { typeLabels: [], setCodes: [], productSlugs: [], lastmod: null, facets: keys }).map((u) => u.url);
  assert.ok(urls.some((u) => u.endsWith("/us/sport/basketball")));
  assert.ok(urls.some((u) => u.endsWith("/us/brand/panini")));
  assert.ok(urls.some((u) => u.endsWith("/us/sport/basketball/panini")));
  assert.ok(!urls.some((u) => u.includes("/baseball")));
});
