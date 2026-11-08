import Link from "@/components/Link";
import { SiteReviews } from "@/components/site-reviews/SiteReviews";
import { inSeason } from "@/lib/black-friday";
import { CORE_SALES, salesInSeason } from "@/lib/sale-seasons";
import { ComingSoon } from "@/components/ComingSoon";
import { loadFeatured } from "@/lib/coming-soon-data";
import { cache } from "react";
import type { Metadata } from "next";
import { Ago } from "@/components/Ago";
import { RecentlyViewed } from "@/components/Recent";
import { firstHotSet, hotSetHighlight, NoPreFooter } from "@/components/Ebay";
import { EbayStrip } from "@/components/EbayStrip";
import { Icon, type IconName } from "@/components/Icon";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductRail } from "@/components/ProductRail";
import { SearchBox } from "@/components/SearchBox";
import { Flag } from "@/components/Flag";
import { RegionChips } from "@/components/RegionChips";
import { Empty, Section } from "@/components/Section";
import { homeRails, regionOverview, tcgplayerTiles, type ProductCardData } from "@/lib/data";
import { TcgplayerStrip } from "@/components/TcgplayerStrip";
import { dealsCopy, dealsInMarket, nearestRegion, stockLabel } from "@/lib/deals";
import { cardOpen } from "@/lib/compact";
import { money, plural, timeAgo } from "@/lib/format";
import { thumb } from "@/lib/images";
import { COUNTRY_GUIDE } from "@/content/guides/country-prices";
import { openPreorderGuides } from "@/lib/preorder-guides";
import { featureOrder, featureSort, isPreorderSet, formatRelease } from "@/lib/release";
import { REGIONS, regionOrNotFound, type Market, type RegionInfo } from "@/lib/regions";
import { ogCardImage, pageMeta, regionAlternates } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { fitDescription, seoCopy, seoTitleText } from "@/lib/seo-titles";
import { PRODUCT_TYPES } from "@/lib/sealed-title";
import { SET_BY_CODE, SETS, type MtgSet } from "@/lib/sets";
import { stockHeadline } from "@/lib/stock";
import { olderInStockData } from "@/lib/stock-data";
import { StockRow } from "@/components/StockRow";
import { storesInMarket } from "@/lib/stores";
import { emptyHomeReport, loadHomeReport } from "@/lib/home-report";
import { MarketReport } from "@/components/home/MarketReport";
import { HeroCards, heroFromPicks, type HeroCard } from "@/components/home/HeroCards";
import { regionPicks, type Pick } from "@/lib/picks";
import { SetIndex } from "@/components/SetIndex";
import { setCountsGrouped, typeLabelsInMarket } from "@/lib/hub-data";

// Rendered per request and kept by Vercel's CDN for a day (next.config.js, CDN_PAGES), never ISR: an ISR write
// costs about twenty renders, and the data only changes with a release, which empties the CDN anyway.
export const dynamic = "force-dynamic";

// The overview's counts go into the description ("1,591 in stock today") and the hero's trust line: one read, shared.
const getOverview = cache((market: Market) => regionOverview(market));

export async function generateMetadata({ params }: { params: { region: string } }): Promise<Metadata> {
  const r = regionOrNotFound(params.region);
  const n = storesInMarket(r.market).length;
  const overview = await getOverview(r.market);
  const title = seoCopy.homeTitle(r, n);
  const meta = pageMeta({
    title: seoTitleText(title),
    description: seoCopy.homeDescription(r, n, overview.inStock),
    path: `/${r.region}`,
    alternates: regionAlternates(r.region, ""),
  });
  return {
    ...meta,
    title,
    // The region's own share card (app/og/[region]): what a link to /au or /us shows on Reddit, Discord or X.
    openGraph: { ...meta.openGraph, images: [ogCardImage(`/og/${r.region}`, `WaxCompare: sealed sports card prices across ${n} ${r.adjective} card shops`)] },
  };
}

const QUICK_TYPES = ["hobby-boxes", "jumbo-boxes", "mega-boxes", "blaster-boxes", "hanger-boxes", "hobby-cases", "packs", "factory-sets"];

export default async function RegionHome({ params }: { params: { region: string } }) {
  const r = regionOrNotFound(params.region);
  const [{ boxes, etbs, preorders, latestSets: bySet }, overview, deals, report, older, featured, setCounts, listedTypes, picks] = await Promise.all([
    homeRails(r.market),
    getOverview(r.market),
    dealsInMarket(r.market, { take: 8 }),
    // The written market report, moved here from the landing page (2026-10-25): this region's figures, after the rails.
    loadHomeReport(r.region).catch(() => emptyHomeReport(r.region)),
    olderInStockData(r.market).catch(() => []),
    loadFeatured(r.region).catch(() => null),
    setCountsGrouped(r.market),
    typeLabelsInMarket(r.market),
    regionPicks(r.region).catch((): Pick[] => []),
  ]);
  // The soonest upcoming set with a pre-order page: the rail's "see all" goes there.
  const preorderGuide = openPreorderGuides()[0] ?? null;
  const storeCount = storesInMarket(r.market).length;
  // The newest released set leads, the set on pre-order second (release.ts featureOrder): a pre-order is never the top card.
  const latestSets = featureOrder(SETS.filter((s) => bySet.has(s.code)).slice(0, 4).map((s) => s.code)).map((c) => SET_BY_CODE.get(c)!);
  // The first hot set that is out, in featuring order (lib/popular.ts hotSetsByFeature: the newest release first), gets the sealed strip's highlighted
  // eBay button, "Shop 30th Celebration on eBay": inside that strip's own top line, so the page keeps its two units.
  const hotHighlight = hotSetHighlight(firstHotSet());
  // The hero's two trading cards: the region's most-stocked new boxes (lib/picks.ts, the landing page's own picks), photo first.
  const heroCards: HeroCard[] = heroFromPicks(picks);
  const other = REGIONS[nearestRegion(r.region)];
  const preorderLink = { href: `/${r.region}/releases`, label: "Pre-orders" };

  return (
    <div>
      {/* The sports-card hero (owner, 2026-11-08: the KaeYoung / ScentCompare full-width hero with featured products, in a sports card
          look of our own, globals.css .wx-hero): the words, search, region row, shortcuts and the stat line on the left, the two hot
          products as trading cards on the right (under the words on a phone). The h1, the "Hot right now" h2 and every link are as before. */}
      <section className="wx-hero">
        <div className="wx-hero-in grid gap-8 pb-10 pt-6 sm:pb-12 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,480px)] lg:items-center lg:gap-10">
          <div className="min-w-0">
            <Breadcrumbs items={[{ href: "/", label: "WaxCompare" }, { label: r.name }]} />
            <p className="wx-kicker">
              <Flag code={r.short} /> {r.name} · prices in {r.currency}
            </p>
            <h1 className="wx-h1 mt-3 max-w-3xl">
              Compare hobby box &amp; blaster prices in <span className="wx-h1-accent">{r.inName}</span>
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted sm:text-lg">
              Today&rsquo;s sealed sports card prices and stock from {plural(storeCount, `${r.adjective} card shop`)}, cheapest first.
            </p>
            <div className="mt-6 max-w-2xl">
              <SearchBox region={r.region} size="lg" />
            </div>
            <RegionChips region={r.region} className="mt-4" />
            <nav aria-label="Shop by type" className="scroller mt-4 gap-2 sm:flex-wrap sm:overflow-visible sm:[-webkit-mask-image:none] sm:[mask-image:none]">
              <Link href={`/${r.region}/deals`} prefetch={false} className="chip min-h-10 border-brand/40 bg-brand-soft font-semibold text-brand-strong hover:border-brand/70">
                <Icon name="tag" size={16} /> Deals
              </Link>
              <Link href={`/${r.region}/back-in-stock`} prefetch={false} className="chip min-h-10 border-open/30 bg-open-soft font-semibold text-open hover:border-open/60">
                <Icon name="check" size={16} /> Back in stock
              </Link>
              <Link href={`/${r.region}/out-of-print`} prefetch={false} className="chip min-h-10">
                Older releases in stock
              </Link>
              <Link href={`/${r.region}/price-moves`} prefetch={false} className="chip min-h-10">
                Price moves
              </Link>
              {QUICK_TYPES.map((slug) => {
                const t = PRODUCT_TYPES.find((x) => x.slug === slug)!;
                return (
                  <Link key={slug} href={`/${r.region}/type/${slug}`} prefetch={false} className="chip min-h-10">
                    {t.plural}
                  </Link>
                );
              })}
            </nav>
            <p className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="wx-stat">
                <span className="h-2 w-2 shrink-0 rounded-full bg-open motion-safe:animate-pulse" aria-hidden="true" />
                <b className="tabular">{storeCount.toLocaleString("en")}</b> stores
              </span>
              <span className="wx-stat">
                <b className="tabular">{overview.inStock.toLocaleString("en")}</b> in stock
              </span>
              <span className="wx-stat">
                <b className="tabular">{overview.products.toLocaleString("en")}</b> products
              </span>
              {/* A live <time>: the page is cached for a day, so a fixed "3 hours ago" would freeze. */}
              <span className="wx-stat">checked {overview.lastChecked ? <Ago iso={overview.lastChecked.toISOString()} initial={timeAgo(overview.lastChecked)} /> : "twice a day"}</span>
            </p>
          </div>
          {heroCards.length > 0 && (
            <aside aria-labelledby="hot-now">
              <h2 id="hot-now" className="wx-kicker mb-3">
                Hot right now · most stocked
              </h2>
              <HeroCards cards={heroCards} region={r.region} />
            </aside>
          )}
        </div>
      </section>

      {/* The page carries two strips of its own (sealed, chase cards): no third one above the footer. */}
      <NoPreFooter />
      <div className="page">
        {/* The next set, when there is one (lib/coming-soon.ts): its headline pre-orders here and its hub; gone on release day. */}
        <div className="mt-8 grid gap-3">
          <ComingSoon featured={featured} r={r} today={new Date().toISOString().slice(0, 10)} />
          {inSeason(new Date().toISOString().slice(0, 10)) && (
            <Link
              href={`/${r.region}/black-friday`}
              prefetch={false}
              className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-shadow hover:shadow-lift"
            >
              <span>
                <span className="font-display text-lg font-bold">Black Friday deals in {r.inName}</span>
                <span className="block text-sm text-muted">Every product furthest under the median store price today, biggest gap first.</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-brand-strong">See the deals →</span>
            </Link>
          )}
          {salesInSeason(CORE_SALES, new Date().toISOString().slice(0, 10)).map((sale) => (
            <Link
              key={sale.slug}
              href={`/${r.region}/${sale.slug}`}
              prefetch={false}
              className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-shadow hover:shadow-lift"
            >
              <span>
                <span className="font-display text-lg font-bold">{sale.linkLabel} in {r.inName}</span>
                <span className="block text-sm text-muted">Every product furthest under the median store price today, biggest gap first.</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-brand-strong">See the deals →</span>
            </Link>
          ))}
        </div>
        {deals.length > 0 && (
          <Section title={dealsCopy.rail} kicker={dealsCopy.railKicker} href={`/${r.region}/deals`} linkLabel="All deals">
            <ProductRail products={deals} region={r.region} eager={4} label={dealsCopy.rail} />
          </Section>
        )}

        {/* The page's first eBay unit, under the deals rail: sealed listings as an image strip (imported from eBay once a day, fetched in the
            browser once it is near the viewport), with the owner's hot set as its highlighted button; with none to list, the compact CTA row.
            The chase-card strip follows the booster-box rail, far enough down that the two never share a phone screen. */}
        <EbayStrip region={r.region} context="sealed" placement="listings-home-sealed" className="mt-14" search={{ kind: "sealed", query: "" }} highlight={hotHighlight} />

        {latestSets.length > 0 && (
          <Section title="Latest releases" kicker="New & upcoming" href={`/${r.region}/sets`} linkLabel="All releases">
            <div className="grid gap-4 md:grid-cols-2">
              {latestSets.map((s) => (
                <SetCard key={s.code} r={r} s={s} items={bySet.get(s.code) ?? []} />
              ))}
            </div>
          </Section>
        )}

        {preorders.length > 0 && (
          <Section
            title="Open for pre-order"
            kicker="Upcoming releases"
            href={preorderGuide ? `/${r.region}/preorders/${preorderGuide.set.slug}` : `/${r.region}/releases`}
            linkLabel={preorderGuide ? `Compare ${preorderGuide.set.name} pre-orders` : "Release calendar"}
          >
            <ProductGrid products={preorders} region={r.region} />
          </Section>
        )}

        <Section title="Hobby boxes in stock" kicker="Newest releases first" href={`/${r.region}/type/hobby-boxes`}>
          {boxes.length ? (
            <ProductGrid products={boxes} region={r.region} />
          ) : (
            <Empty actions={[preorderLink, { href: `/${r.region}/type/hobby-boxes`, label: "All hobby boxes" }, { href: `/${other.region}/type/hobby-boxes`, label: `Hobby boxes in ${other.inName}` }]}>
              No hobby boxes in stock right now.
            </Empty>
          )}
          <p className="mt-4 text-sm text-muted">
            How do hobby box prices in {r.inName} compare with other countries?{" "}
            <Link href={COUNTRY_GUIDE.path} prefetch={false} className="font-semibold text-brand hover:underline">
              Box prices by country →
            </Link>
          </p>
        </Section>

        {/* The second unit, after the hobby-box rail (a viewport and more below the sealed strip). */}
        <EbayStrip region={r.region} context="sealed" placement="listings-home" className="mt-14" search={{ kind: "sealed", query: "blaster box" }} />

        <Section title="Blaster boxes in stock" kicker="Newest releases first" href={`/${r.region}/type/blaster-boxes`}>
          {etbs.length ? (
            <ProductGrid products={etbs} region={r.region} />
          ) : (
            <Empty actions={[preorderLink, { href: `/${r.region}/type/blaster-boxes`, label: "All blaster boxes" }, { href: `/${other.region}/type/blaster-boxes`, label: `Blaster boxes in ${other.inName}` }]}>
              No blaster boxes in stock right now.
            </Empty>
          )}
        </Section>


        {older.length > 0 && (
          <Section title="Older releases still in stock" kicker="Released 18+ months ago" href={`/${r.region}/out-of-print`} linkLabel="All older releases in stock">
            <p className="-mt-2 mb-4 max-w-2xl text-sm text-muted">
              Hobby and retail boxes from older releases that {r.adjective} card shops still have on the shelf. Today&rsquo;s stock and price only; older product&rsquo;s prices can move.
            </p>
            <ol className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
              {older.slice(0, 4).map((g) => (
                <li key={g.set.code}>
                  <StockRow p={g.items[0]} r={r} />
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* Every release listed here, so every release page is two clicks from the landing page and its products three (2026-10-25). */}
        <SetIndex r={r} counts={setCounts} types={listedTypes} />
        <HowItWorks r={r} stores={storeCount} />
        {/* The site's own star score and approved reviews (owner, 2026-11-03), loaded in the browser; nothing until there is a rating. */}
        <SiteReviews />
        {/* The visitor's own recently viewed products, from this browser's storage: rendered at the end, so nothing above moves. */}
        <RecentlyViewed region={r.region} />

        {overview.products === 0 && (
          <div className="mt-10">
            <Empty actions={[{ href: `/${other.region}`, label: `WaxCompare ${other.name}` }]}>We&rsquo;re still reading {r.adjective} stores for the first time. Check back shortly.</Empty>
          </div>
        )}
      </div>
      <div className="mb-4">
        <MarketReport report={report} />
      </div>
    </div>
  );
}

/**
 * A latest-set card: its header links to the set (the logo, or, for a set with none yet, its booster box on a plate), and each
 * headline product is its own row linking to its page.
 */
function SetCard({ r, s, items: all }: { r: RegionInfo; s: MtgSet; items: ProductCardData[] }) {
  const order = ["Hobby Box", "Jumbo Box", "Mega Box", "Blaster Box"];
  const items = all
    .sort((a, b) => order.indexOf(a.productType) - order.indexOf(b.productType))
    .slice(0, 3);
  const pre = isPreorderSet(s.code);
  const art = s.logo ? null : thumb(all.find((p) => p.imageUrl && (p.productType === "Hobby Box" || p.productType === "Blaster Box"))?.imageUrl, 200);
  return (
    <div className="card flex flex-col overflow-hidden">
      <Link href={`/${r.region}/sets/${s.slug}`} prefetch={false} className="group flex min-h-[4.5rem] items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-raised sm:px-5">
        <span className="flex min-w-0 items-center gap-3">
          {s.logo ? (
            <img src={s.logo} alt={`${s.name} logo`} width={96} height={40} className="h-10 w-24 shrink-0 object-contain" loading="lazy" decoding="async" />
          ) : art ? (
            <span className="plate flex h-12 w-12 shrink-0 items-center justify-center">
              <img src={art} alt={s.name} width={48} height={48} className="h-full w-full object-contain p-1" loading="lazy" decoding="async" />
            </span>
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-soft font-display font-bold text-brand-strong">{s.name.slice(0, 1)}</span>
          )}
          <span className="min-w-0">
            <span className="block font-display text-lg font-bold leading-tight group-hover:text-brand">{s.name}</span>
            {s.dateKnown && (
              <span className="block text-xs text-faint">
                {pre ? "Releases" : "Released"} {formatRelease(s.releaseDate)}
              </span>
            )}
          </span>
        </span>
        {pre ? (
          <span className="shrink-0 rounded-full bg-pre-soft px-2.5 py-1 text-xs font-semibold text-pre">Pre-order</span>
        ) : (
          <Icon name="arrow-right" size={18} className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
        )}
      </Link>
      <ul className="divide-y divide-line border-t border-line">
        {items.length ? (
          items.map((p) => (
            <li key={p.slug}>
              <Link href={`/${r.region}/p/${p.slug}`} prefetch={false} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-raised sm:px-5">
                <span className="text-muted">{p.productType}</span>
                <span className="tabular text-right font-semibold">
                  {cardOpen(p) ? (
                    <>
                      <span className="block text-xs font-semibold text-open sm:inline sm:text-sm">
                        {stockLabel(p)}
                        <span className="hidden sm:inline font-normal text-faint"> · </span>
                      </span>
                      {money(p.lowestPriceCents, r.market)}
                    </>
                  ) : (
                    <span className="text-faint">{stockHeadline(p).text}</span>
                  )}
                </span>
              </Link>
            </li>
          ))
        ) : (
          <li>
            <Link href={`/${r.region}/sets/${s.slug}`} prefetch={false} className="flex min-h-11 items-center px-4 py-2.5 text-sm text-muted hover:bg-raised sm:px-5">
              See every {s.name} product
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}

function HowItWorks({ r, stores }: { r: RegionInfo; stores: number }) {
  const steps: { icon: IconName; t: string; d: React.ReactNode }[] = [
    {
      icon: "store",
      t: "We read the stores",
      d: (
        <>
          Twice a day, the sealed sports card listings of{" "}
          <Link href={`/${r.region}/stores`} prefetch={false} className="font-medium text-brand-strong underline-offset-2 hover:underline">
            {plural(stores, `${r.adjective} card shop`)}
          </Link>
          , in {r.currency}.
        </>
      ),
    },
    { icon: "check", t: "You see who has it", d: "Every product page lists who carries it, in stock or sold out, cheapest in-stock price first." },
    { icon: "arrow-right", t: "You buy from the store", d: "Click through and buy on the store’s own page. No store pays to rank higher." },
  ];
  return (
    <section className="mt-16" aria-labelledby="how">
      <h2 id="how" className="font-display text-xl font-bold tracking-tight">
        How WaxCompare works
      </h2>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.t} className="flex gap-3 rounded-xl border border-line bg-surface p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
              <Icon name={s.icon} size={18} />
            </span>
            <div>
              <h3 className="font-display font-bold">{s.t}</h3>
              <p className="mt-1 text-sm leading-6 text-muted">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
