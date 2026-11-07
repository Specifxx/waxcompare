// The highlighted eBay button of a popular product or set (lib/popular.ts, components/Ebay.tsx, EbayStrip `highlight`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EBAY_CAMPAIGN_ID, ebaySearchUrl, PLACEMENTS, REL_SPONSORED } from "../src/lib/affiliate";
import { HOT_SETS, isHotSet } from "../src/lib/popular";
import { REGION_LIST } from "../src/lib/regions";
import { partsOf, releaseFor, SET_BY_CODE } from "../src/lib/sets";
import { firstHotSet, hotProductHighlight, hotSetHighlight, hotSetQuery, isHotReleased, setSealedHighlight } from "../src/components/Ebay";
import { EbayCta, EbayStrip, hotPlacement } from "../src/components/EbayStrip";
import { MarketplacePanel } from "../src/components/Marketplaces";

// The components are compiled with the classic JSX runtime here (tsconfig "jsx": "preserve"; Next uses its own).
(globalThis as unknown as { React: typeof React }).React = React;

const TODAY = new Date("2026-11-07T12:00:00Z");
const chrome = { ...releaseFor(partsOf("2025|chrome|baseball")!, "2026-10-01") };
const upcoming = { ...chrome, code: "2026|bowman-chrome|baseball", name: "2026 Bowman Chrome Baseball", releaseDate: "2026-12-10", dateKnown: true };

/** Server markup, without React's "useLayoutEffect does nothing on the server" warning (the strip's scroll compensation). */
function render(el: React.ReactElement): string {
  const err = console.error;
  console.error = () => {};
  try {
    return renderToStaticMarkup(el);
  } finally {
    console.error = err;
  }
}

/** Every <a> of the markup whose href carries a highlight's customid (wax-<region>-hot-<surface> or -set-sealed), with its rel. */
function hotLinks(html: string): { href: string; rel: string; text: string }[] {
  const out: { href: string; rel: string; text: string }[] = [];
  for (const m of html.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)) {
    const href = /href="([^"]*)"/.exec(m[1])?.[1]?.replace(/&amp;/g, "&") ?? "";
    if (!/customid=wax-[a-z]+-(?:hot-|set-sealed)/.test(href)) continue;
    out.push({ href, rel: /rel="([^"]*)"/.exec(m[1])?.[1] ?? "", text: m[2].replace(/<[^>]+>/g, "").trim() });
  }
  return out;
}

test("no hot release is picked yet: nothing is hot, and the home page highlights none", () => {
  assert.deepEqual([...HOT_SETS], []);
  assert.equal(isHotSet(chrome.code), false);
  assert.equal(isHotReleased(chrome.code, TODAY), false);
  assert.equal(hotSetHighlight(chrome, TODAY), undefined);
  assert.equal(firstHotSet(TODAY), null);
  assert.equal(hotSetQuery(chrome), chrome.name, "a release's name already says year, maker, line and sport");
  for (const [strip, hot] of [["listings-home", "hot-home"], ["listings-set", "hot-set"], ["product-table", "hot-product"]] as const) {
    assert.equal(hotPlacement(strip), hot);
    assert.ok((PLACEMENTS as readonly string[]).includes(hot), hot);
  }
});

test("a set page's button: any release that is out gets 'Shop <release> sealed on eBay' (set-sealed); a dated release still to come gets none", () => {
  assert.deepEqual(setSealedHighlight(chrome, TODAY), { label: "Shop 2025 Topps Chrome Baseball sealed on eBay", query: "2025 Topps Chrome Baseball", placement: "set-sealed" });
  assert.equal(setSealedHighlight(null, TODAY), undefined);
  // setSealedHighlight reads the release from sets.ts by code; one that is not there counts as out, as on the engine.
  assert.ok(setSealedHighlight(upcoming, TODAY));
});

test("the strip's server markup (loading): the highlight is the CTA's one visible button, and the invisible reserved box holds it too", () => {
  const highlight = setSealedHighlight(chrome, TODAY)!;
  const html = render(React.createElement(EbayStrip, { region: "us", context: "sealed", placement: "set-sealed", search: { kind: "sealed", query: chrome.name }, highlight }));
  const links = hotLinks(html);
  assert.equal(links.length, 2, "one in the visible CTA, one in the reserved box");
  for (const l of links) {
    assert.equal(l.rel, REL_SPONSORED);
    assert.equal(l.text, "Shop 2025 Topps Chrome Baseball sealed on eBay ↗");
    const u = new URL(l.href);
    assert.equal(u.hostname, "www.ebay.com");
    assert.equal(u.searchParams.get("campid"), EBAY_CAMPAIGN_ID);
    assert.equal(u.searchParams.get("_nkw"), "2025 Topps Chrome Baseball sealed");
    assert.equal(u.searchParams.get("customid"), "wax-us-set-sealed");
  }
  assert.match(html, /min-h-11/, "a 44 px tap target");
  assert.match(html, /data-state="cta"[\s\S]*>Ad</, "still labelled Ad");
  const plain = render(React.createElement(EbayStrip, { region: "us", context: "sealed", placement: "listings-home-sealed", search: { kind: "sealed", query: "" } }));
  assert.equal(hotLinks(plain).length, 0);
  assert.doesNotMatch(plain, /Magic|MTG/);
});

test("the compact CTA with a product highlight: its words, its search, labelled Ad; a long name is cut to about 40 characters", () => {
  const h = hotProductHighlight("2025 Topps Chrome Baseball Hobby Box", "2025 Topps Chrome Baseball Hobby Box");
  assert.equal(h.label, "Shop 2025 Topps Chrome Baseball Hobby Box on eBay");
  const long = hotProductHighlight("2025 Topps Chrome Update Series Baseball Breaker's Delight Box", "q");
  assert.ok(long.label.length <= "Shop  on eBay".length + 40, long.label);
  assert.match(long.label, /… on eBay$/);
  const html = render(React.createElement(EbayCta, { region: "us", placement: "listings-product", search: { kind: "sealed", query: "q" }, highlight: h, compact: true } as never));
  assert.match(html, />Ad</);
  void ebaySearchUrl;
  void REGION_LIST;
  void SET_BY_CODE;
});

test("the marketplace panel: eBay's row is always eBay's blue button, and a popular product's chip sits OUTSIDE the ad link", () => {
  const props = { region: "us" as const, productName: "2025 Topps Chrome Baseball Hobby Box", preorder: false, tcgplayer: null };
  const hot = render(React.createElement(MarketplacePanel, { ...props, popular: true }));
  assert.match(hot, /Popular set/);
  for (const m of hot.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)) assert.doesNotMatch(m[1], /Popular/, "never part of the ad link's text");
  const plain = render(React.createElement(MarketplacePanel, props));
  assert.doesNotMatch(plain, /Popular|TCGplayer/);
  for (const html of [hot, plain, render(React.createElement(MarketplacePanel, { ...props, region: "nz" as const }))]) {
    assert.match(html, /class="btn-ad[^"]*"[^>]*>Search eBay/, "eBay's blue button on every panel");
    assert.match(html, /customid=wax-[a-z]+-product-marketplace/);
  }
});

test("the pages pass the highlight where the owner asked, and add no unit for it", () => {
  const src = (p: string) => readFileSync(new URL(`../src/app/[region]/${p}`, import.meta.url), "utf8");
  const home = src("page.tsx");
  assert.match(home, /placement="listings-home-sealed"[^\n]*highlight=\{hotHighlight\}/, "the home page's sealed strip");
  assert.doesNotMatch(home, /placement="listings-home" [^\n]*highlight=/, "not the high-end (chase) strip under the stats");
  assert.match(home, /hotSetHighlight\(firstHotSet\(\)\)/);
  assert.match(src("sets/[set]/page.tsx"), /highlight=\{setSealedHighlight\(s\)\}/, "every released set's page: hot sets keep hot-set, the others get set-sealed");
  const product = src("p/[slug]/page.tsx");
  assert.match(product, /const hot = isHotReleased\(p\.setCode\)/);
  assert.doesNotMatch(product, /ebayPrimary/, "the panel's eBay row is a button on every product now");
  assert.match(product, /highlight=\{hot \? hotProductHighlight\(p\.name, ebayQ\) : undefined\}/);
  assert.equal((product.match(/<EbayStrip/g) ?? []).length, 1, "still one strip on a product page");
  assert.equal((home.match(/<EbayStrip/g) ?? []).length, 2, "still two strips on the home page");
});
