import { test } from "node:test";
import assert from "node:assert/strict";
import { offerLink, TOPPS_IMPACT_LINK, toppsAffiliateUrl } from "../src/lib/affiliate";

const LINK = "https://topps.sjv.io/c/8139279/111111/22222";
const BOX = "https://www.topps.com/products/2026-topps-chrome-baseball-hobby-box";

test("Topps rows go out plain until the programme approves us", () => {
  if (TOPPS_IMPACT_LINK) return; // set in this environment: covered below
  assert.equal(toppsAffiliateUrl(BOX, "us", "product-table"), BOX);
  assert.equal(offerLink("topps", BOX, "us", "product-table").sponsored, false);
});

test("one pasted deep link wraps every www.topps.com URL, tagged", () => {
  const href = toppsAffiliateUrl(BOX, "us", "product-table", LINK);
  assert.ok(href.startsWith(`${LINK}?u=${encodeURIComponent(BOX)}&sharedid=wax-us-product-table`), href);
  assert.equal(toppsAffiliateUrl(BOX, "us", "product-table", LINK + "/"), href);
});

test("regional Topps sites, look-alikes, http and bad links are never wrapped", () => {
  for (const u of ["https://uk.topps.com/products/x", "https://www.topps.com.evil.com/x", "http://www.topps.com/x", "not a url"]) {
    assert.equal(toppsAffiliateUrl(u, "us", "product-table", LINK), u);
  }
  for (const bad of ["", "https://topps.sjv.io/", "javascript:alert(1)", "https://topps.sjv.io/c/abc/1/2"]) {
    assert.equal(toppsAffiliateUrl(BOX, "us", "product-table", bad), BOX);
  }
});
