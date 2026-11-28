import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { livePicks } from "../src/lib/deal-picks-live";
import type { DealPick } from "../src/lib/deal-picks";

const at = "2026-11-28T10:00:00Z";
const amazon: DealPick = { id: "1", brand: "amazon", name: "A", img: "x", price: "$1", href: "h", at, deal: "Black Friday Deal", until: "2026-11-29T00:00:00Z" };
const ebay: DealPick = { id: "2", brand: "ebay", name: "B", img: "x", price: "$2", href: "h" };

test("an Amazon price is shown only under 24 hours old, and its deal badge only before Amazon's own end", () => {
  const t = Date.parse(at);
  assert.equal(livePicks([amazon, ebay], t + 3600_000).length, 2);
  assert.equal(livePicks([amazon, ebay], t + 3600_000)[0].deal, "Black Friday Deal");
  assert.equal(livePicks([amazon, ebay], Date.parse("2026-11-29T01:00:00Z"))[0].deal, undefined);
  assert.deepEqual(livePicks([amazon, ebay], t + 25 * 3600_000).map((p) => p.brand), ["ebay"]);
  assert.deepEqual(livePicks([{ ...amazon, at: undefined }], t).length, 0);
});

test("the deals card keeps the prompt rules: once a visit, one slot with the rate card, never while typing, never opens a window", () => {
  const src = readFileSync(new URL("../src/components/DealsPopup.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /window\.open\(/);
  assert.match(src, /srv_rate_seen/);
  assert.match(src, /typingTarget\(document\.activeElement\)/);
  assert.match(src, /aria-modal="false"/);
  assert.match(src, /rel="sponsored nofollow noopener"/);
  assert.match(src, /Ad · /);
  const lib = readFileSync(new URL("../src/lib/deal-picks.ts", import.meta.url), "utf8");
  assert.match(lib, /asin: a.asin/);
  assert.doesNotMatch(lib, /amazonSearchUrl|\/deals|\/gp\/goldbox/);
});
