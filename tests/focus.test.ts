// lib/focus.ts: the popularity cull (owner, 2026-11-08) and lib/culled.ts, where a culled product's URL goes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { currentRelease, demandSlugs, focusCatalog, type FocusOffer, type FocusProduct } from "../src/lib/focus";
import { culledTarget } from "../src/lib/culled";

const NOW = new Date("2026-11-08T00:00:00Z");
const P = (id: string, productType: string, setCode: string): FocusProduct => ({ id, slug: `p-${id}`, productType, setCode });
const O = (productId: string, store: string, market: string, inStock = true): FocusOffer => ({ productId, store, market, inStock });

test("current releases: this year's and next, and a season that ends this year or later", () => {
  for (const c of ["2026|chrome|baseball", "2027|topps-flagship|soccer|premier-league", "2025-26|prizm|basketball", "2026-27|ud-series-1|hockey"]) assert.ok(currentRelease(c, NOW), c);
  for (const c of ["2025|chrome|baseball", "2024-25|prizm|basketball", "2019|bowman|baseball", null]) assert.ok(!currentRelease(c, NOW), String(c));
  // In January the year just gone still counts.
  assert.ok(currentRelease("2026|chrome|baseball", new Date("2027-01-20T00:00:00Z")));
});

test("listed: a comparison (2+ stores in stock in one market), a current core box in stock anywhere, or search demand", () => {
  const products = [
    P("a", "Hobby Box", "2025|chrome|baseball"), // old release, two stores in stock in one market: kept
    P("b", "Hobby Box", "2025|chrome|baseball"), // old release, one store each in two markets: culled
    P("c", "Blaster Box", "2026|chrome|baseball"), // current core box, one store: kept
    P("d", "Pack", "2026|chrome|baseball"), // current, not core, one store: culled
    P("e", "Tin", "2019|bowman|baseball"), // old, sold out: culled, unless searched
    P("f", "Hobby Box", "2026|chrome|baseball"), // current core, listed but sold out: culled
  ];
  const offers = [O("a", "s1", "US"), O("a", "s2", "US"), O("b", "s1", "US"), O("b", "s3", "CA"), O("c", "s1", "AU"), O("d", "s1", "US"), O("e", "s1", "US", false), O("f", "s1", "US", false)];
  const { keep, culled } = focusCatalog(products, offers, new Set(), NOW);
  assert.deepEqual([...keep].sort(), ["a", "c"]);
  assert.deepEqual(Object.keys(culled).sort(), ["p-b", "p-d", "p-e", "p-f"]);
  assert.ok(focusCatalog(products, offers, new Set(["p-e"]), NOW).keep.has("e"), "a searched page stays");
});

test("a culled URL goes to its release page where the release still lists something, else its type page, else home", () => {
  const file = { "p-x": { s: "2025-topps-chrome-baseball", m: ["US"], t: "hobby-boxes" }, "p-y": { s: "", m: [], t: "" } };
  assert.equal(culledTarget("p-x", "us", "US", file), "/us/sets/2025-topps-chrome-baseball");
  assert.equal(culledTarget("p-x", "au", "AU", file), "/au/type/hobby-boxes");
  assert.equal(culledTarget("p-y", "uk", "UK", file), "/uk");
  assert.equal(culledTarget("never-culled", "us", "US", file), null);
});

test("demand: a click or 10+ impressions on a product page", () => {
  const s = demandSlugs({ "/us/p/a": [1, 0], "/au/p/b": [0, 12], "/us/p/c": [0, 3], "/us/sets/d": [5, 50] });
  assert.deepEqual([...s].sort(), ["a", "b"]);
});
