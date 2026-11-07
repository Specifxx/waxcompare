// The pure modules the growth release moved out of pages so every workstream can share them: price per pack by type
// (src/lib/per-pack.ts, from the set page) and the type descriptions (src/lib/type-about.ts, from the type page).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ProductCardData } from "../src/lib/data";
import { packsForLabel } from "../src/lib/packs";
import { cheapestPerPackByType, PACK_TYPES } from "../src/lib/per-pack";
import { PRODUCT_TYPES } from "../src/lib/sealed-title";
import { TYPE_ABOUT } from "../src/lib/type-about";

const card = (slug: string, productType: string, lowestPriceCents: number | null): ProductCardData =>
  ({ slug, name: `2025 Topps Chrome Baseball ${productType}`, productType, setCode: "2025|chrome|baseball", imageUrl: null, lowestPriceCents, inStockStores: 2, listedStores: 2, marketplaceOpen: false }) as unknown as ProductCardData;

test("no per-pack prices (2026-11-07): a sports box's pack count is never certain, so no type has one and the ranking is empty", () => {
  for (const t of PRODUCT_TYPES) assert.equal(packsForLabel(t.label, "2025|chrome|baseball"), null, t.label);
  assert.deepEqual(cheapestPerPackByType([card("a", "Hobby Box", 25000), card("b", "Blaster Box", 3000)]), []);
  void PACK_TYPES;
});

test("the moves are moves: the set page imports per-pack.ts and the type page type-about.ts, and neither keeps its own copy", () => {
  const set = readFileSync(new URL("../src/app/[region]/sets/[set]/page.tsx", import.meta.url), "utf8");
  assert.match(set, /from "@\/lib\/per-pack"/);
  assert.match(set, /cheapestPerPackByType\(products\)/);
  assert.doesNotMatch(set, /const PACK_TYPES|function cheapestPerPack\b/);
  const type = readFileSync(new URL("../src/app/[region]/type/[type]/page.tsx", import.meta.url), "utf8");
  assert.match(type, /from "@\/lib\/type-about"/);
  assert.match(type, /TYPE_ABOUT\[t\.slug\]/);
  assert.doesNotMatch(type, /const ABOUT\b/);
});

test("TYPE_ABOUT: a sentence for every product type, keyed by slug, and nothing for a type that does not exist", () => {
  for (const t of PRODUCT_TYPES) assert.ok(TYPE_ABOUT[t.slug]?.length > 20, t.slug);
  const slugs = new Set(PRODUCT_TYPES.map((t) => t.slug));
  for (const k of Object.keys(TYPE_ABOUT)) assert.ok(slugs.has(k), `${k} is a type slug`);
  assert.match(TYPE_ABOUT["hobby-boxes"], /hobby/i);
  assert.match(TYPE_ABOUT["blaster-boxes"], /blaster/i);
});
