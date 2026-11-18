// The phone bottom nav (components/BottomNav.tsx, owner 2026-11-18). Rift's earlier bar was deleted on 2026-09-18 for riding up the screen
// (position arithmetic against the browser's address bar) and floating under pinch-zoom. These pin that THIS one does none of that.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bottomNavActive, bottomNavEnabled, bottomNavShows, nextDir, NAV_DELTA, NAV_DELTA_UP, NAV_TOP, type BottomNavState } from "../src/components/BottomNav";
import { BOTTOM_NAV, bottomNavTabs } from "../src/lib/bottom-nav";

const ok: BottomNavState = { enabled: true, narrow: true, scrollY: 0, dir: "", zoomed: false, typing: false, modal: false, buybar: false, covers: false };

test("shows at the top, hides on scroll down, shows on scroll up", () => {
  assert.ok(bottomNavShows(ok));
  assert.ok(bottomNavShows({ ...ok, scrollY: NAV_TOP - 1, dir: "down" }), "the top of a page always shows it");
  assert.ok(!bottomNavShows({ ...ok, scrollY: 900, dir: "down" }));
  assert.ok(bottomNavShows({ ...ok, scrollY: 900, dir: "up" }));
  assert.ok(!bottomNavShows({ ...ok, scrollY: 900, dir: "" }), "deep in a page with no scroll yet (a restored position): hidden until the visitor scrolls up");
});

test("never shows zoomed, over the keyboard, over a dialog or the menu or the cart, on a buy-bar page, off a phone, or when off", () => {
  for (const k of ["zoomed", "typing", "modal", "buybar", "covers"] as const) assert.ok(!bottomNavShows({ ...ok, [k]: true }), k);
  assert.ok(!bottomNavShows({ ...ok, narrow: false }));
  assert.ok(!bottomNavShows({ ...ok, enabled: false }));
});

test("direction flips only after NAV_DELTA of real movement", () => {
  let s = nextDir("", 500, 500);
  assert.equal(s.dir, "");
  s = nextDir(s.dir, s.anchor, 500 + NAV_DELTA);
  assert.equal(s.dir, "", "exactly the delta is jitter");
  s = nextDir(s.dir, s.anchor, 500 + NAV_DELTA + 1);
  assert.equal(s.dir, "down");
  s = nextDir(s.dir, s.anchor, 700);
  assert.equal(s.dir, "down");
  s = nextDir(s.dir, s.anchor, 700 - NAV_DELTA_UP + 1);
  assert.equal(s.dir, "down", "a small bounce back does not flip it");
  s = nextDir(s.dir, s.anchor, 700 - NAV_DELTA_UP - 1);
  assert.equal(s.dir, "up", "the first real upward flick shows the bar");
  s = nextDir(s.dir, s.anchor, 300);
  assert.equal(s.dir, "up");
});

test("the opt-in: off ignores everything, ?bn=1 keeps it, ?bn=0 clears it, optin needs the keep", () => {
  assert.deepEqual(bottomNavEnabled("off", "?bn=1", "1"), { enabled: false, store: null });
  assert.deepEqual(bottomNavEnabled("optin", "", null), { enabled: false, store: null });
  assert.deepEqual(bottomNavEnabled("optin", "?bn=1", null), { enabled: true, store: "1" });
  assert.deepEqual(bottomNavEnabled("optin", "", "1"), { enabled: true, store: null });
  assert.deepEqual(bottomNavEnabled("optin", "?bn=0", "1"), { enabled: false, store: "0" });
  assert.deepEqual(bottomNavEnabled("on", "", null), { enabled: true, store: null });
  assert.deepEqual(bottomNavEnabled("on", "", "0"), { enabled: false, store: null });
  assert.ok(["off", "optin", "on"].includes(BOTTOM_NAV));
});

test("the tabs: Home first, a cart and a menu, five at most, every link a path on this site, one active tab at a time", () => {
  for (const path of ["/", "/deals", "/search", "/about"]) {
    const tabs = bottomNavTabs(path);
    assert.ok(tabs.length >= 4 && tabs.length <= 5, path);
    assert.equal(tabs[0].key, "home");
    assert.ok(tabs.some((t) => t.action === "cart"));
    assert.ok(tabs.some((t) => t.action === "menu"));
    assert.equal(new Set(tabs.map((t) => t.key)).size, tabs.length);
    for (const t of tabs) if (t.href) assert.match(t.href, /^\/(?!\/)/, `${t.key}: a same-host path`);
    assert.ok(tabs.filter((t) => bottomNavActive(path, t)).length <= 1, path);
  }
  assert.ok(bottomNavActive("/", bottomNavTabs("/")[0]), "Home is active on the home page");
  assert.ok(!bottomNavActive("/about", { href: "/" }), "Home is never active below it");
  assert.ok(bottomNavActive("/deals/x", { href: "/deals" }) && !bottomNavActive("/dealsx", { href: "/deals" }));
});

test("no position arithmetic: no lvh/dvh/svh, no visualViewport height or offset, bottom never animated", () => {
  const src = readFileSync(new URL("../src/components/BottomNav.tsx", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  assert.ok(!/\b\d*(lvh|dvh|svh)\b/.test(src), "the deleted bar's first attempt");
  assert.ok(!/visualViewport(\?)?\.(height|offsetTop|pageTop)/.test(src), "the deleted bar's third attempt");
  assert.ok(!/style\.(bottom|transform)/.test(src), "placement is CSS only");
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const bn = css.slice(css.indexOf(".bn {"), css.indexOf(".bn-row"));
  assert.ok(/position: fixed; left: 0; right: 0; bottom: 0/.test(bn));
  assert.ok(!/backdrop|blur/.test(bn), "a blur on a fixed bar repaints every scroll frame on a phone");
  assert.ok(/transition: transform/.test(bn) && !/transition:[^;]*\bbottom\b/.test(bn), "moves on transform only");
});

test("the scroll path does no layout reads and no React state", () => {
  const src = readFileSync(new URL("../src/components/BottomNav.tsx", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  assert.ok(!/getBoundingClientRect|offsetHeight|offsetTop|getComputedStyle/.test(src), "layout reads force a reflow mid-scroll");
  assert.ok(!/setShown/.test(src), "show/hide is an attribute write, not a re-render");
  assert.ok(/addEventListener\("scroll", decide, \{ passive: true \}\)/.test(src));
});

test("the layout mounts it only through BOTTOM_NAV, the menu button carries the hook, and the server HTML never carries the bar", () => {
  const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  assert.ok(/BOTTOM_NAV !== "off"/.test(layout) && /<BottomNav mode=\{BOTTOM_NAV\}/.test(layout));
  const src = readFileSync(new URL("../src/components/BottomNav.tsx", import.meta.url), "utf8");
  assert.ok(/if \(!enabled\) return null;/.test(src), "renders nothing until the browser has read the opt-in");
});
