// Owner, 2026-11-12: only eBay and TCGplayer are paid rows at the top. Owner, 2026-11-17: with no Amazon price the row is an unpriced
// "Check on Amazon" ORDINARY LAST row (never pinned); a priced Amazon row stays pinned. Source guard.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Amazon (priced or the unpriced Check row) is an affiliated row at the top (owner, 2026-11-17)", () => {
  const t = readFileSync(new URL("../src/components/OfferTable.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(t, /if \(!live\?\.cents \|\| !live\.at \|\| !clock\) return null;/);
  assert.match(t, /Check on Amazon/);
  const e = readFileSync(new URL("../src/components/EbayStrip.tsx", import.meta.url), "utf8");
  assert.match(e, /\.\.\.\(amazon \? \[\{ key: amazon\.key/);
  assert.doesNotMatch(e, /amazon && !amazon\.live &&/);
  assert.match(e, /const pinSlots: Slot\[\] = \[\s+\{ key: EBAY_ROW_KEY/);
});
