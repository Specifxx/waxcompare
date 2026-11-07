import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeReleases, MIN_STORES } from "../src/lib/set-discovery";
import { partsOf, releaseName } from "../src/lib/sets";
import { LINES } from "../src/lib/lines";

const line = LINES[0];
const code = `2025|${line.key}|baseball`;

test("a release sold by two stores is added once, with its name, slug and today's date; one store waits", () => {
  assert.equal(MIN_STORES, 2);
  const one = mergeReleases([], new Map([[code, new Set(["a"])]]), "2026-11-07");
  assert.equal(one.added.length, 0);
  assert.deepEqual(one.waiting, [code]);
  const two = mergeReleases([], new Map([[code, new Set(["a", "b"])]]), "2026-11-07");
  assert.equal(two.added.length, 1);
  const name = releaseName(partsOf(code)!);
  assert.deepEqual(two.added[0], { code, name, slug: two.added[0].slug, firstSeen: "2026-11-07" });
  assert.match(two.added[0].slug, /^2025-[a-z0-9-]+$/);
});

test("a stored release is never rewritten: its slug and first-seen day stay", () => {
  const stored = [{ code, name: "Old name", slug: "kept-slug", firstSeen: "2026-01-01" }];
  const res = mergeReleases(stored, new Map([[code, new Set(["a", "b", "c"])]]), "2026-11-07");
  assert.deepEqual(res.releases, stored);
  assert.equal(res.added.length, 0);
});

test("an unreadable code is never added", () => {
  const res = mergeReleases([], new Map([["2025|no-such-line|baseball", new Set(["a", "b"])]]), "2026-11-07");
  assert.deepEqual(res.unknown, ["2025|no-such-line|baseball"]);
  assert.equal(res.added.length, 0);
});
