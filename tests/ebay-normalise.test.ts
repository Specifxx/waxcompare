import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EBAY_CAMPAIGN_ID } from "../src/lib/affiliate";
import {
  baseItem,
  CHASE_FLOOR,
  HIGH_END_FLOOR_USD,
  imageKey,
  lowestPriceFirst,
  multiUnit,
  normaliseChase,
  normaliseItemFeed,
  normaliseSealed,
  normaliseSetChase,
  normaliseType,
  relevantToProduct,
  roundRobin,
  shippingFrom,
  typeFloor,
  upgradeImage,
  usdToMarketplace,
  refusedForType,
  refusedListing,
  type ItemTarget,
} from "../src/lib/ebay-normalise";
import { cleanTitle, MARKETPLACE_IDS, MARKETPLACES, type MarketplaceId } from "../src/lib/ebay-context";
import { identify, isIdentity } from "../src/lib/sealed-title";
import { NOW, summary } from "./helpers/ebay-fakes";

const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/ebay-search-us.json", import.meta.url), "utf8"));
const RAW: unknown[] = FIXTURE.itemSummaries;
const by = (needle: string) => RAW.find((r) => (r as { title: string }).title.includes(needle));

// ─── the high-end sealed ("chase") feed ─────────────────────────────────────────
// WaxCompare lists no single cards: the "chase" feed key holds hobby, jumbo, FOTL and Breaker's Delight boxes and hobby cases, through
// the same classifier as every other feed.

test("normaliseChase: accepts the good fixtures and keeps only whitelisted fields, with shipping", () => {
  const good = RAW.map((r) => normaliseChase(r, "EBAY_US", NOW)).filter(Boolean);
  assert.equal(good.length, 7, good.map((g) => g!.title).join("\n"));
  for (const g of good) {
    assert.deepEqual(Object.keys(g!).filter((k) => !["condition", "ship"].includes(k)).sort(), ["id", "imageUrl", "price", "title", "url"]);
    assert.equal(g!.price.currency, "USD");
    assert.ok(Number(g!.price.value) >= HIGH_END_FLOOR_USD);
    assert.match(g!.imageUrl, /^https:\/\/i\.ebayimg\.com\//);
    const u = new URL(g!.url);
    assert.equal(u.protocol, "https:");
    assert.equal(u.searchParams.get("campid"), EBAY_CAMPAIGN_ID);
    assert.ok(!JSON.stringify(g).includes("card_vault_99"), "no seller data");
  }
  assert.equal(good[0]!.price.value, "189.99"); // exactly as eBay returned it
  // ...and so is the link: eBay's itemAffiliateWebUrl, byte for byte (its spec says to use it as is), never rebuilt or edited
  for (const g of good) {
    const raw = RAW.find((r) => (r as { itemId: string }).itemId === g!.id) as { itemAffiliateWebUrl?: string; itemWebUrl: string };
    if (raw.itemAffiliateWebUrl?.startsWith("https://") && raw.itemAffiliateWebUrl.includes(`campid=${EBAY_CAMPAIGN_ID}&`)) assert.equal(g!.url, raw.itemAffiliateWebUrl, g!.title);
  }
  assert.deepEqual(good[0]!.ship, { value: "4.5", currency: "USD" });
  assert.equal(good[1]!.condition, "Brand New");
});

test("normaliseChase: every reject case is rejected, garbage never throws", () => {
  assert.equal(normaliseChase(by("Custom Proxy"), "EBAY_US", NOW), null);
  assert.equal(normaliseChase(by("Japanese"), "EBAY_US", NOW), null);
  assert.equal(normaliseChase(by("Sealed EUR"), "EBAY_US", NOW), null, "EUR price on EBAY_US");
  assert.equal(normaliseChase(by("converted"), "EBAY_US", NOW), null, "converted price");
  assert.equal(normaliseChase(by("below the floor"), "EBAY_US", NOW), null, "below the hobby box floor");
  assert.equal(normaliseChase(by("auction"), "EBAY_US", NOW), null, "AUCTION only");
  assert.equal(normaliseChase(by("lot of 2"), "EBAY_US", NOW), null, "a lot");
  assert.equal(normaliseChase(by("Blaster Box Sealed"), "EBAY_US", NOW), null, "sealed, but not high-end");
  assert.equal(normaliseChase(by("ENDED"), "EBAY_US", NOW), null, "ended");
  assert.equal(normaliseChase(by("Heritage"), "EBAY_US", NOW), null, "image off eBay hosts");
  assert.equal(normaliseChase(by("no photo"), "EBAY_US", NOW), null, "no image");
  assert.equal(normaliseChase(by("no price"), "EBAY_US", NOW), null, "no price");
  assert.equal(normaliseChase(by("lovely thing"), "EBAY_US", NOW), null, "not recognisably a product");
  for (const g of [null, undefined, 5, "x", [], {}, { itemId: 1 }, { itemId: "a", title: "x" }, { itemId: "a", title: "2025 Topps Chrome Baseball Hobby Box", price: "5" }]) assert.equal(normaliseChase(g, "EBAY_US", NOW), null);
  const ok = by("Prizm Football Hobby Case");
  assert.ok(normaliseChase(ok, "EBAY_US", NOW));
  assert.equal(normaliseChase({ ...(ok as object), adultOnly: true }, "EBAY_US", NOW), null, "adult-only");
});

test("normaliseChase: high-end sealed only (no single card, no pack, no retail box), and never a card pulled from a box", () => {
  const ok = (t: string, p = 700) => normaliseChase(summary("1", t, p), "EBAY_US", NOW);
  for (const t of [
    "2025 Topps Chrome Baseball Hobby Box Sealed",
    "2025 Topps Chrome Baseball Jumbo Box Sealed",
    "2025 Topps Chrome Baseball Hobby Case 12 Boxes Sealed",
    "2025 Panini Prizm Football FOTL Hobby Box",
    "2025-26 Topps Chrome Basketball Breaker's Delight Box",
  ])
    assert.ok(ok(t), t);
  for (const t of [
    "2025 Topps Chrome Baseball Blaster Box Sealed",
    "2025 Topps Chrome Baseball Mega Box Sealed",
    "2025 Topps Chrome Baseball Hobby Pack",
    "2025 Topps Chrome Baseball Rookie Auto Card #RA-1 Pulled From Hobby Box",
    "Shohei Ohtani 1/1 Superfractor 2025 Topps Chrome From Hobby Box",
    "Pokemon Surging Sparks Booster Box Sealed",
  ])
    assert.equal(ok(t), null, t);
  assert.equal(ok("2025 Topps Chrome Baseball Hobby Box Sealed", 99), null, "under the US$100 high-end floor");
});

test("baseItem: eBay's affiliate URL is kept EXACTLY; a missing one is rebuilt from itemWebUrl with the EPN tags and the feed's sub-id; a foreign or http one is not trusted", () => {
  const CASE_RAW = by("Prizm Football Hobby Case");
  const tdm = baseItem(CASE_RAW, "EBAY_US", NOW, "chase")!;
  const u = new URL(tdm.url);
  assert.equal(u.searchParams.get("mkevt"), "1");
  assert.equal(u.searchParams.get("mkrid"), "711-53200-19255-0");
  assert.equal(u.searchParams.get("campid"), EBAY_CAMPAIGN_ID);
  assert.equal(u.searchParams.get("customid"), "wax-us-chase", "the fallback names its own feed");
  assert.equal(baseItem(CASE_RAW, "EBAY_AU", NOW, "item"), null, "a USD price is not valid on EBAY_AU");
  const audShip = { itemLocation: { country: "AU" }, shippingOptions: [{ shippingCostType: "FIXED", shippingCost: { value: "9.00", currency: "AUD" } }] };
  assert.equal(new URL(baseItem({ ...(CASE_RAW as object), price: { value: "70.00", currency: "AUD" }, ...audShip }, "EBAY_AU", NOW, "item")!.url).searchParams.get("customid"), "wax-au-item");
  // an eBay-issued URL passes through untouched, whatever it holds (query order, encodings, a customid of eBay's own)
  const issued = "https://www.ebay.com.au/itm/123456789012?_skw=a+b&hash=item1%3Ag%3AX%2By&amdata=enc%3AAQAKAAAA%2B%2Fx%3D&mkevt=1&mkcid=1&mkrid=705-53470-19255-0&campid=5339155912&customid=wax-au-sealed&toolid=10001";
  const raw = { ...(CASE_RAW as object), itemAffiliateWebUrl: issued, price: { value: "70.00", currency: "AUD" }, ...audShip };
  assert.equal(baseItem(raw, "EBAY_AU", NOW, "sealed")!.url, issued);
  // not ours (another campaign) or not an item page: rebuilt from itemWebUrl instead, never edited
  const other = baseItem({ ...raw, itemAffiliateWebUrl: issued.replace("5339155912", "1111111111") }, "EBAY_AU", NOW, "sealed")!;
  assert.notEqual(other.url, issued);
  assert.equal(new URL(other.url).searchParams.get("campid"), EBAY_CAMPAIGN_ID);
  assert.equal(new URL(other.url).searchParams.get("customid"), "wax-au-sealed");
  for (const n of ["2023 Topps Chrome", "2024 Panini Prizm"]) {
    const it = baseItem(by(n), "EBAY_US", NOW, "chase")!;
    assert.equal(new URL(it.url).protocol, "https:", n);
    assert.equal(new URL(it.url).searchParams.get("campid"), EBAY_CAMPAIGN_ID, n);
    assert.ok(!it.url.includes("1111111111"), n);
  }
  assert.equal(baseItem({ ...(CASE_RAW as object), itemWebUrl: "https://evil.com/itm/1" }, "EBAY_US", NOW, "chase"), null);
});

test("baseItem: the thumbnail stands in for a missing primary image", () => {
  const jumbo = baseItem(RAW.find((r) => (r as { title: string }).title.startsWith("2025 Bowman Baseball Jumbo Box")), "EBAY_US", NOW, "chase")!;
  assert.match(jumbo.imageUrl, /ccc333/);
});

test("search price floors and currencies per marketplace (AUD, GBP, CAD, EUR, USD); the high-end floor on top", () => {
  assert.deepEqual(CHASE_FLOOR, { USD: 15, AUD: 20, GBP: 12, CAD: 20, EUR: 15 });
  const mk = (value: string, currency: string, mp: MarketplaceId = "EBAY_US") => ({ ...(RAW[0] as object), price: { value, currency }, itemLocation: { country: MARKETPLACES[mp].country }, shippingOptions: [{ shippingCost: { value: "0.00", currency } }] });
  for (const mp of MARKETPLACE_IDS) {
    const cur = MARKETPLACES[mp].currency;
    const floor = Math.max(typeFloor("hobby-box", mp), usdToMarketplace(HIGH_END_FLOOR_USD, mp));
    assert.equal(normaliseChase(mk((floor - 0.01).toFixed(2), cur, mp), mp, NOW), null, `${mp} under ${floor}`);
    assert.ok(normaliseChase(mk(floor.toFixed(2), cur, mp), mp, NOW), `${mp} ${floor}`);
  }
  assert.equal(normaliseChase(mk("300.00", "USD"), "EBAY_AU", NOW), null, "USD on the AU marketplace is the wrong currency");
});

test("normaliseSetChase: sealed product of THIS release only; another release's, a single and a lot are refused", () => {
  const mk = (t: string, p = 150) => summary("1", t, p);
  const CH = "2025|chrome|baseball";
  assert.ok(normaliseSetChase(mk("2025 Topps Chrome Baseball Hobby Box Sealed", 300), "EBAY_US", NOW, CH));
  assert.ok(normaliseSetChase(mk("2025 Topps Chrome Baseball Blaster Box Sealed", 45), "EBAY_US", NOW, CH));
  assert.ok(normaliseSetChase(mk("2025 Topps Chrome Baseball Jumbo Box Sealed", 600), "EBAY_US", NOW, CH));
  assert.equal(normaliseSetChase(mk("2024 Topps Chrome Baseball Hobby Box Sealed", 300), "EBAY_US", NOW, CH), null, "another year");
  assert.equal(normaliseSetChase(mk("2025 Topps Chrome Football Hobby Box Sealed", 300), "EBAY_US", NOW, CH), null, "another sport");
  assert.equal(normaliseSetChase(mk("2025 Topps Chrome Baseball Ohtani #1 Pulled From Hobby Box"), "EBAY_US", NOW, CH), null, "a card");
  assert.equal(normaliseSetChase(mk("2025 Topps Chrome Baseball Hobby Box x2 Sealed", 600), "EBAY_US", NOW, CH), null, "two boxes");
  assert.equal(normaliseSetChase(mk("2025 Topps Chrome Baseball Hobby Box Sealed", 30), "EBAY_US", NOW, CH), null, "under the box floor");
});

test("baseItem: local sellers only (the EU for eBay Germany), and only with postage eBay states (visitor feedback 2026-10-31)", () => {
  const raw = (country: string | null, ship: unknown = { shippingCost: { value: "5.00", currency: "USD" } }) => ({
    ...(by("Prizm Football Hobby Case") as object),
    ...(country ? { itemLocation: { country } } : {}),
    shippingOptions: ship ? [ship] : [],
  });
  assert.ok(baseItem(raw("US"), "EBAY_US", NOW, "chase"), "a US seller on eBay US");
  assert.equal(baseItem(raw("CN"), "EBAY_US", NOW, "chase"), null, "an overseas seller");
  assert.equal(baseItem(raw("GB"), "EBAY_US", NOW, "chase"), null, "a UK seller on eBay US");
  assert.equal(baseItem(raw("US", { shippingCostType: "CALCULATED" }), "EBAY_US", NOW, "chase"), null, "postage not stated");
  assert.equal(baseItem(raw("US", null), "EBAY_US", NOW, "chase"), null, "no shipping option");
  assert.ok(baseItem(raw(null), "EBAY_US", NOW, "chase"), "no location given: the search's own filter already asked for local sellers");
  const eu = (country: string) => ({ ...raw(country, { shippingCost: { value: "4.90", currency: "EUR" } }), price: { value: "300.00", currency: "EUR" } });
  assert.ok(baseItem(eu("FR"), "EBAY_DE", NOW, "chase"), "a French seller for the EU");
  assert.equal(baseItem(eu("GB"), "EBAY_DE", NOW, "chase"), null, "a UK seller is outside the EU");
});

// ─── images, shipping, money ────────────────────────────────────────────────────

test("upgradeImage: s-l225 → s-l500 on the same path; never a downgrade, never another shape; still https on *.ebayimg.com", () => {
  assert.equal(upgradeImage("https://i.ebayimg.com/images/g/AbC~dEfAAOSw/s-l225.jpg"), "https://i.ebayimg.com/images/g/AbC~dEfAAOSw/s-l500.jpg");
  assert.equal(upgradeImage("https://i.ebayimg.com/images/g/AbC/s-l64.webp"), "https://i.ebayimg.com/images/g/AbC/s-l500.webp");
  assert.equal(upgradeImage("https://i.ebayimg.com/images/g/AbC/s-l1600.jpg"), "https://i.ebayimg.com/images/g/AbC/s-l1600.jpg");
  assert.equal(upgradeImage("https://i.ebayimg.com/images/g/AbC/s-l500.jpg"), "https://i.ebayimg.com/images/g/AbC/s-l500.jpg");
  assert.equal(upgradeImage("https://i.ebayimg.com/thumbs/images/g/AbC/s-l225.jpg"), "https://i.ebayimg.com/thumbs/images/g/AbC/s-l225.jpg");
  assert.equal(upgradeImage("not a url"), "not a url");
  const it = baseItem(summary("9", "2025 Topps Chrome Baseball Hobby Box Sealed", 180), "EBAY_US", NOW, "chase")!;
  assert.match(it.imageUrl, /^https:\/\/i\.ebayimg\.com\/images\/g\/img9\/s-l500\.jpg$/);
  assert.equal(imageKey("https://i.ebayimg.com/images/g/AbC/s-l225.jpg"), imageKey("https://i.ebayimg.com/images/g/AbC/s-l1600.webp?x=1"));
  assert.notEqual(imageKey("https://i.ebayimg.com/images/g/AbC/s-l225.jpg"), imageKey("https://i.ebayimg.com/images/g/XyZ/s-l225.jpg"));
});

test("shippingFrom: free when zero, a cost when given, nothing when eBay gave none or it is malformed", () => {
  const opt = (shippingCost: unknown) => ({ shippingOptions: [{ shippingCostType: "FIXED", shippingCost }] });
  assert.deepEqual(shippingFrom(opt({ value: "0.00", currency: "AUD" })), { free: true });
  assert.deepEqual(shippingFrom(opt({ value: "0", currency: "USD" })), { free: true });
  assert.deepEqual(shippingFrom(opt({ value: "12.50", currency: "AUD" })), { value: "12.50", currency: "AUD" });
  assert.deepEqual(shippingFrom(opt({ value: "4.5", currency: "USD" })), { value: "4.5", currency: "USD" });
  assert.equal(shippingFrom({ shippingOptions: [{ shippingCostType: "CALCULATED" }] }), undefined);
  assert.equal(shippingFrom({}), undefined);
  assert.equal(shippingFrom({ shippingOptions: [] }), undefined);
  assert.equal(shippingFrom({ shippingOptions: "x" }), undefined);
  for (const bad of [{ value: "-3", currency: "USD" }, { value: "abc", currency: "USD" }, { value: "5", currency: "usd" }, { value: 5, currency: "USD" }, null, "x"]) assert.equal(shippingFrom(opt(bad)), undefined, JSON.stringify(bad));
  // only the FIRST option counts
  assert.deepEqual(shippingFrom({ shippingOptions: [{ shippingCost: { value: "0.00", currency: "USD" } }, { shippingCost: { value: "9.00", currency: "USD" } }] }), { free: true });
});

// ─── rows of a feed ─────────────────────────────────────────────────────────────

const mkItem = (id: string, photo: string, price = 300) => ({ ...summary(id, "2025 Topps Chrome Baseball Hobby Box Sealed", price), image: { imageUrl: `https://i.ebayimg.com/images/g/${photo}/s-l225.jpg` } });

test("roundRobin: spread across queries, de-duplicated by id and by photo, capped", () => {
  const norm = (xs: unknown[]) => xs.map((x) => normaliseChase(x, "EBAY_US", NOW)!).filter(Boolean);
  const A = norm(Array.from({ length: 10 }, (_, i) => mkItem(`a${i}`, `pa${i}`)));
  const B = norm(Array.from({ length: 10 }, (_, i) => mkItem(`b${i}`, `pb${i}`)));
  const C = norm([mkItem("c0", "pc0")]);
  const out = roundRobin([A, B, C], 12);
  assert.equal(out.length, 12);
  assert.deepEqual(out.slice(0, 3).map((o) => o.id), ["v1|a0|0", "v1|b0|0", "v1|c0|0"]);
  assert.deepEqual(out.slice(3, 6).map((o) => o.id), ["v1|a1|0", "v1|b1|0", "v1|a2|0"]);
  const dup = roundRobin([norm([mkItem("x1", "same"), mkItem("x2", "other")]), norm([mkItem("y1", "same"), mkItem("x1", "p9"), mkItem("y2", "p8")])], 12);
  assert.deepEqual(dup.map((d) => d.id), ["v1|x1|0", "v1|x2|0", "v1|y2|0"]);
  assert.deepEqual(roundRobin([], 12), []);
  assert.deepEqual(roundRobin([[], []], 12), []);
});

test("lowestPriceFirst: de-duplicated, ascending by price, stable, capped", () => {
  const norm = (xs: unknown[]) => xs.map((x) => normaliseChase(x, "EBAY_US", NOW)!).filter(Boolean);
  const items = norm([mkItem("c", "pc", 500), mkItem("a", "pa", 200), mkItem("b", "pb", 200), mkItem("a", "pz", 150), mkItem("d", "pa", 160), mkItem("e", "pe", 990)]);
  const out = lowestPriceFirst(items, 3);
  assert.deepEqual(out.map((o) => o.price.value), ["200.00", "200.00", "500.00"]);
  assert.deepEqual(out.map((o) => o.id), ["v1|a|0", "v1|b|0", "v1|c|0"], "ties by id; a repeated id or photo is dropped");
  // no derived statistics anywhere in the output
  for (const o of out) for (const k of Object.keys(o)) assert.ok(["id", "title", "imageUrl", "price", "ship", "condition", "url"].includes(k), k);
});

// ─── floors ─────────────────────────────────────────────────────────────────────

test("type floors in each marketplace's currency, and US$ thresholds", () => {
  assert.equal(typeFloor("hobby-box", "EBAY_US"), 40);
  assert.equal(typeFloor("hobby-box", "EBAY_AU"), 60);
  assert.equal(typeFloor("hobby-case", "EBAY_US"), 300);
  assert.equal(typeFloor("blaster-box", "EBAY_US"), 15);
  assert.equal(usdToMarketplace(30, "EBAY_US"), 30);
  assert.equal(usdToMarketplace(30, "EBAY_AU"), 45);
  assert.equal(usdToMarketplace(30, "EBAY_GB"), 24); // 23.4
  for (const id of MARKETPLACE_IDS) assert.ok(typeFloor("hobby-pack", id) >= 1);
});

// ─── sealed feeds ───────────────────────────────────────────────────────────────

test("sealed feeds refuse pre-sales, 'read description' notes, dented boxes and eBay Live lots", () => {
  const ok = (t: string, p = 300) => normaliseSealed(summary("1", t, p), "EBAY_US", NOW);
  for (const t of [
    "2026 Topps Chrome Baseball Hobby Box Presale 11/13",
    "2026 Topps Chrome Baseball Blaster Box 11/13 PRESALE",
    "PRE SALE 2026 Topps Chrome Baseball Hobby Box",
    "2026 Topps Chrome Baseball Hobby Box Pre-Order",
    "2025 Topps Chrome Baseball Hobby Box SEALED DENTS READ DESC",
    "Check Desc 2025 Topps Chrome Baseball Hobby Box",
    "2025 Topps Chrome Baseball Hobby Box dented corner",
    "#001 - [EBAY LIVE] 2025 Topps Chrome Baseball Hobby Box",
  ]) assert.equal(ok(t), null, t);
  assert.ok(ok("2025 Topps Chrome Baseball Hobby Box Factory Sealed"));
  const target: ItemTarget = { groupKey: "2025|chrome|baseball|hobby-box", type: "hobby-box", setCode: "2025|chrome|baseball" };
  assert.equal(relevantToProduct("2025 Topps Chrome Baseball Hobby Box Presale", target), false);
});

test("titles lose emoji and decoration, and a doubled maker or line is said once", () => {
  assert.equal(cleanTitle("🔥 2025 Topps Chrome Baseball Hobby Box ✅"), "2025 Topps Chrome Baseball Hobby Box");
  assert.equal(cleanTitle("Topps Topps 2025 Chrome Baseball Hobby Box"), "Topps 2025 Chrome Baseball Hobby Box");
  assert.equal(cleanTitle("💙 *** 2025 Panini Prizm Prizm Football Blaster *** 💙"), "2025 Panini Prizm Football Blaster");
  assert.equal(cleanTitle("2025 Topps Chrome Baseball Hobby Box — Sealed (Mint) ★"), "2025 Topps Chrome Baseball Hobby Box — Sealed (Mint)");
  assert.equal(cleanTitle("x".repeat(200)).length, 80);
  assert.equal(cleanTitle(undefined), "");
  const it = baseItem(summary("1", "🔥 2025 Topps Topps Chrome Baseball Hobby Box ✅", 150), "EBAY_US", NOW, "chase");
  assert.equal(it?.title, "2025 Topps Chrome Baseball Hobby Box");
});

test("normaliseSealed: only whole sealed sports products the classifier accepts, over their type's floor", () => {
  const ok = (t: string, p = 300) => normaliseSealed(summary("1", t, p), "EBAY_US", NOW);
  assert.ok(ok("2025 Topps Chrome Baseball Hobby Box Factory Sealed NEW"));
  assert.ok(ok("2025 Topps Chrome Baseball Blaster Box Sealed", 45));
  assert.ok(ok("2025 Panini Prizm Football Mega Box Sealed", 50));
  assert.equal(ok("2025 Topps Chrome Baseball Hobby Pack", 300), null, "a pack is not a feed product");
  assert.equal(ok("2025 Topps Chrome Baseball Hobby Box Japanese"), null);
  assert.equal(ok("Topps Chrome Baseball Hobby Box"), null, "no year: which release?");
  assert.equal(ok("2025 Topps Chrome Baseball Hobby Box", 30), null, "under the hobby box floor");
  assert.equal(ok("Pokemon Surging Sparks Booster Box Sealed"), null, "a card game");
  assert.equal(ok("2025 Topps Chrome Baseball Hobby Box Random Team Break"), null, "a break");
  assert.equal(ok("2025 Topps Chrome Baseball Rookie Auto Pulled From Hobby Box", 300), null, "a product's contents");
  // several units in one listing never reach the sealed feed (a 2-8 unit price under one product's name)
  for (const title of [
    "2025 Topps Chrome Baseball Hobby Box x2 Sealed",
    "2025 Topps Chrome Baseball Blaster Box (2) Sealed",
    "Two 2025 Topps Chrome Baseball Blaster Boxes Sealed",
    "3 2025 Topps Chrome Baseball Hobby Boxes",
    "2025 Topps Chrome Baseball Blaster Box Qty 2",
  ])
    assert.equal(ok(title, 600), null, title);
  assert.ok(ok("2025 Topps Chrome Baseball Hobby Box 20 Packs Sealed", 300), "a box's own pack count is not a quantity");
});

test("normaliseType: exactly the type's products", () => {
  const t = (title: string, type: "blaster-box" | "hobby-box" | "hobby-case", p = 300) => normaliseType(summary("1", title, p), "EBAY_US", NOW, type);
  assert.ok(t("2025 Topps Chrome Baseball Blaster Box Sealed", "blaster-box", 45));
  assert.equal(t("2025 Topps Chrome Baseball Hobby Box Sealed", "blaster-box"), null);
  assert.equal(t("2025 Topps Chrome Baseball Blaster Box Case 20 Count Sealed", "blaster-box", 700), null, "a case is not a blaster");
  assert.ok(t("2025 Topps Chrome Baseball Hobby Case 12 Boxes Sealed", "hobby-case", 3000));
  assert.equal(t("2025 Topps Chrome Baseball Hobby Case 12 Boxes Sealed", "hobby-box"), null);
  assert.equal(t("2025 Topps Chrome Baseball Hobby Box Case Fresh Sealed", "hobby-case", 3000), null, "a case-fresh box is not the case");
  assert.equal(t("2025 Topps Chrome Baseball Jumbo Box Sealed", "hobby-box", 600), null, "a jumbo is not a hobby box");
  // several units in one listing never reach a type feed either
  assert.equal(t("2025 Topps Chrome Baseball Blaster Box x2 Sealed", "blaster-box", 90), null);
  assert.equal(t("2 2025 Topps Chrome Baseball Blaster Boxes Sealed", "blaster-box", 90), null);
  assert.equal(t("2025 Topps Chrome Baseball Hobby Box Set of Two", "hobby-box", 600), null);
});

// ─── one product: relevance ─────────────────────────────────────────────────────

function target(name: string): ItemTarget {
  const id = identify(name);
  assert.ok(isIdentity(id), name);
  return { groupKey: id.groupKey, type: id.type, setCode: id.set?.code ?? null };
}
const HOBBY = target("2025 Topps Chrome Baseball Hobby Box");
const JUMBO = target("2025 Topps Chrome Baseball Jumbo Box");
const BLASTER = target("2025 Topps Chrome Baseball Blaster Box");
const PRIZM = target("2025 Panini Prizm Football Hobby Box");
const SAPPHIRE = target("2025 Topps Chrome Sapphire Edition Baseball Hobby Box");
const CASE = target("2025 Topps Chrome Baseball Hobby Case");
const PACK = target("2025 Topps Chrome Baseball Hobby Pack");

// [title, target, accepted]
const RELEVANCE: [string, ItemTarget, boolean][] = [
  // the right product, noisy SEO titles, in every spelling sellers use
  ["2025 Topps Chrome Baseball Hobby Box Factory Sealed NEW", HOBBY, true],
  ["Topps 2025 Chrome Baseball Hobby Box - Factory Sealed - Fast Ship", HOBBY, true],
  ["2025 Topps Chrome MLB Baseball Hobby Box Brand New", HOBBY, true],
  ["2025 Topps Chrome Baseball Hobby Box USA Seller Free Shipping", HOBBY, true],
  ["NEW 2025 Topps Chrome Baseball Hobby Box Sealed!", HOBBY, true],
  ["2025 Topps Chrome Baseball Hobby Box - Sealed - Ships Today", HOBBY, true],
  ["2025 Topps Chrome Baseball Jumbo Box Factory Sealed", JUMBO, true],
  ["2025 Topps Chrome Baseball HTA Jumbo Box Sealed", JUMBO, true],
  ["2025 Topps Chrome Baseball Blaster Box Sealed NEW Fast Ship", BLASTER, true],
  ["2025 Panini Prizm Football Hobby Box - NFL - Factory Sealed", PRIZM, true],
  ["2025 Topps Chrome Sapphire Edition Baseball Hobby Box Sealed", SAPPHIRE, true],
  ["2025 Topps Chrome Baseball Hobby Case 12 Boxes Factory Sealed", CASE, true],
  ["2025 Topps Chrome Baseball Hobby Pack Sealed", PACK, true],
  // other products, singles, cases, lots, breaks, empty or opened, other languages, damaged
  ["2025 Topps Chrome Baseball Jumbo Box Sealed", HOBBY, false],
  ["2025 Topps Chrome Baseball Blaster Box Sealed", HOBBY, false],
  ["2025 Topps Chrome Sapphire Edition Baseball Hobby Box Sealed", HOBBY, false],
  ["2025 Topps Chrome Update Series Baseball Hobby Box Sealed", HOBBY, false],
  ["2024 Topps Chrome Baseball Hobby Box Sealed", HOBBY, false],
  ["2025 Topps Chrome Football Hobby Box Sealed", HOBBY, false],
  ["2025 Topps Chrome Baseball Hobby Box EMPTY BOX ONLY", HOBBY, false],
  ["2025 Topps Chrome Baseball Hobby Box Japanese", HOBBY, false],
  ["2025 Topps Chrome Baseball Hobby Box opened no shrink wrap", HOBBY, false],
  ["2x 2025 Topps Chrome Baseball Hobby Box Lot Sealed", HOBBY, false],
  ["Shohei Ohtani #1 2025 Topps Chrome Pulled From Hobby Box", HOBBY, false],
  ["2025 Topps Chrome Baseball Hobby Box Damaged Box Dent on corner", HOBBY, false],
  ["2025 Topps Chrome Baseball Hobby Box Random Team Break", HOBBY, false],
  ["2025 Topps Chrome Baseball Hobby Box Break Spot", HOBBY, false],
  ["2025 Topps Chrome Baseball Hobby Box Resealed", HOBBY, false],
  ["2025 Topps Chrome Baseball Repack Hobby Box", HOBBY, false],
  ["2025 Topps Chrome Baseball Mystery Hobby Box", HOBBY, false],
  ["2025 Topps Chrome Baseball Hobby Box PSA 10", HOBBY, false],
  ["2025 Topps Chrome Baseball Hobby Case (12 Boxes) Sealed", HOBBY, false],
  ["2025 Topps Chrome Baseball Hobby Box Case Fresh", CASE, false],
  ["2025 Topps Chrome Baseball Hobby Pack Single Sealed", HOBBY, false],
  ["2025 Topps Chrome Baseball Hobby Box", JUMBO, false],
  ["2025 Topps Chrome Baseball Mega Box Sealed", BLASTER, false],
  ["2025 Topps Chrome Baseball Blaster Box Walmart Exclusive", BLASTER, false],
  ["2025 Panini Prizm Football FOTL Hobby Box", PRIZM, false],
  ["2025 Panini Prizm Football Choice Box", PRIZM, false],
  ["2025 Panini Prizm Basketball Hobby Box", PRIZM, false],
  ["2025 Topps Chrome Baseball Hobby Box", SAPPHIRE, false],
  ["Pokemon Surging Sparks Booster Box", HOBBY, false],
  ["2025 Topps Chrome Baseball Hobby Pack x10 Lot", PACK, false],
  ["2025 Topps Chrome Baseball 5 Hobby Packs Sealed", PACK, false],
  ["2025 Topps Chrome & Panini Prizm Hobby Box", HOBBY, false],
  // several units in one listing: the price is not one product's
  ["2025 Topps Chrome Baseball Hobby Box x2 Sealed", HOBBY, false],
  ["Two 2025 Topps Chrome Baseball Hobby Boxes", HOBBY, false],
  ["2025 Topps Chrome Baseball Hobby Box X2 sealed", HOBBY, false],
  ["2025 Topps Chrome Baseball Hobby Box (2)", HOBBY, false],
  ["2025 Topps Chrome Baseball Hobby Box Qty 2", HOBBY, false],
  ["2 2025 Topps Chrome Baseball Hobby Boxes", HOBBY, false],
  ["2025 Topps Chrome Baseball Hobby Box Set of Two", HOBBY, false],
  ["2025 Topps Chrome Baseball Blaster Box x 2", BLASTER, false],
  ["Three 2025 Topps Chrome Baseball Blaster Boxes", BLASTER, false],
  ["2025 Topps Chrome Baseball Jumbo Box x2 Sealed", JUMBO, false],
  ["2025 Panini Prizm Football Hobby Box Lot of 3", PRIZM, false],
  // ...and wording that only LOOKS like a quantity stays accepted
  ["2025 Topps Chrome Baseball Hobby Box 20 Packs Sealed", HOBBY, true],
  ["2025 Topps Chrome Baseball Hobby Box (20 Packs) Factory Sealed", HOBBY, true],
  ["2025 Topps Chrome Baseball Hobby Case 12 Boxes Sealed", CASE, true],
];

test("multiUnit: quantity wording per type; a case IS several boxes", () => {
  assert.equal(multiUnit("2025 Topps Chrome Baseball Hobby Box Costco", "hobby-box"), true, "Costco combo");
  assert.equal(multiUnit("2025 Topps Chrome Baseball Hobby Box 3-Pack", "hobby-box"), true);
  assert.equal(multiUnit("2025 Topps Chrome Baseball Hobby Case 12 Boxes", "hobby-case"), false, "a case is several boxes");
  assert.equal(multiUnit("2025 Topps Chrome Baseball Hobby Box x2", "hobby-box"), true);
});

test(`relevantToProduct: ${RELEVANCE.length} realistic eBay titles, the right product accepted and every wrong one refused`, () => {
  assert.ok(RELEVANCE.length >= 55);
  assert.ok(RELEVANCE.filter((r) => r[2]).length >= 15 && RELEVANCE.filter((r) => !r[2]).length >= 40, "both ways");
  for (const [title, tgt, want] of RELEVANCE) {
    const accepted = relevantToProduct(title, tgt) && !refusedListing(title) && !refusedForType(title, tgt.type);
    assert.equal(accepted, want, `${want ? "should accept" : "should refuse"}: ${title}`);
  }
});

test("normaliseItemFeed: relevance, the type's floor, currency, shipping and the affiliate URL together", () => {
  const good = summary("77", "2025 Topps Chrome Baseball Blaster Box Sealed NEW", 49, "EBAY_US", { shippingOptions: [{ shippingCost: { value: "8.00", currency: "USD" } }] });
  const it = normaliseItemFeed(good, "EBAY_US", NOW, BLASTER)!;
  assert.ok(it);
  assert.deepEqual(it.ship, { value: "8.00", currency: "USD" });
  assert.equal(new URL(it.url).searchParams.get("campid"), EBAY_CAMPAIGN_ID);
  assert.equal(normaliseItemFeed(summary("78", "2025 Topps Chrome Baseball Blaster Box Sealed NEW", 12), "EBAY_US", NOW, BLASTER), null, "under the blaster floor (US$15)");
  assert.equal(normaliseItemFeed(summary("79", "2025 Topps Chrome Baseball Blaster Box Sealed NEW", 80, "EBAY_AU"), "EBAY_US", NOW, BLASTER), null, "AUD on the US marketplace");
  assert.equal(normaliseItemFeed(summary("80", "2025 Topps Chrome Baseball Blaster Box Sealed", 80, "EBAY_US", { buyingOptions: ["AUCTION"] }), "EBAY_US", NOW, BLASTER), null, "auction");
  assert.equal(normaliseItemFeed(summary("81", "2025 Topps Chrome Baseball Blaster Box Sealed", 80, "EBAY_US", { image: { imageUrl: "https://evil.example/x.jpg" }, thumbnailImages: [] }), "EBAY_US", NOW, BLASTER), null, "an image that is not eBay's");
});

test("a pack's own search refuses multi-pack lots and other non-units, as the sweep does", () => {
  const ok = (t: string) => normaliseItemFeed(summary("1", t, 20), "EBAY_US", NOW, PACK);
  for (const t of [
    "2025 Topps Chrome Baseball 5 Hobby Packs Sealed",
    "2025 Topps Chrome Baseball Hobby Packs",
    "2025 Topps Chrome Baseball Hobby Pack - 4 Packs",
    "2025 Topps Chrome Baseball Hobby Pack x10",
    "2025 Topps Chrome Baseball Hobby Pack Lot",
  ])
    assert.equal(ok(t), null, t);
  assert.ok(ok("2025 Topps Chrome Baseball Hobby Pack Sealed"));
});
