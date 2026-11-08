// lib/seo-titles.ts: every price page's <title> as a results page shows it is at most 60 characters (with " | SportsCardCompare" only when
// that still fits), every description at most 160, led by the query people search; and the route files use these builders.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findBannedCopy } from "../src/lib/copy-rules";
import { REGION_LIST, REGIONS } from "../src/lib/regions";
import { PRODUCT_TYPES } from "../src/lib/sealed-title";
import { partsOf, releaseFor, SETS } from "../src/lib/sets";
import { fitDescription, seoCopy, shortName, shownTitle, type SeoTitle } from "../src/lib/seo-titles";

function rule(t: SeoTitle, label: string) {
  const shown = shownTitle(t);
  assert.ok(shown.length <= 60, `${label}: "${shown}" is ${shown.length}`);
  if (typeof t !== "string") assert.ok(t.absolute.length + " | SportsCardCompare".length > 60, `${label}: absolute for a title that fits the suffix`);
  assert.doesNotMatch(shown, /\bMTG\b|\bMagic\b/, `${label}: an MTG word`);
  assert.equal(findBannedCopy(shown), null, label);
}

test("region pages: home, deals, cheapest packs, this week, guides, stores, sets, releases fit 60 / 160 in every region", () => {
  for (const r of REGION_LIST) {
    for (const [k, t] of Object.entries({
      home: seoCopy.homeTitle(r, 114),
      deals: seoCopy.dealsTitle(r),
      packs: seoCopy.packsTitle(r),
      digest: seoCopy.digestTitle(r),
      guides: seoCopy.guidesTitle(r),
      stores: seoCopy.storesTitle(r, 114),
      sets: seoCopy.setsIndexTitle(r),
      releases: seoCopy.releasesTitle(r, 2026),
    }))
      rule(t, `${r.region} ${k}`);
    for (const d of [
      seoCopy.homeDescription(r, 114, 12345),
      seoCopy.dealsDescription(r, 120, 45),
      seoCopy.dealsDescription(r, 0, null),
      seoCopy.packsDescription(r, null),
      seoCopy.guidesDescription(r),
      seoCopy.storesDescription(r, 114),
    ])
      assert.ok(d.length <= 160, `${r.region}: ${d.length} "${d}"`);
  }
  assert.equal(shownTitle(seoCopy.homeTitle(REGIONS.us, 114)), "Hobby box & blaster prices in the US: 114 card shops");
  assert.equal(shownTitle(seoCopy.storesTitle(REGIONS.au, 60)), "Where to buy sealed sports cards in Australia: 60 shops");
});

test("type pages lead with '<type> prices in <region>', and keep the live from-price when it fits", () => {
  const hobby = PRODUCT_TYPES.find((t) => t.slug === "hobby-boxes")!;
  assert.equal(shownTitle(seoCopy.typeTitle(hobby, REGIONS.us, 20, 9895)), "Hobby Box prices in the US: from $98.95 | SportsCardCompare");
  for (const t of PRODUCT_TYPES)
    for (const r of REGION_LIST)
      for (const [open, from] of [[0, null], [3, 999], [1234, 1234567]] as const) {
        rule(seoCopy.typeTitle(t, r, open, from), `${t.slug}/${r.region}`);
        assert.ok(seoCopy.typeDescription(t, r, { open, total: open + 40 }, from).length <= 160, `${t.slug}/${r.region} description`);
      }
});

test("set pages: pre-order wording and date while upcoming, never 'hobby box' for a release sold without one, 60 for every name and region", () => {
  const chrome = releaseFor(partsOf("2025|chrome|baseball")!, "2026-10-01");
  assert.equal(shownTitle(seoCopy.setTitle(chrome, REGIONS.us, { preorder: false, withoutBox: false, date: "" })), "2025 Topps Chrome Baseball hobby box prices in the US", "the extras drop first past 60");
  assert.match(shownTitle(seoCopy.setTitle(chrome, REGIONS.au, { preorder: true, withoutBox: false, date: "3 Dec 2026" })), /^2025 Topps Chrome Baseball (hobby box )?pre-orders in Australia/);
  const names = [chrome, releaseFor(partsOf("2025-26|chrome|basketball")!, "2026-10-01"), releaseFor(partsOf("2025|chrome-update|baseball")!, "2026-10-01"), ...SETS];
  for (const s of names)
    for (const r of REGION_LIST)
      for (const preorder of [true, false])
        for (const withoutBox of [true, false]) {
          const t = seoCopy.setTitle(s, r, { preorder, withoutBox, date: "13 Nov 2026" });
          rule(t, `${s.slug}/${r.region}`);
          if (withoutBox) assert.doesNotMatch(shownTitle(t), /hobby box/i, s.slug);
          if (preorder) assert.match(shownTitle(t), /pre-order/, s.slug);
        }
});

test("product titles: '<name> price in <region>: from <price>' while it fits; a long store title is tidied and cut at a word", () => {
  assert.equal(shownTitle(seoCopy.productTitle({ name: "2025 Topps Chrome Baseball Hobby Box", market: "US", inName: "the US", cheapestCents: 24500 })), "2025 Topps Chrome Baseball Hobby Box price in the US", "the from-price drops first past 60");
  assert.equal(shownTitle(seoCopy.productTitle({ name: "2025 Bowman Baseball Jumbo Box", market: "US", inName: "the US", cheapestCents: 24500 })), "2025 Bowman Baseball Jumbo Box price in the US: from $245");
  const long = "2025-26 Topps Chrome Basketball Breaker's Delight Hobby Box Factory Sealed Sports Trading Cards";
  const t = shownTitle(seoCopy.productTitle({ name: long, market: "US", inName: "the US", cheapestCents: 3999, productType: "Breaker's Delight Box" }));
  assert.ok(t.length <= 60, t);
  assert.match(t, /^2025-26 Topps Chrome Basketball/);
  for (const w of shortName(long, 54).split(" ")) assert.ok(long.includes(w), `"${w}" is the store's own word`);
});

test("fitDescription: the first that fits, else cut at a word with an ellipsis", () => {
  assert.equal(fitDescription("a".repeat(170), "short"), "short");
  const cut = fitDescription(`${"word ".repeat(50)}end`);
  assert.ok(cut.length <= 160 && cut.endsWith("…"), cut);
});

test("the route files build their <title>s with lib/seo-titles.ts", () => {
  const src = (p: string) => readFileSync(`src/app/[region]/${p}`, "utf8");
  for (const [p, fn] of [
    ["page.tsx", "homeTitle"],
    ["deals/page.tsx", "dealsTitle"],
    ["this-week/page.tsx", "digestTitle"],
    ["guides/page.tsx", "guidesTitle"],
    ["stores/page.tsx", "storesTitle"],
    ["sets/page.tsx", "setsIndexTitle"],
    ["releases/page.tsx", "releasesTitle"],
    ["type/[type]/page.tsx", "typeTitle"],
    ["sets/[set]/page.tsx", "setTitle"],
    ["p/[slug]/page.tsx", "productTitle"],
    ["stores/[store]/StoreListing.tsx", "storeTitle"],
  ])
    assert.match(src(p), new RegExp(`seoCopy\\.${fn}\\(`), p);
});

test("product titles keep the region and the product type, so siblings and regions never share a title (2026-10-26 audit)", () => {
  const t = (name: string, productType: string, market: string, inName: string) => shownTitle(seoCopy.productTitle({ name, productType, market, inName, cheapestCents: null }));
  const base = "2025-26 Topps Chrome Update Series Basketball Sapphire Edition";
  const types = ["Hobby Box", "Jumbo Box", "Blaster Box", "Mega Box"].map((ty) => t(`${base} ${ty}`, ty, "US", "the US"));
  assert.equal(new Set(types).size, 4, types.join(" / "));
  for (const x of types) assert.ok(x.length <= 60, x);
  assert.notEqual(t(`${base} Hobby Box`, "Hobby Box", "AU", "Australia"), t(`${base} Hobby Box`, "Hobby Box", "CA", "Canada"));
});
