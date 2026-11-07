// Amazon Australia (Amazon Associates) links: the URL helper, region gating, rel/target, the footer disclosure, the disclosure page,
// and the amazon_click wiring.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PLACEMENTS } from "../src/lib/affiliate";
import { AMAZON_DEFAULT_TAG, AMAZON_DISCLOSURE, amazonFor, amazonRegion, amazonRegions, amazonTag, amazonUrl, asinFor, REL_AMAZON } from "../src/lib/amazon";
import { REGION_LIST, REGIONS, type Region } from "../src/lib/regions";
import { AmazonLink, AmazonProductRow } from "../src/components/Amazon";
import { Footer } from "../src/components/Footer";
import AffiliateDisclosure, { metadata as disclosureMeta } from "../src/app/(site)/affiliate-disclosure/page";
import { staticSitemap } from "../src/lib/sitemap";
import { findBannedCopy } from "../src/lib/copy-rules";

(globalThis as unknown as { React: typeof React }).React = React;

function render(el: React.ReactElement): string {
  const router = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };
  const err = console.error;
  console.error = () => {};
  try {
    return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: router as never }, el));
  } finally {
    console.error = err;
  }
}
const amazonAnchors = (html: string) => [...html.matchAll(/<a [^>]*href="https:\/\/www\.amazon\.[a-z.]+\/[^"]*"[^>]*>/g)].map((m) => m[0]);

test("amazonUrl: /dp/<ASIN> when the ASIN is known, else a search; the tag on both", () => {
  assert.equal(amazonUrl("Anything", { slug: "x", asins: { x: "B0ABCDEFGH" }, tag: "t-22" }), "https://www.amazon.com.au/dp/B0ABCDEFGH?tag=t-22");
  const s = new URL(amazonUrl("2025 Topps Chrome Baseball Hobby Box - LIMIT 2 PER CUSTOMER", { tag: "t-22", asins: {} }));
  assert.equal(s.origin + s.pathname, "https://www.amazon.com.au/s");
  assert.equal(s.searchParams.get("k"), "2025 Topps Chrome Baseball Hobby Box", "the cleaned name, no game word");
  assert.equal(s.searchParams.get("tag"), "t-22");
  // spaces and & are encoded
  const u = amazonUrl("2025 Topps Chrome & Update Baseball Hobby Box", { tag: "t-22", asins: {} });
  assert.match(u, /\?k=2025%20Topps%20Chrome%20%26%20Update%20Baseball%20Hobby%20Box&tag=t-22$/);
  // A bad ASIN in the map is never used.
  assert.equal(asinFor("x", { x: "not-an-asin" }), null);
  assert.equal(asinFor(null), null);
});

test("amazonTag: compareempire-22 (the account's own AU tag until waxcompare-22 exists), hard-coded (owner, 2026-11-02: no Vercel variable decides a tag)", () => {
  assert.equal(AMAZON_DEFAULT_TAG, "compareempire-22");
  assert.equal(amazonTag(), "compareempire-22");
  assert.match(amazonUrl("Hobby Box", { asins: {} }), /&tag=compareempire-22$/);
  assert.doesNotMatch(readFileSync(new URL("../src/lib/amazon.ts", import.meta.url), "utf8"), /process\.env/);
});

test("the ASIN map is a JSON object of slug → 10-character ASIN (never guessed; empty is fine)", () => {
  const map = JSON.parse(readFileSync(new URL("../src/data/amazon-asins.json", import.meta.url), "utf8")) as Record<string, string>;
  assert.equal(typeof map, "object");
  for (const [k, v] of Object.entries(map)) assert.match(v, /^[A-Z0-9]{10}$/, k);
});

test("region gating: Amazon AU in AU, NZ and SG; Amazon US, UK, CA and DE in their regions with the owner's tags", () => {
  const shown = ["au", "ca", "eu", "nz", "sg", "uk", "us"];
  assert.deepEqual(amazonRegions().sort(), [...shown].sort());
  assert.equal(amazonFor("us")!.tag, "riftcompare-20");
  assert.equal(amazonFor("uk")!.tag, "compareempi03-21", "the owner's UK account (2026-11-02)");
  assert.equal(amazonFor("ca")!.tag, "compareempire-20");
  assert.equal(amazonFor("eu")!.tag, "compareempire-21");
  assert.equal(amazonFor("uk")!.host, "www.amazon.co.uk");
  assert.equal(amazonFor("eu")!.host, "www.amazon.de");
  const us = new URL(amazonUrl("Reality Fracture Bundle", { region: "us", placement: "amazon-table" }));
  assert.equal(us.origin + us.pathname, "https://www.amazon.com/s");
  assert.equal(us.searchParams.get("tag"), "riftcompare-20");
  assert.equal(us.searchParams.get("ascsubtag"), "wax-us-amazon-table");
  for (const r of REGION_LIST) {
    const yes = shown.includes(r.region);
    assert.equal(amazonRegion(r.region), yes, r.region);
    const row = render(React.createElement(AmazonProductRow, { region: r.region, name: "Reality Fracture Bundle", slug: "reality-fracture-bundle" }));
    assert.equal(amazonAnchors(row).length, yes ? 1 : 0, r.region);
    if (yes) {
      const label = { us: "US", uk: "UK", ca: "CA", eu: "DE" }[r.region as string] ?? "AU";
      assert.match(row, new RegExp(`Check price on Amazon ${label}`));
      assert.match(row, new RegExp(AMAZON_DISCLOSURE.replace(/\./g, "\\.")));
      assert.doesNotMatch(row.replace(/<[^>]+>/g, " "), /\$\d/, "no Amazon price");
    }
  }
  assert.match(render(React.createElement(AmazonProductRow, { region: "nz", name: "B", slug: "b" })), /Amazon Australia \(ships to NZ\)[\s\S]*may ship to New Zealand; check delivery/);
  assert.match(render(React.createElement(AmazonProductRow, { region: "sg", name: "B", slug: "b" })), /may ship to Singapore; check delivery/);
});

test("Amazon links: target=_blank, rel exactly 'sponsored nofollow noopener', placements registered", () => {
  assert.equal(REL_AMAZON, "sponsored nofollow noopener");
  const html = render(React.createElement(AmazonLink, { region: "au", name: "Bundle", placement: "amazon-guide", page: "/au/guides/x" }));
  const [a] = amazonAnchors(html);
  assert.match(a, /target="_blank"/);
  assert.match(a, /rel="sponsored nofollow noopener"/);
  for (const p of ["amazon-table", "amazon-product", "amazon-type", "amazon-set", "amazon-deals", "amazon-guide"]) assert.ok((PLACEMENTS as readonly string[]).includes(p), p);
});

test("amazon_click: OutboundLink sends GA4 amazon_click {product, region, page} and still only buy_click to Vercel", () => {
  const src = readFileSync(new URL("../src/components/OutboundLink.tsx", import.meta.url), "utf8");
  assert.match(src, /gaEvent\("amazon_click", \{ product: [^}]*region: amazon\.region, page: [^}]*\}\)/);
  assert.match(src, /track\("buy_click"/);
  const comp = readFileSync(new URL("../src/components/Amazon.tsx", import.meta.url), "utf8");
  assert.match(comp, /<OutboundLink [^>]*retailer=\{amazonRetailer\(region\)\}[^>]*amazon=\{\{ product: [^}]*region, page \}\}/);
  const track = readFileSync(new URL("../src/lib/track.ts", import.meta.url), "utf8");
  assert.match(track, /new Set\(\["buy_click", "share", "share_visit"\]\)/, "no new Vercel event names beyond the share pair (2026-11-02)");
});

test("footer: the exact Amazon Associates line and the disclosure link, on every layout's footer", () => {
  assert.equal(AMAZON_DISCLOSURE, "As an Amazon Associate I earn from qualifying purchases.");
  for (const region of [null, ...REGION_LIST.map((r) => r.region)] as (Region | null)[]) {
    const html = render(React.createElement(Footer, { region }));
    assert.ok(html.includes("As an Amazon Associate I earn from qualifying purchases."), String(region));
    assert.match(html, /href="\/affiliate-disclosure"/, String(region));
  }
  // Every layout that closes a page renders the Footer.
  for (const f of ["app/[region]/layout.tsx", "app/(site)/layout.tsx", "app/error.tsx", "app/not-found.tsx"]) {
    assert.match(readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8"), /<Footer /, f);
  }
});

test("/affiliate-disclosure renders, covers every program, and is in the sitemap", () => {
  const t = render(React.createElement(AffiliateDisclosure)).replace(/<[^>]+>/g, " ");
  for (const w of ["As an Amazon Associate I earn from qualifying purchases.", "eBay Partner Network", "TCGplayer", "Impact", "Google"]) assert.ok(t.includes(w), w);
  assert.ok(String(disclosureMeta.description).length <= 160);
  assert.ok(staticSitemap({}).some((u) => u.url.endsWith("/affiliate-disclosure")));
});


