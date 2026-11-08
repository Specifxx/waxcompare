// The "Coming soon" block (lib/coming-soon.ts, components/ComingSoon.tsx): the next release with an ANNOUNCED date, its headline
// products' cheapest open store pre-order in a region, an honest line when no store has opened one, gone on release day. A release
// read only from store titles has no date to count down to, so it is never "coming soon".
import { test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ComingSoon } from "../src/components/ComingSoon";
import { daysUntil, featuredFor, featuredItems, nextUpcomingSet } from "../src/lib/coming-soon";
import { REGIONS } from "../src/lib/regions";
import { partsOf, releaseFor, SETS } from "../src/lib/sets";

(globalThis as unknown as { React: typeof React }).React = React;

const NOW = Date.parse("2026-10-26T12:00:00Z");
const seen = new Date(NOW - 3600_000).toISOString();
const CODE = "2026|chrome|baseball";
const dated = (code: string, date: string) => ({ ...releaseFor(partsOf(code)!, "2026-10-26"), releaseDate: date, dateKnown: true });
const CHROME = dated(CODE, "2026-11-13");
const LATER = dated("2026|heritage|baseball", "2027-03-04");
const UNDATED = releaseFor(partsOf("2026|finest|baseball")!, "2026-10-01"); // seen in stores: no date to count down to
const RELEASES = [LATER, UNDATED, CHROME];
const offer = (store: string, priceCents: number, inStock = true, marketplace = false) => ({ store, storeName: store, priceCents, inStock, lastSeen: seen, marketplace });
const group = (slug: string, name: string, productType: string, offers: ReturnType<typeof offer>[]) => ({ product: { slug, name, productType, setCode: CODE }, offers });

const GROUPS = [
  group("2026-topps-chrome-baseball-hobby-box", "2026 Topps Chrome Baseball Hobby Box", "Hobby Box", [offer("a", 32000), offer("b", 31500), offer("c", 29000, false)]),
  group("2026-topps-chrome-baseball-blaster-box", "2026 Topps Chrome Baseball Blaster Box", "Blaster Box", [offer("tcgplayer", 3000, true, true), offer("a", 4500)]),
  group("2026-topps-chrome-baseball-hobby-pack", "2026 Topps Chrome Baseball Hobby Pack", "Hobby Pack", [offer("a", 1500)]),
];

test("the next release is the soonest DATED one after today; on its release day the next one (or none); never an undated one", () => {
  assert.equal(nextUpcomingSet("2026-10-26", RELEASES)?.code, CODE);
  assert.equal(nextUpcomingSet("2026-11-13", RELEASES)?.code, LATER.code);
  assert.equal(nextUpcomingSet("2027-03-04", RELEASES), null);
  assert.equal(nextUpcomingSet("2026-10-26", [UNDATED]), null);
  assert.equal(nextUpcomingSet("2026-10-26"), SETS.find((s) => s.dateKnown && s.releaseDate > "2026-10-26") ? nextUpcomingSet("2026-10-26") : null, "releases.json starts empty");
  assert.equal(daysUntil("2026-11-13", "2026-10-26"), 18);
});

test("selection: cheapest open STORE pre-order per headline type, stores counted, no MSRP claimed", () => {
  const items = featuredItems(GROUPS, "US", CODE, NOW);
  assert.deepEqual(items.map((i) => i.type), ["hobby-box", "blaster-box"], "only headline types with an open store pre-order (a pack is not one)");
  const box = items[0];
  assert.equal(box.cents, 31500);
  assert.equal(box.stores, 2, "the sold-out store is not taking pre-orders");
  assert.equal(box.slug, "2026-topps-chrome-baseball-hobby-box");
  assert.equal(items[1].cents, 4500, "TCGplayer is a marketplace, never the cheapest store");
  for (const i of items) assert.equal(i.msrpCents, null, "no MSRP is claimed for a sports release");
});

test("render: name, date, days to go, prices linking each product page, and the release's page", () => {
  const f = featuredFor(REGIONS.us, GROUPS, "2026-10-26", NOW, RELEASES);
  const html = renderToStaticMarkup(React.createElement(ComingSoon, { featured: f, r: REGIONS.us, today: "2026-10-26" }));
  assert.match(html, /2026 Topps Chrome Baseball: out in 18 days/);
  assert.match(html, /13 November 2026/);
  assert.match(html, /href="\/us\/p\/2026-topps-chrome-baseball-hobby-box"/);
  assert.match(html, /\$315/);
  assert.match(html, /pre-order at 2 stores/);
  assert.doesNotMatch(html, /MSRP|MTG|Magic/);
  assert.match(html, /href="\/us\/sets\/2026-topps-chrome-baseball"/, "no pre-order hubs on SportsCardCompare: the release's own page");
  assert.match(html, /See every store/);
});

test("an empty region says so and still links the release", () => {
  const f = featuredFor(REGIONS.sg, [], "2026-10-26", NOW, RELEASES);
  const html = renderToStaticMarkup(React.createElement(ComingSoon, { featured: f, r: REGIONS.sg, today: "2026-10-26" }));
  assert.match(html, /No store we track has opened pre-orders in Singapore yet/);
  assert.match(html, /href="\/sg\/sets\/2026-topps-chrome-baseball"/);
  assert.doesNotMatch(html, /data-coming-soon-item/);
});

test("hidden on and after release day", () => {
  const f = featuredFor(REGIONS.us, GROUPS, "2026-10-26", NOW, RELEASES);
  assert.equal(renderToStaticMarkup(React.createElement(ComingSoon, { featured: f, r: REGIONS.us, today: "2026-11-13" })), "");
  const later = featuredFor(REGIONS.us, GROUPS, "2026-11-13", NOW, RELEASES);
  assert.notEqual(later?.set.code, CODE);
  assert.equal(featuredFor(REGIONS.us, GROUPS, "2026-10-26", NOW, [UNDATED]), null);
});
