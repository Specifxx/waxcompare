// The desktop "All sealed" dropdown (components/ShopMenu.tsx): category-first links, all to pages that exist, in the header's HTML.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Header } from "../src/components/Header";
import { shopMenuColumns } from "../src/components/ShopMenu";
import { TYPE_BY_SLUG } from "../src/lib/sealed-title";
import { SET_BY_SLUG, SETS } from "../src/lib/sets";
import { menuSets } from "../src/lib/release";

(globalThis as unknown as { React: typeof React }).React = React;
const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
const render = (el: React.ReactElement) => renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: router as never }, el));

test("shop menu: by product, by set, by value; every link is a real region path", () => {
  const cols = shopMenuColumns("au", "2026-10-28");
  assert.deepEqual(cols.map((c) => c.title), ["By product", "By release", "By value"]);
  assert.deepEqual(cols[0].links.slice(0, 4).map((l) => l.label), ["Hobby boxes", "Jumbo boxes", "Mega boxes", "Blaster boxes"]);
  for (const l of cols.flatMap((c) => c.links)) {
    assert.match(l.href, /^\/au\//, l.href);
    const type = /^\/au\/type\/([^/]+)$/.exec(l.href)?.[1];
    if (type) assert.ok(TYPE_BY_SLUG.has(type), `type page ${type}`);
    const set = /^\/au\/sets\/([^/]+)$/.exec(l.href)?.[1];
    if (set) assert.ok(SET_BY_SLUG.has(set), `set page ${set}`);
  }
});

test("shop menu: releases in featuring order, every one a real release page, and the index last", () => {
  const sets = shopMenuColumns("us", "2026-11-07")[1].links;
  assert.equal(sets.at(-1)!.href, "/us/sets");
  const codes = menuSets(sets.length - 1, "2026-11-07");
  assert.deepEqual(sets.slice(0, -1).map((l) => l.href), codes.map((c) => `/us/sets/${SETS.find((s) => s.code === c)!.slug}`));
  for (const l of sets) assert.doesNotMatch(l.label, /pre-order/, "nothing is a pre-order without an announced date");
});

test("header: the dropdown sits with All sealed inside the desktop nav, as plain links", () => {
  const html = render(React.createElement(Header, { region: "uk" }));
  const nav = /<nav class="hidden items-center gap-0\.5 lg:flex" aria-label="Main">([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? "";
  assert.match(nav, /<div class="group relative"><a [^>]*href="\/uk\/sealed"[^>]*>All sealed<\/a>/);
  assert.match(nav, /data-menu="shop"/);
  assert.match(nav, /href="\/uk\/type\/hobby-boxes"[^>]*>Hobby boxes<\/a>/);
  assert.match(nav, /group-focus-within:visible/, "opens for keyboard focus too");
});

test("menus skip a set no store lists yet: its set page is a 404, so the link was dead site-wide (2026-11-03)", () => {
  assert.deepEqual(menuSets(3, "2026-11-03", new Set()), [], "nothing listed, nothing linked");
  const listed = new Set(SETS.slice(1, 12).map((s) => s.code));
  for (const c of menuSets(12, "2026-11-03", listed)) assert.ok(listed.has(c), c);
});
