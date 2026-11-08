// The pre-order hub's links (components/PreorderBanner.tsx). SportsCardCompare has no /preorders hubs (a release's pre-orders are on
// its release page), so the banner and the landing links stay empty.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PreorderBanner, PreorderRegionLinks } from "../src/components/PreorderBanner";
import { openPreorderGuides } from "../src/lib/preorder-guides";
import { REGION_LIST } from "../src/lib/regions";

(globalThis as unknown as { React: typeof React }).React = React;

test("SportsCardCompare has no /preorders hubs: the banner and the landing links render nothing, in every region", () => {
  for (const r of REGION_LIST) {
    assert.equal(renderToStaticMarkup(React.createElement(PreorderBanner, { region: r.region, today: "2026-10-22" })), "", r.region);
  }
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(PreorderRegionLinks, { today: "2026-10-22" })), /preorders\//);
  assert.equal(openPreorderGuides("2026-10-22").length, 0);
});

test("on and after release day: no banner (the registry retires it)", () => {
  // The next sets (found by the import, lib/set-discovery.ts) may take its place; Star Trek's own banner is gone.
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(PreorderBanner, { region: "au", today: "2026-11-13" })), /star-trek/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(PreorderRegionLinks, { today: "2026-11-13" })), /star-trek/);
  assert.ok(!openPreorderGuides("2026-11-13").some((x) => x.set.code === "trk"));
});
