import { test } from "node:test";
import assert from "node:assert/strict";
import { refusedForType, refusedListing } from "../src/lib/ebay-rules";
import type { TypeKey } from "../src/lib/sealed-title";

// The product's eBay listings sit at the TOP of its price list, lowest price first, so a part, a single card, a break spot or the
// wrong box would lead the page. The "kept" titles are store titles in the shape eBay sellers copy; the "refused" ones are those
// titles with the wording sellers add for a lot, a part, a single, a break or another edition. No live eBay read was made for these
// tests (eBay is called only from the import workflow, never from a test).
const refused = (t: string, type: TypeKey) => refusedListing(t) || refusedForType(t, type);

test("kept: ordinary sealed listings of each type", () => {
  for (const [t, type] of [
    ["2025 Topps Chrome Baseball Hobby Box", "hobby-box"],
    ["2025 Topps Chrome Baseball Hobby Box Factory Sealed - Never Opened", "hobby-box"],
    ["2025 Topps Chrome Baseball Jumbo Box", "jumbo-box"],
    ["2025 Topps Chrome Baseball HTA Jumbo Box", "jumbo-box"],
    ["2025 Panini Prizm Football FOTL Hobby Box", "fotl-box"],
    ["2025-26 Topps Chrome Basketball Breaker's Delight Box", "breakers-delight"],
    ["2025 Panini Prizm Football Choice Box", "choice-box"],
    ["2025 Topps Chrome Baseball Mega Box", "mega-box"],
    ["2025 Topps Chrome Baseball Blaster Box", "blaster-box"],
    ["2025 Topps Chrome Baseball Hanger Box", "hanger-box"],
    ["2025 Topps Chrome Baseball Hobby Case 12 Boxes", "hobby-case"],
    ["2025 Topps Chrome Baseball Hobby Pack", "hobby-pack"],
    ["2025 Topps Chrome Baseball Value Pack", "value-pack"],
    ["2025 Panini Prizm Football Cello Pack", "cello-pack"],
  ] as [string, TypeKey][])
    assert.ok(!refused(t, type), `${type}: ${t}`);
});

test("refused: lots, several units and another box on a single product's page", () => {
  for (const [t, type] of [
    ["Lot of 3 2025 Topps Chrome Baseball Hobby Packs", "hobby-pack"],
    ["2025 Topps Chrome Baseball Hobby Pack x10", "hobby-pack"],
    ["5 2025 Topps Chrome Baseball Hobby Packs Sealed", "hobby-pack"],
    ["2025 Topps Chrome Baseball Hobby Box", "hobby-pack"],
    ["2025 Topps Chrome Baseball Hobby Box 2x Sealed", "hobby-box"],
    ["20 2025 Topps Chrome Baseball Hobby Packs (loose, from a box)", "hobby-box"],
    ["2025 Topps Chrome Baseball Jumbo Box", "hobby-box"],
    ["2025 Topps Chrome Baseball Hobby Box", "jumbo-box"],
    ["2025 Panini Prizm Football FOTL Hobby Box", "hobby-box"],
    ["2025 Topps Chrome Baseball Blaster Box", "mega-box"],
    ["2025 Topps Chrome Baseball Mega Box", "blaster-box"],
    ["2025 Topps Chrome Baseball Hobby Box Case Fresh", "hobby-case"],
    ["2025 Topps Chrome Baseball Hobby Box with magnetic case", "hobby-case"],
    ["2025 Topps Chrome Baseball Box Factory Sealed", "hobby-box"],
    ["2025 Topps Chrome Baseball Hobby Box Set of 3", "hobby-box"],
  ] as [string, TypeKey][])
    assert.ok(refused(t, type), `${type}: ${t}`);
});

test("refused: breaks, repacks, parts, singles, opened, damaged, random and other languages", () => {
  for (const [t, type] of [
    ["2025 Topps Chrome Baseball Hobby Box Random Team Break", "hobby-box"],
    ["2025 Topps Chrome Baseball Hobby Box Break Spot - Yankees", "hobby-box"],
    ["2025 Topps Chrome Baseball Hobby Box PYT", "hobby-box"],
    ["2025 Topps Chrome Baseball Repack Box", "hobby-box"],
    ["2025 Topps Chrome Baseball Hobby Box Resealed", "hobby-box"],
    ["2025 Topps Chrome Baseball Hobby Box OPENED - empty", "hobby-box"],
    ["2025 Topps Chrome Baseball Hobby Box Damaged Corner", "hobby-box"],
    ["2025 Topps Chrome Baseball Mystery Hobby Box", "hobby-box"],
    ["Shohei Ohtani #1 pulled from 2025 Topps Chrome Baseball Hobby Box", "hobby-box"],
    ["2025 Topps Chrome Baseball Rookie Auto Card Hobby Box Hit", "hobby-box"],
    ["2025 Topps Chrome Baseball Hobby Box PSA 10", "hobby-box"],
    ["2025 Topps Chrome Baseball Hobby Box Japanese", "hobby-box"],
    ["2025 Topps Chrome Baseball Hobby Box Wrappers Only", "hobby-box"],
  ] as [string, TypeKey][])
    assert.ok(refused(t, type), `${type}: ${t}`);
});
