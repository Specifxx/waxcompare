import Link from "@/components/Link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { NoPreFooter } from "@/components/Ebay";
import { cardOpen } from "@/lib/compact";
import { BRANDS, brandHref, comboHref, filterTagged, SPORT_ORDER, sportHref, type FacetCard } from "@/lib/facets";
import { plural } from "@/lib/format";
import type { RegionInfo } from "@/lib/regions";
import { facetName } from "./FacetView";

/**
 * /<region>/sport and /<region>/brand: every sport (or every brand) with something listed, as tiles that say how much is in stock,
 * each with its pairs. The header's "Sports" and "Brands" go here; a tile with nothing listed is not drawn.
 */
export function FacetIndex({ r, tagged, kind }: { r: RegionInfo; tagged: FacetCard[]; kind: "sport" | "brand" }) {
  const sports = SPORT_ORDER.map((s) => ({ s, mine: filterTagged(tagged, { sport: s.key }) })).filter((x) => x.mine.length > 0);
  const brands = BRANDS.map((b) => ({ b, mine: filterTagged(tagged, { brand: b }) })).filter((x) => x.mine.length > 0);
  const stock = (m: FacetCard[]) => m.filter((t) => cardOpen(t.card)).length;
  const tile = "card block p-4 transition-shadow hover:shadow-lift";
  const pair = "chip min-h-9 whitespace-nowrap text-sm";
  return (
    <div className="page py-8">
      <NoPreFooter />
      <Breadcrumbs items={[{ href: `/${r.region}`, label: r.name }, { label: kind === "sport" ? "Sports" : "Brands" }]} />
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{kind === "sport" ? "Shop sports card boxes by sport" : "Shop sports card boxes by brand"}</h1>
      <p className="mt-3 max-w-3xl leading-7 text-muted">
        {kind === "sport"
          ? `Pick your sport, then narrow to a brand. Every box, case and pack ${r.adjective} stores list, with what is in stock and the lowest price today.`
          : `Topps, Panini, Upper Deck and the rest, each with the sports it is listed in. Every box, case and pack ${r.adjective} stores list, with what is in stock and the lowest price today.`}
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kind === "sport"
          ? sports.map(({ s, mine }) => (
              <li key={s.key} className="card p-4">
                <Link href={sportHref(r.region, s.key)} prefetch={false} className="block hover:text-brand">
                  <h2 className="font-display text-xl font-extrabold">{s.nav}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {stock(mine)} in stock · {plural(mine.length, "product")}
                  </p>
                </Link>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {BRANDS.filter((b) => filterTagged(mine, { brand: b }).length > 0).map((b) => (
                    <li key={b.slug}>
                      <Link href={comboHref(r.region, s.key, b)} prefetch={false} className={pair}>
                        {b.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))
          : brands.map(({ b, mine }) => (
              <li key={b.slug} className="card p-4">
                <Link href={brandHref(r.region, b)} prefetch={false} className="block hover:text-brand">
                  <h2 className="font-display text-xl font-extrabold">{b.label}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {stock(mine)} in stock · {plural(mine.length, "product")}
                  </p>
                </Link>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {SPORT_ORDER.filter((s) => filterTagged(mine, { sport: s.key }).length > 0).map((s) => (
                    <li key={s.key}>
                      <Link href={comboHref(r.region, s.key, b)} prefetch={false} className={pair}>
                        {facetName(s.key, b)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
      </ul>
    </div>
  );
}
