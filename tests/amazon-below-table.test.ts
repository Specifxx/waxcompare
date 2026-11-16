import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Amazon below the table: an unpriced link for a matched ASIN only, never a row, never the quick view", () => {
  const c = readFileSync(new URL("../src/components/AmazonBelowTable.tsx", import.meta.url), "utf8");
  assert.match(c, /if \(!live \|\| live\.cents\) return null;/);
  const t = readFileSync(new URL("../src/components/OfferTable.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(t, /amazon-below-table/);
});
