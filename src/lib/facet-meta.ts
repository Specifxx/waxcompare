// The sport, brand and sport-and-brand pages' metadata and 404 rule, one place for the three routes.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { taggedProducts } from "./facet-data";
import { facetIndexable } from "./facet-rules";
import { BRAND_BY_SLUG, brandHref, comboHref, filterTagged, sportHref, sportNavLabel, sportOfSlug, type Brand } from "./facets";
import type { Sport } from "./lines";
import { cardOpen } from "./compact";
import { money } from "./format";
import { REGION_LIST, regionOrNotFound, type RegionInfo } from "./regions";
import { pageMeta, regionAlternates } from "./seo";
import { facetName } from "@/components/facets/FacetView";

export interface FacetParams {
  region: string;
  sport?: string;
  brand?: string;
}

/** The page's region, sport and brand from its URL segments, or a 404 for an unknown one (a sport or brand slug the site does not have). */
export function resolveFacet(p: FacetParams): { r: RegionInfo; sport?: Sport; brand?: Brand } {
  const r = regionOrNotFound(p.region);
  const sport = p.sport ? sportOfSlug(p.sport) ?? notFound() : undefined;
  const brand = p.brand ? BRAND_BY_SLUG.get(p.brand) ?? notFound() : undefined;
  return { r, sport, brand };
}

/** Metadata for a facet page; a market with nothing under this sport and brand is a real 404 (never an empty 200). */
export async function facetMetadata(p: FacetParams): Promise<Metadata> {
  const { r, sport, brand } = resolveFacet(p);
  const tagged = await taggedProducts(r.market);
  const mine = filterTagged(tagged, { sport, brand });
  if (!mine.length) notFound();
  const open = mine.filter((t) => cardOpen(t.card));
  const from = open.reduce<number | null>((m, t) => (t.card.lowestPriceCents != null && (m == null || t.card.lowestPriceCents < m) ? t.card.lowestPriceCents : m), null);
  const name = facetName(sport, brand);
  const path = sport ? (brand ? comboHref(r.region, sport, brand) : sportHref(r.region, sport)) : brandHref(r.region, brand!);
  const rest = path.slice(r.region.length + 1);
  const indexable = facetIndexable(mine);
  // hreflang only to the regions that have the page (the others would be 404s).
  const has = await Promise.all(REGION_LIST.map(async (x) => ((filterTagged(await taggedProducts(x.market), { sport, brand }).length > 0) ? x : null)));
  return pageMeta({
    title: `${name} card boxes in ${r.inName}`,
    description: `${open.length} ${name} boxes, cases and packs in stock at ${r.adjective} stores${from != null ? `, from ${money(from, r.market)}` : ""}. Hobby, jumbo, mega and blaster compared by price and stock.`.slice(0, 158),
    path,
    alternates: indexable ? regionAlternates(r.region, rest, has.filter((x): x is RegionInfo => !!x)) : undefined,
    noindex: !indexable,
  });
}
