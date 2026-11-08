# SportsCardCompare

Sealed sports cards (hobby boxes, jumbo and FOTL boxes, cases, Breaker's Delight, blasters, megas, hangers, value packs and
packs) compared across independent card shops in each region, in that region's own currency, with live stock. eBay listings
and Amazon sit above the stores as labelled marketplaces. Live at **sportscardcompare.com**.

A port of MTG Compare's sealed engine (`Specifxx/mtgcompare`, itself DexCompare's sealed app), started 2026-11-07. A Compare
Empire site: the price alerts run on RiftCompare's shared service, and the family links list the other card sites.
Deploying: [DEPLOY.md](DEPLOY.md). Why things are the way they are: [DECISIONS.md](DECISIONS.md) (entries before 2026-11-07 are
MTG Compare's and DexCompare's, kept because the engine's rules come from them).

## What a product is

`src/lib/sealed-title.ts` `identify()` reads a store title and gives back one product or a refusal. A product is the release
(year or season, maker, line, sport, and for soccer the competition), the product type, and an edition when a market sells its
own (Asia, International). Its group key reads `2025|chrome|baseball|hobby-box`. The lines and their makers are in
`src/lib/lines.ts`; the product types (with each one's price floor per market) in `PRODUCT_TYPES`.

It refuses rather than guesses. Breaks and break spots, repacks, mystery and "hit" boxes, resealed product, singles and slabs,
lots and multiples (a case's own box count is not a lot), retailer-exclusive editions, accessories, other games, other
languages, and any title without a year are left out. A season (2024-25) is never a calendar year, WNBA is never NBA, and a
UK shop's "football" with a season and no competition is refused, because it may be soccer. Every rule has a real title in
`tests/sealed-title.test.ts`.

## Releases

A release gets a page (`/<region>/sets/<slug>`) once two or more stores sell it: `scripts/discover-sets.ts` adds it to
`data/sets/releases.json` in the import's own commit. A release has a date only when one is sourced; an undated release is never
"out", "pre-order" or "next". The makers publish no list prices, so there is no MSRP anywhere, and no pack count is claimed
(`src/lib/packs.ts` is empty on purpose).

## Data

No hosted database. Each import runs in GitHub Actions on a throwaway Postgres seeded from the committed `data/public/`, then
exports every public table back to `data/public/` and commits it to `main`. The site reads only those files
(`src/lib/public-data/`). See DEPLOY.md, "Where the data lives".

- `scripts/import.ts`: every store in `src/data/stores.json` (Shopify `products.json` or WooCommerce's Store API), twice a day.
- `scripts/ebay-import.ts`: eBay's Browse API with Compare Empire's shared keyset, 1,400 calls a day, once a day.
- `scripts/amazon-asins.ts` / `scripts/fetch-amazon-prices.ts`: Amazon ASINs in the import, Amazon prices in each build (never
  committed; shown for 24 hours).
- `scripts/probe-stores.ts` / `scripts/registry-from-probe.ts`: how the store list was found and is refreshed.

## Pages

Per region (`/us`, `/ca`, `/au`, `/uk`, …): the home, type pages (`/type/hobby-boxes`), release pages, the release calendar,
deals, back in stock, out of print, this week, stores, guides and every product (`/p/<slug>`). The landing page `/` picks the
visitor's region in the browser (time zone, then their own pick), never by redirecting a crawler.

## Money

Every paid link goes through `src/lib/affiliate.ts`, is `rel="sponsored"` and labelled. eBay (EPN campaign 5339155912, custom id
`wax-<market>-<feed>`) and Amazon (`compareempire-22` until a SportsCardCompare tag exists) are pinned above the store rows, never counted
as a store, never "best price", never a deal. Topps' own US shop is an ordinary store row, sorted by price like the rest; its
link turns into a Topps Impact deep link once that programme approves (`TOPPS_IMPACT_LINK`, one line). Store rows are always
sorted by price, and commission never decides the order.

## Checks

```
npx prisma generate
npm run typecheck
npm run lint
npm test
```

Tests that render pages from real data skip until the first import has written `data/public/` (`tests/helpers/has-data.ts`).
