// Owner, 2026-11-12: paid rows carry no coloured borders; the buttons carry the colour.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PIN_OUTLINE } from "../src/components/OfferRows";

test("eBay and Amazon rows draw no outline", () => {
  assert.equal(PIN_OUTLINE.ebay, "");
  assert.equal(PIN_OUTLINE.amazon, "");
});
