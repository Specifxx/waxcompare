// The side rails (components/SideAds.tsx, ported from DexCompare 2026-11-06: eBay down the far left; Amazon down the far right since 2026-11-09, TCGplayer sells no sealed sports cards).
// Pinned: browser-only from 1280px (nothing in the server HTML, no layout shift), ten tiles that scroll, the placements, Amazon with no price and never in the dock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLACEMENTS } from "../src/lib/affiliate";
import { MAX_TILES, MIN_WIDTH, TILE_H, mergeListings, railFits } from "../src/components/SideAds";
import { DOCK_ARM, dockShows, interleave, type DockState } from "../src/components/AdDock";

const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

test("side rails: wide screens only, the same width in the hook and the class, drawn in the browser after a matchMedia check", () => {
  assert.equal(MIN_WIDTH, 1280, "every regular 16:9 and 16:10 screen (owner, 2026-11-06)");
  assert.match(src("app/globals.css"), /\.max-w-shell \{\s*max-width: none;\s*width: auto;\s*margin-left: 0;\s*margin-right: 0;/, "the page column keeps the whole width: no rails (owner, 2026-11-13)");
  const s = src("components/SideAds.tsx");
  assert.match(s, /^"use client";/, "a client component");
  assert.match(s, /min-\[1280px\]:flex/, "the CSS gate says the same width");
  assert.match(s, /window\.matchMedia\(`\(min-width: \$\{MIN_WIDTH\}px\)`\)/, "mounted only when the viewport fits");
  assert.match(s, /const \[fit, setFit\] = useState\(false\);[\s\S]*if \(!SIDE_RAILS \|\| !fit\) return null;/, "nothing is rendered before the check or when nothing fits (no SSR markup)");
  assert.match(s, /"fixed z-30 hidden flex-col/, "fixed beside the shell: takes no space, below the header (z-40) and the quick view (z-50)");
  for (const p of ["listings-side", "amazon-side"]) assert.ok((PLACEMENTS as readonly string[]).includes(p), `${p} is a placement`);
  assert.match(s, /useListings\(\{ region, context: "sealed", placement, min: 1, eager: true \}\)/, "the eBay rail shares the home strip's sealed request");
  assert.match(s, />Ad<\/span>/, "labelled Ad");
  assert.match(s, /rel=\{REL_SPONSORED\}/, "sponsored links");
  assert.match(s, /rel=\{REL_AMAZON\}/, "Amazon links carry Amazon's own rel");
  assert.match(s, /AMAZON_DISCLOSURE/, "the Associates disclosure sits under the rail");
  assert.match(s, /fetch\(`\/api\/rails\/amazon\/\$\{region\}`\)/, "the Amazon rail asks for its tiles in the browser");
});

test("side rails: up to ten tiles that scroll inside the rail, popular sealed first, no listing twice", () => {
  assert.equal(MAX_TILES, 10);
  assert.ok(!railFits(300), "too short for one whole tile: no rail");
  assert.ok(railFits(720), "a 1280×720 window has rails");
  assert.ok(TILE_H > 160 && TILE_H < 240, `a tile is ${TILE_H}px tall`);
  assert.match(src("components/SideAds.tsx"), /overflow-y-auto/, "the list scrolls");
  const item = (id: string) => ({ id }) as never;
  const ready = (ids: string[]) => ({ status: "ready", a: { items: ids.map(item) } }) as never;
  const merged = mergeListings([ready(["a", "b", "c", "d", "e", "f", "g", "h"]), ready(["c", "i", "j", "k", "l"]), { status: "none" } as never]);
  assert.deepEqual(merged.map((i: { id: string }) => i.id), ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);
});

test("the region layout mounts the rails once, after the footer; the server HTML of a page never holds them", () => {
  const layout = src("app/[region]/layout.tsx");
  assert.match(layout, /<Footer region=\{r\.region\}( listed=\{listed\})? \/>\s*\{\/\*[\s\S]*?\*\/\}\s*<SideAds region=\{r\.region\} \/>/, "after the footer");
  assert.equal(layout.match(/<SideAds /g)?.length, 1);
});

test("the home page gets the same rails, in the visitor's region, read per request (never at build)", () => {
  const home = src("app/(site)/page.tsx");
  assert.match(home, /^export const dynamic = "force-dynamic"/m);
  assert.match(home, /<SoftSideAds \/>/);
  assert.match(src("components/SideAds.tsx"), /export function SoftSideAds[\s\S]*?useSoftRegion\(\)/);
});

test("the phone dock: narrow screens only, never on the first screen, never beside another unit, the buy bar or a dialog", () => {
  const ok: DockState = { narrow: true, scrolled: 1000, screen: 800, blockers: 0, buybar: false, modal: false, typing: false, dismissed: false };
  assert.ok(dockShows(ok));
  assert.ok(!dockShows({ ...ok, narrow: false }), "wide screens have the rails");
  assert.ok(!dockShows({ ...ok, scrolled: 800 * DOCK_ARM - 1 }), "not on the first screen");
  assert.ok(!dockShows({ ...ok, blockers: 1 }), "another unit or the footer in view");
  assert.ok(!dockShows({ ...ok, buybar: true }), "never on a page with the buy bar");
  assert.ok(!dockShows({ ...ok, modal: true }), "never over a dialog or the menu");
  assert.ok(!dockShows({ ...ok, typing: true }), "never over the keyboard");
  assert.ok(!dockShows({ ...ok, dismissed: true }));
  assert.deepEqual(interleave([{ items: ["e1", "e2", "e3"] }, { items: ["t1"] }]), ["e1", "t1", "e2", "e3"], "the sides take turns");
  const d = src("components/AdDock.tsx");
  assert.match(d, /^"use client";/);
  assert.match(d, /return armed \? <>\{children\}<\/> : null;/, "nothing rendered or fetched before the visitor scrolls");
  assert.match(d, /translate-y-full/, "slides on transform only (CLS 0)");
  assert.match(d, /querySelectorAll\(`footer, \[data-dock-yield\], \[data-rate-card\], \$\{yieldTo\}`\)/, "hides beside every other unit, the rating card and the footer");
  assert.match(d, /yieldTo = "\[data-ad\]"/, "every [data-ad] unit by default");
  assert.match(d, /sessionStorage\.setItem\(DISMISS_KEY, "1"\)/, "✕ hides it for the visit");
  assert.match(d, />Ad<\/span>/, "labelled Ad");
  const s = src("components/SideAds.tsx");
  assert.ok((PLACEMENTS as readonly string[]).includes("listings-dock"), "listings-dock is a placement");
  assert.match(s, /placement="?\{?placement\}?[\s\S]*minWidth=\{MIN_WIDTH\}/);
  assert.doesNotMatch(d, /amazon/i, "no Amazon in the dock");
  const dock = s.slice(s.indexOf("function PhoneDock"));
  assert.doesNotMatch(dock, /amazon/i, "no Amazon in the dock (an overlay: Associates rules)");
});

test("the Amazon rail: tagged links, never a price, its own placement, no AdSense", () => {
  const rail = src("lib/amazon-rail.ts");
  assert.match(rail, /placement: "amazon-side"/);
  assert.doesNotMatch(rail, /priceCents|amazonLiveFor\([^)]*\)\??\.cents/, "no price in the rail's tiles");
  const route = src("app/api/rails/amazon/[region]/route.ts");
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /s-maxage=86400/, "kept by the CDN for a day");
  assert.doesNotMatch(src("components/SideAds.tsx"), /adsbygoogle|adsense/i);
});
