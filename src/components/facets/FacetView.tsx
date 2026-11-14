import Link from "@/components/Link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Ago } from "@/components/Ago";
import { NoPreFooter } from "@/components/Ebay";
import { ProductGrid } from "@/components/ProductGrid";
import { cardOpen } from "@/lib/compact";
import { gridPageHasRoomForFooter } from "@/lib/ebay-ads";
import { BRANDS, brandHref, comboHref, countByBrand, countBySport, filterTagged, SPORT_ORDER, sportHref, sportNavLabel, sportSlug, type Brand, type FacetCard } from "@/lib/facets";
import type { Sport } from "@/lib/lines";
import { money, plural, timeAgo } from "@/lib/format";
import type { RegionInfo } from "@/lib/regions";
import { PRODUCT_TYPES } from "@/lib/sealed-title";
import { itemListJsonLd, jsonLd } from "@/lib/seo";
import { SET_BY_CODE } from "@/lib/sets";

// Per type, the cheapest in-stock products shown; the rest is one tap away on the browse page's filtered view.
const PER_TYPE = 8;
const MAX_SHOWN = 64;

/** "Panini Basketball" / "Basketball (NBA)" / "Panini": what the page is called in headings. */
export function facetName(sport?: Sport, brand?: Brand): string {
  const s = sport ? sportNavLabel(sport) : "";
  if (sport && brand) return `${brand.label} ${s.replace(/ \(.*\)$/, "")}`;
  return brand ? brand.label : s;
}

/** The browse page's filtered view of a facet: the whole list, in stock, with the sport and brand selects already set. */
function seeAllHref(r: RegionInfo, sportSlug: string | null, brand: Brand | undefined, typeSlug?: string): string {
  const p = new URLSearchParams();
  if (sportSlug) p.set("sport", sportSlug);
  if (brand) p.set("brand", brand.slug);
  if (typeSlug) p.set("type", typeSlug);
  p.set("stock", "in");
  return `/${r.region}/sealed?${p.toString()}`;
}

/**
 * A sport page, a brand page or a sport-and-brand page (owner, 2026-11-09: collectors browse by their sport and their brand).
 * The filter bar is plain links (no JavaScript, one cached copy for everyone): the other sports (or the brands) with something listed
 * under the current choice, then the product types as in-page anchors, then the releases. Counts are real products; a chip with
 * none is not drawn. The products are the cheapest in stock per type; sold-out ones are named at the foot.
 */
export function FacetView({
  r,
  tagged,
  sport,
  brand,
  checked,
}: {
  r: RegionInfo;
  /** Every tagged product in the market (lib/facet-data.ts taggedProducts). */
  tagged: FacetCard[];
  sport?: Sport;
  brand?: Brand;
  checked: Date | null;
}) {
  const mine = filterTagged(tagged, { sport, brand });
  const open = mine.filter((t) => cardOpen(t.card));
  const sold = mine.filter((t) => !cardOpen(t.card));
  const name = facetName(sport, brand);
  const from = open.reduce<number | null>((m, t) => (t.card.lowestPriceCents != null && (m == null || t.card.lowestPriceCents < m) ? t.card.lowestPriceCents : m), null);
  const path = sport ? (brand ? comboHref(r.region, sport, brand) : sportHref(r.region, sport)) : brandHref(r.region, brand!);

  // The other sports (on a brand page: the sports of that brand), with counts under the current brand; and the brands under the current sport.
  const otherSports = countBySport(filterTagged(tagged, { brand }));
  const otherBrands = countByBrand(filterTagged(tagged, { sport }));
  const sportChipHref = (s: Sport) => (brand ? comboHref(r.region, s, brand) : sportHref(r.region, s));
  const brandChipHref = (b: Brand) => (sport ? comboHref(r.region, sport, b) : brandHref(r.region, b));

  // Types, in the site's own order (hobby first), with the in-stock ones leading each section.
  const types = PRODUCT_TYPES.filter((t) => mine.some((m) => m.card.productType === t.label));
  const rank = (t: FacetCard) => t.card.lowestPriceCents ?? Number.MAX_SAFE_INTEGER;
  let budget = MAX_SHOWN;
  const sections = types
    .map((t) => {
      const all = open.filter((m) => m.card.productType === t.label).sort((a, b) => rank(a) - rank(b) || a.card.name.localeCompare(b.card.name));
      const take = Math.max(0, Math.min(PER_TYPE, budget));
      budget -= take;
      return { t, all, shown: all.slice(0, take), soldCount: sold.filter((m) => m.card.productType === t.label).length };
    })
    .filter((x) => x.all.length > 0);
  const typesWithStock = sections.map((x) => x.t);
  const shownCards = sections.flatMap((x) => x.shown.map((m) => m.card));

  // Releases (years): each a real set page in this market, newest first.
  const releases = [...new Set(mine.map((m) => m.card.setCode).filter((c): c is string => !!c))]
    .map((c) => SET_BY_CODE.get(c))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
    .slice(0, 24);

  const crumbs = [
    { href: `/${r.region}`, label: r.name },
    ...(sport && brand ? [{ href: sportHref(r.region, sport), label: sportNavLabel(sport) }, { label: brand.label }] : sport ? [{ href: `/${r.region}/sport`, label: "Sports" }, { label: sportNavLabel(sport) }] : [{ href: `/${r.region}/brand`, label: "Brands" }, { label: brand!.label }]),
  ];
  const ld = itemListJsonLd({ name: `${name} cards in ${r.inName}`, path, items: shownCards.map((p) => ({ path: `/${r.region}/p/${p.slug}`, name: p.name })) });
  const chip = "chip min-h-10 whitespace-nowrap";
  const intro =
    brand && !sport
      ? `${brand.blurb} Compared across ${r.adjective} stores: what is in stock and the lowest price today.`
      : `${name} hobby, jumbo, mega and blaster boxes, cases and packs from ${r.adjective} stores, side by side: what is in stock and the lowest price today.`;
  const sSlug = sport ? sportSlug(sport) : null;

  return (
    <div className="page py-8">
      {!(gridPageHasRoomForFooter(shownCards.length) && shownCards.length >= 12) && <NoPreFooter />}
      <Breadcrumbs items={crumbs} />
      <h1 className="page-h1">
        {name} card boxes in {r.inName}
      </h1>
      <p className="mt-3 max-w-3xl leading-7 text-muted">{intro}</p>
      <p className="mt-2 text-sm text-muted">
        <b className="text-ink">{open.length}</b> in stock
        {from != null && <> from {money(from, r.market)}</>} · {plural(mine.length, "product")} listed
        {checked && (
          <>
            {" "}
            · prices checked <Ago iso={checked.toISOString()} initial={timeAgo(checked)} />
          </>
        )}
      </p>

      {/* The filters: links, not scripts. Each row hides what has nothing listed. */}
      <div className="mt-4 space-y-2" data-facets="">
        <nav aria-label="Sport" className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">Sport</span>
          <ul className="scroller gap-2">
            <li>
              <Link href={brand ? brandHref(r.region, brand) : `/${r.region}/sport`} prefetch={false} className={`${chip} ${!sport ? "chip-on" : ""}`} aria-current={!sport ? "page" : undefined}>
                All sports
              </Link>
            </li>
            {SPORT_ORDER.filter((s) => otherSports.has(s.key)).map((s) => (
              <li key={s.key}>
                <Link href={sportChipHref(s.key)} prefetch={false} className={`${chip} ${s.key === sport ? "chip-on" : ""}`} aria-current={s.key === sport ? "page" : undefined}>
                  {s.nav} <span className="tabular text-xs opacity-70">{otherSports.get(s.key)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Brand" className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">Brand</span>
          <ul className="scroller gap-2">
            <li>
              <Link href={sport ? sportHref(r.region, sport) : `/${r.region}/brand`} prefetch={false} className={`${chip} ${!brand ? "chip-on" : ""}`} aria-current={!brand ? "page" : undefined}>
                All brands
              </Link>
            </li>
            {BRANDS.filter((b) => otherBrands.has(b.slug)).map((b) => (
              <li key={b.slug}>
                <Link href={brandChipHref(b)} prefetch={false} className={`${chip} ${b.slug === brand?.slug ? "chip-on" : ""}`} aria-current={b.slug === brand?.slug ? "page" : undefined}>
                  {b.label} <span className="tabular text-xs opacity-70">{otherBrands.get(b.slug)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {typesWithStock.length > 1 && (
          <nav aria-label="Product type" className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">Type</span>
            <ul className="scroller gap-2">
              {sections.map(({ t, all }) => (
                <li key={t.slug}>
                  <a href={`#type-${t.slug}`} className={chip}>
                    {t.plural} <span className="tabular text-xs opacity-70">{all.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <p className="pl-16 text-sm">
          <Link href={seeAllHref(r, sSlug, brand)} prefetch={false} className="font-semibold text-brand-strong hover:underline">
            Search, sort and filter all {open.length} in stock →
          </Link>
        </p>
      </div>

      {sections.length === 0 ? (
        <div className="card mt-8 px-6 py-12 text-center text-muted">
          Nothing of {name} is in stock in {r.inName} right now. <Link href={`/${r.region}/sealed`} prefetch={false} className="font-semibold text-brand-strong hover:underline">Browse everything</Link>.
        </div>
      ) : (
        sections.map(({ t, all, shown, soldCount }) => (
          <section key={t.slug} id={`type-${t.slug}`} className="mt-10 scroll-mt-24">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <h2 className="page-h2">
                {name} {t.plural}
              </h2>
              <span className="text-sm text-muted">
                {all.length} in stock, cheapest first{soldCount ? ` · ${soldCount} sold out` : ""}
              </span>
            </div>
            {shown.length > 0 && <ProductGrid products={shown.map((m) => m.card)} region={r.region} eager={0} />}
            {all.length > shown.length && (
              <p className="mt-3 text-sm">
                <Link href={seeAllHref(r, sSlug, brand, t.slug)} prefetch={false} className="font-semibold text-brand-strong hover:underline">
                  See all {all.length} {t.plural.toLowerCase()} →
                </Link>
              </p>
            )}
          </section>
        ))
      )}

      {releases.length > 1 && (
        <section aria-labelledby="facet-releases" className="mt-14">
          <h2 id="facet-releases" className="page-h2">
            {name} by release
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {releases.map((s) => (
              <li key={s.code}>
                <Link href={`/${r.region}/sets/${s.slug}`} prefetch={false} className={chip}>
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sold.length > 0 && (
        <details className="mt-10 text-sm">
          <summary className="min-h-10 cursor-pointer font-semibold text-brand-strong">
            {sold.length} sold out everywhere right now
          </summary>
          <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {sold
              .slice()
              .sort((a, b) => a.card.name.localeCompare(b.card.name))
              .slice(0, 60)
              .map((m) => (
                <li key={m.card.slug} className="min-w-0 truncate border-b border-line/60 py-1">
                  <Link href={`/${r.region}/p/${m.card.slug}`} prefetch={false} className="hover:text-brand hover:underline">
                    {m.card.name}
                  </Link>
                </li>
              ))}
          </ul>
        </details>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
    </div>
  );
}
