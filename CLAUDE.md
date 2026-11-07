# Working in this repo

WaxCompare (waxcompare.app) is a **sealed-only sports card** price comparison site: hobby, jumbo and FOTL boxes, cases, blasters,
megas, hangers and packs, compared across independent card shops in each region, with eBay, Amazon and Topps links. A port of MTG
Compare's sealed engine (itself DexCompare's), started 2026-11-07 (owner approved the niche 2026-11-06). Read `README.md`, then
`DEPLOY.md`, then `DECISIONS.md` (entries before 2026-11-07 are MTG Compare's and DexCompare's; the engine's rules come from them).

## Data: on GitHub, no hosted database

- The importers (`scripts/import.ts`, `scripts/ebay-import.ts`, run by `.github/workflows/sealed-import.yml` and `ebay-import.yml`)
  run on a throwaway Postgres inside the runner, seeded from `data/public/` (`scripts/seed-from-public.ts`), then export every
  public table back to `data/public/` and commit it to `main` (`scripts/publish-public-data.sh`). The site reads only those files
  (`src/lib/public-data/`). There is no Neon project and no database secret; never add one without the owner.
- Both jobs share the concurrency group `waxcompare-data`: each exports the whole database, so two at once would overwrite rows.
- Never edit `data/public/` or `data/sets/releases.json` by hand: they belong to the workflows. Never write anything private there.

## Price alerts: RiftCompare's shared service (owner, 2026-11-02)

The product page's "Email me when the price drops" form (`src/components/PriceAlertForm.tsx`) posts to
`https://riftcompare.com/api/sister-alerts`; RiftCompare keeps the address, confirms it and emails. It reads this site's
static `/alert-feed.json` (`src/lib/alert-feed.ts`) once a day. This site never stores an address or holds a mail key.
Keep the feed's price `lowestPriceCents` (never eBay, never converted) and the route `force-static`.

## Deploys

**One production build per 12 hours, and production only (owner, 2026-11-02: Vercel spend capped at $5–6 a
day).** `scripts/vercel-ignore-build.sh` skips a `[deploy]` commit within 12 hours of the last production
deployment (it rides the next release); `[urgent]` in the subject overrides that, only when the owner says
so. `vercel.json` disables every branch except production (`"**": false`), so no preview is ever built.
Never dispatch a manual release just to ship a merge. DECISIONS.md, 2026-11-02.

Production builds only a commit whose SUBJECT carries `[deploy]` (`scripts/vercel-ignore-build.sh`,
`tests/vercel-ignore-build.test.ts`). The evening sealed import's data commit carries it: one release a day. **Never put `[deploy]`
in a code commit's subject on your own initiative**; code rides the next data release. "Ship it" means land on `main`. Use
`release.yml` (or `[deploy]`) only when the owner says it is urgent, and say so. Previews build only with `[preview]` in the
subject, only when the owner asks.

## Rules that keep prices on the right product

- `src/lib/sealed-title.ts` `identify()` decides what a store title is, and refuses rather than guesses. A product needs year (or
  season), maker, line, sport and type; breaks, break spots, repacks, mystery boxes, resealed product, singles, slabs, lots,
  retailer-exclusive editions, accessories, other games and other languages are left out. Wrongly merging two products (a
  blaster's price on a hobby box's page) is worse than missing one. Every rule changed gets a real store title in
  `tests/sealed-title.test.ts`.
- A release gets a page only when 2+ stores sell it (`scripts/discover-sets.ts`). A release date is shown only when sourced; an
  undated release is never "out", "pre-order" or "next". The makers publish no MSRP and no pack count is claimed: never invent a
  price, an MSRP, a pack count, a print run or a release date.
- A region compares only stores that charge in its currency; prices are never converted for display.
- Stores live in `src/data/stores.json` (Shopify or WooCommerce). A 403, 429 or bot challenge stops that store; never work around it.
- Pages are `force-dynamic` and cached by Vercel's CDN through `next.config.js` headers, never ISR; no page reads a cookie, header
  or session (`tests/cache-ttl.test.ts`).

## Amazon's price on the product page (owner, 2026-11-05)

`scripts/amazon-asins.ts` (daily import) finds each product's ASIN on its region's own Amazon, kept only when
`identify()` reads the title as the same product; `scripts/fetch-amazon-prices.ts` (first in every build) fetches those
prices into the git-ignored `data/amazon-live/`; `lib/amazon-live.ts` gives the product page its pinned Amazon row's link and
24-hour price. Prices are never committed, never a sort, best price, deal, feed or quick view. Credentials
`AMAZON_CREATORS_AU_*` (GitHub + Vercel) serve every store; a store without API access is skipped. `tests/amazon-api.test.ts`.

## eBay

- Only `scripts/ebay-import.ts` (GitHub Actions) calls eBay's Browse API; the website never calls eBay and holds no eBay credential.
- WaxCompare has its OWN keyset (owner, 2026-11-06: a new site never shares a sister's keys), capped at 2,500 calls a day
  (`EBAY_DAILY_CAP`). Never raise it, or point the import at another site's keys, without the owner.
- eBay rows are labelled ads, pinned above the stores, never counted as a store and never re-ranked into store rows.

## Brand and legal copy

- The brand, logo and share images never use Topps, Panini, Upper Deck, league or team names or logos. Product names are used only
  to describe what stores sell. `TRADEMARK_DISCLAIMER` (`src/lib/site.ts`) stays in the footer, `/about` and `/terms`.
- Product photos are the stores' own, hotlinked.
- Topps' own US shop is an ordinary store row; `TOPPS_IMPACT_LINK` (`src/lib/affiliate.ts`) tags it once Impact approves.

## Checks

```
npx prisma generate
npm run typecheck
npm run lint
npm test
```

Tests that render real pages skip until the first import writes `data/public/` (`tests/helpers/has-data.ts`).
Record non-obvious decisions in `DECISIONS.md` (newest at the bottom).
