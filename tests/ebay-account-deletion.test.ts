// eBay's Marketplace Account Deletion endpoint (src/app/api/ebay/marketplace-deletion): the challenge hash eBay checks, and
// every notification acknowledged with 200 (SportsCardCompare keeps no eBay user data).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { GET, POST } from "../src/app/api/ebay/marketplace-deletion/route";

test("the challenge: sha256(code + token + endpoint), and 400 without a token", async () => {
  delete process.env.EBAY_VERIFICATION_TOKEN;
  assert.equal(GET(new Request("https://sportscardcompare.com/api/ebay/marketplace-deletion?challenge_code=abc")).status, 400);
  process.env.EBAY_VERIFICATION_TOKEN = "t".repeat(48);
  const res = GET(new Request("https://sportscardcompare.com/api/ebay/marketplace-deletion?challenge_code=abc"));
  const want = createHash("sha256").update("abc" + "t".repeat(48) + "https://sportscardcompare.com/api/ebay/marketplace-deletion").digest("hex");
  assert.deepEqual(await res.json(), { challengeResponse: want });
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal((await POST(new Request("https://sportscardcompare.com/api/ebay/marketplace-deletion", { method: "POST", body: "{}" }))).status, 200);
});
