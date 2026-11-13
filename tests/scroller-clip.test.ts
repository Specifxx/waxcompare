import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A visually hidden label (sr-only, position absolute) inside an unpositioned sideways scroller escapes the scroller's
// clip and widens the whole page on a phone (2026-11-13: 390px pages measured 650-960px wide). Every horizontal
// scroller must be a containing block, so its own overflow clips what it holds.
test("horizontal scrollers are positioned, so hidden labels inside them cannot widen the page", () => {
  const css = readFileSync("src/app/globals.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = css.match(/:where\(([^)]*)\)\s*\{\s*position:\s*relative;?\s*\}/);
  assert.ok(rule, "globals.css needs `:where(.scroller, .overflow-x-auto, …) { position: relative; }`");
  const selectors = rule[1].split(",").map((s) => s.trim());
  for (const cls of [".overflow-x-auto", ".overflow-x-scroll", ".scroller"]) {
    assert.ok(selectors.includes(cls), `${cls} must be in the positioned-scroller rule`);
  }
});
