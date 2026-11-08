// SportsCardCompare shares Compare Empire's eBay keyset since 2026-11-08 (owner): 1,400 Browse calls a day of its 5,000 (raise
// nothing without the owner). The importer's defaults, the clamp and the workflow's fallbacks all say 1,400, and the day's spend
// survives the job's throwaway database through data/state/ebay-calls.json.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { capsFromEnv, DEFAULT_DAILY_CAP, MAX_DAILY_CAP } from "../src/lib/ebay-import";

test("1,400 a day by default, and never more whatever the variable says", () => {
  assert.equal(DEFAULT_DAILY_CAP, 1400);
  assert.equal(MAX_DAILY_CAP, 1400);
  assert.equal(capsFromEnv({}).daily, 1400);
  assert.equal(capsFromEnv({ EBAY_DAILY_CAP: "9000" }).daily, 1400);
  assert.equal(capsFromEnv({ EBAY_RUN_CAP: "9000" }).run, 1400);
});

test("the workflow falls back to 1,400 and carries the call counter between runs", () => {
  const wf = fs.readFileSync(".github/workflows/ebay-import.yml", "utf8");
  assert.match(wf, /EBAY_DAILY_CAP: \$\{\{ vars\.EBAY_DAILY_CAP \|\| '1400' \}\}/);
  assert.match(wf, /scripts\/seed-from-public\.ts/);
  assert.match(wf, /scripts\/export-public-data\.ts/);
  assert.match(fs.readFileSync("scripts/export-public-data.ts", "utf8"), /data", "state", "ebay-calls\.json"/);
  assert.match(fs.readFileSync("scripts/seed-from-public.ts", "utf8"), /ebay-calls\.json/);
  assert.match(fs.readFileSync("scripts/publish-public-data.sh", "utf8"), /"data\/state"/);
});

test("both data jobs share one queue, so neither overwrites the other's export", () => {
  for (const f of ["ebay-import.yml", "sealed-import.yml"]) assert.match(fs.readFileSync(`.github/workflows/${f}`, "utf8"), /group: waxcompare-data\n/);
});
