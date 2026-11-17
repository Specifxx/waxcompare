// Owner, 2026-11-12: only eBay and TCGplayer are paid rows at the top. Owner, 2026-11-17: with no Amazon price the row is an unpriced
// "Check on Amazon" ORDINARY LAST row (never pinned); a priced Amazon row stays pinned. Source guard.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the unpriced Amazon row is an ordinary last row; a priced one stays pinned", () => {
  const t = readFileSync(new URL("../src/components/OfferTable.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(t, /if \(!live\?\.cents \|\| !live\.at \|\| !clock\) return null;/);
  assert.match(t, /Check on Amazon/);
  const e = readFileSync(new URL("../src/components/EbayStrip.tsx", import.meta.url), "utf8");
  assert.match(e, /amazon\?\.live \? \[\{ key: amazon\.key/);
  assert.match(e, /amazon && !amazon\.live &&/);
});
