// The sealed classifier (lib/sealed-title.ts), with store titles in the shapes sports card shops write them. Every rule changed gets
// a title here. A wrong merge (a blaster's price on a hobby box's page) is worse than a missed listing, so most of these are refusals.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanName, floorCents, identify, readYear, type Rejection, type SealedIdentity } from "../src/lib/sealed-title";

function key(title: string): string {
  const r = identify(title);
  return typeof r === "object" ? r.groupKey : `REJECT:${r}`;
}
function same(titles: string[], expected: string) {
  for (const t of titles) assert.equal(key(t), expected, t);
}
function refused(title: string, why: Rejection) {
  assert.equal(identify(title), why, title);
}

test("one box, many store wordings: year, line, sport and type agree", () => {
  same(
    [
      "2025 Topps Chrome Baseball Hobby Box",
      "2025 TOPPS CHROME BASEBALL HOBBY BOX",
      "Topps 2025 Chrome Baseball - Hobby Box (Pre-Order, ships 10/15)",
      "2025 Topps Chrome Baseball Hobby Box Release Date: 10/15/2025",
    ],
    "2025|chrome|baseball|hobby-box",
  );
  same(["2024-25 Panini Prizm Basketball Hobby Box", "2024/25 Panini Prizm NBA Hobby Box"], "2024-25|prizm|basketball|hobby-box");
  same(["2024 Panini Prizm Football Mega Box", "2024 Panini Prizm NFL Mega Box"], "2024|prizm|football|mega-box");
});

test("the box types of one release never merge", () => {
  const types = {
    "2025 Topps Chrome Baseball Hobby Box": "hobby-box",
    "2025 Topps Chrome Baseball Jumbo Box": "jumbo-box",
    "2025 Topps Chrome Baseball HTA Jumbo Box": "jumbo-box",
    "2025 Topps Chrome Baseball Breaker's Delight Box": "breakers-delight",
    "2025 Topps Chrome Baseball Hobby Case (12 Boxes)": "hobby-case",
    "2025 Topps Chrome Baseball Hobby Pack": "hobby-pack",
    "2025 Topps Chrome Baseball Blaster Box": "blaster-box",
    "2025 Topps Chrome Baseball Mega Box": "mega-box",
    "2025 Topps Series 1 Baseball Value Box": "value-pack",
    "2024-25 Panini Prizm Basketball Choice Box": "choice-box",
  } as const;
  for (const [t, type] of Object.entries(types)) assert.equal((identify(t) as SealedIdentity).type, type, t);
  same(["2024-25 Panini Prizm Basketball Hobby Box - FOTL", "2024-25 Panini Prizm Basketball First Off The Line Hobby Box"], "2024-25|prizm|basketball|fotl-box");
});

test("lines that share a word stay apart: Chrome, Chrome Update, Sapphire; Bowman, Bowman Chrome, Bowman Draft", () => {
  assert.equal(key("2025 Topps Chrome Update Series Baseball Hobby Box"), "2025|chrome-update|baseball|hobby-box");
  assert.equal(key("2025 Topps Chrome Sapphire Edition Baseball Box"), "2025|chrome-sapphire|baseball|hobby-box");
  assert.equal(key("2025 Bowman Baseball Hobby Box"), "2025|bowman|baseball|hobby-box");
  assert.equal(key("2025 Bowman Chrome Baseball Hobby Box"), "2025|bowman-chrome|baseball|hobby-box");
  assert.equal(key("2025 Bowman Draft Baseball Jumbo Box"), "2025|bowman-draft|baseball|jumbo-box");
  assert.equal(key("2024-25 Panini Donruss Optic Basketball Hobby Box"), "2024-25|donruss-optic|basketball|hobby-box");
});

test("sports: WNBA is not NBA; soccer by competition; a season is not a calendar year", () => {
  assert.equal(key("2025 Panini Prizm WNBA Hobby Box"), "2025|prizm|wnba|hobby-box");
  assert.equal(key("2024-25 Topps Chrome UEFA Club Competitions Hobby Box"), "2024-25|chrome|soccer|uefa|hobby-box");
  assert.equal(key("Topps Chrome Football Euro 2024 Hobby Box"), "2024|chrome|soccer|euro|hobby-box");
  assert.equal(key("2025 Topps Chrome Formula 1 Hobby Box"), "2025|chrome|f1|hobby-box");
  assert.equal(key("2024-25 Upper Deck Series 1 Hockey Hobby Box"), "2024-25|ud-series-1|hockey|hobby-box");
  assert.equal(readYear("2024-25"), "2024-25");
  assert.equal(readYear("2024/2025"), "2024-25");
  assert.equal(readYear("2024 2026"), "two");
});

test("Topps 'Football': a single year is the NFL box, a season without a competition is refused (UK shops call soccer football)", () => {
  assert.equal(key("2024 Topps Chrome Football Hobby Box"), "2024|chrome|football|hobby-box");
  assert.equal(key("2024 Topps Chrome NFL Hobby Box"), "2024|chrome|football|hobby-box");
  assert.equal(key("2024-25 Topps Chrome Football Hobby Box"), "REJECT:no-set");
});

test("market editions are their own product: an Asia box is not the hobby box", () => {
  assert.equal(key("2024-25 Topps Chrome UEFA Club Competitions Hobby Box Asia"), "2024-25|chrome|soccer|uefa|hobby-box|asia");
});

test("breaks, repacks, singles, slabs, lots and store editions are refused", () => {
  refused("2025 Topps Chrome Baseball Hobby Box - Random Team Break", "not-sealed");
  refused("2025 Topps Chrome Baseball Hobby Box Break Spot", "not-sealed");
  refused("2023 Topps Chrome Elly De La Cruz RC #1 PSA 10", "not-sealed");
  refused("2024-25 Panini Prizm Basketball Hobby Box Resealed", "not-sealed");
  refused("2024-25 Panini Prizm Basketball Mystery Box", "not-sealed");
  refused("2025 Topps Chrome Baseball Hobby Box x2", "multiple");
  refused("2025 Topps Chrome Baseball Hobby Box Lot of 3", "multiple");
  refused("2025 Topps Chrome Baseball Hobby Box 12 Boxes", "multiple");
  // a case's own contents are not a lot (eBay's usual title)
  assert.equal((identify("2025 Topps Chrome Baseball Hobby Case 12 Boxes") as SealedIdentity).groupKey, "2025|chrome|baseball|hobby-case");
  assert.equal((identify("2025 Topps Chrome Baseball Hobby Case - 12 Hobby Boxes") as SealedIdentity).groupKey, "2025|chrome|baseball|hobby-case");
  refused("2025 Topps Chrome Baseball Blaster Box Walmart Exclusive", "retail-edition");
  refused("2025 Topps Chrome Baseball Ultra Pro Toploaders", "accessory");
});

test("other games, other languages and titles without a year are refused", () => {
  refused("Pokemon Scarlet & Violet Prismatic Evolutions Booster Box", "not-sports");
  refused("2024-25 Topps Chrome Basketball Japan Edition Hobby Box", "foreign");
  refused("Topps Chrome Hobby Box", "no-set");
});

test("product names come from the release, not the store's wording; cleanName drops store notes", () => {
  const a = identify("TOPPS 2025 CHROME BASEBALL HOBBY BOX (PRE-ORDER)") as SealedIdentity;
  assert.equal(a.name, "2025 Topps Chrome Baseball Hobby Box");
  assert.equal(a.slugBase, "2025-topps-chrome-baseball-hobby-box");
  assert.equal(cleanName("2025 TOPPS CHROME BASEBALL HOBBY BOX - PRE-ORDER"), "2025 Topps Chrome Baseball Hobby Box");
});

test("price floors scale per market and rank hobby above retail", () => {
  assert.ok(floorCents("hobby-box", "US") > floorCents("blaster-box", "US"));
  assert.ok(floorCents("hobby-box", "AU") > floorCents("hobby-box", "US"));
});

test("lines the 2026-11-07 store probe found, in the shops' own wordings", () => {
  // Upper Deck shops put the sport, a dash or a colon between the maker and the line
  same(["2021-22 Upper Deck Hockey Series 1 Mega Box", "Upper Deck - 2021-22 - Hockey - Series 1 - Mega Box"], "2021-22|ud-series-1|hockey|mega-box");
  assert.equal(key("Upper Deck - 2025-26 - Hockey - MVP - Trading Card Hobby Box"), "2025-26|ud-mvp|hockey|hobby-box");
  assert.equal(key("2024-25 Upper Deck MVP Ice Hockey Blaster Box"), "2024-25|ud-mvp|hockey|blaster-box", "'Ice Hockey' is the sport, not Upper Deck Ice");
  assert.equal(key("2024-25 Upper Deck SP Hockey Blaster Box"), "2024-25|ud-sp|hockey|blaster-box");
  assert.equal(key("2023-24 Upper Deck SP Authentic Hockey Hobby Box"), "2023-24|sp-authentic|hockey|hobby-box", "SP Authentic is not SP");
  assert.equal(key("2023-24 Upper Deck Skybox Metal Universe Hockey Hobby Box"), "2023-24|ud-metal-universe|hockey|hobby-box");
  assert.equal(key("2024-25 Upper Deck Extended Hockey Blaster Box"), "2024-25|ud-extended|hockey|blaster-box");
  assert.equal(key("2024-25 Upper Deck PWHL Hockey Blaster Box"), "2024-25|ud-pwhl|hockey|blaster-box");
  // Topps lines, and sports a line has added
  assert.equal(key("2025-26 Topps NBA Hoops Basketball Hanger Box"), "2025-26|topps-hoops|basketball|hanger-box", "Topps' Hoops is not Panini's");
  assert.equal(key("2025-26 Topps Signature Class Basketball Blaster Box"), "2025-26|signature-class|basketball|blaster-box");
  assert.equal(key("2025-26 Topps Holiday Basketball Mega Box"), "2025-26|topps-holiday|basketball|mega-box");
  assert.equal(key("2024 Topps Resurgence Football Value Box"), "2024|resurgence|football|value-pack");
  assert.equal(key("2026 Topps Heritage Football Hobby Box"), "2026|heritage|football|hobby-box");
  assert.equal(key("2025 Topps Stadium Club UFC Mega Box"), "2025|stadium-club|ufc|mega-box");
  assert.equal(key("Topps Chrome Update 2025-26 Series Basketball Hobby Box"), "2025-26|chrome-update|basketball|hobby-box");
  // Panini and Leaf
  assert.equal(key("2025 Panini Rookies and Football Stars Blaster Box"), "2025|rookies-stars|football|blaster-box");
  assert.equal(key("2025 Panini Select WNBA Basketball Blaster Box"), "2025|select|wnba|blaster-box");
  assert.equal(key("2026 Leaf Metal Football Hobby Box"), "2026|leaf-metal|football|hobby-box");
  assert.equal(key("2026 Leaf Metal Draft Edition Baseball Hobby Box"), "2026|leaf-metal-draft|baseball|hobby-box", "Metal Draft is not Metal");
});
