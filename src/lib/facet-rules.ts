// Which sport, brand and pair pages are indexable and listed in the sitemap: ONE rule for the page's robots tag and the sitemap.
import { countBy, countBySport, countByBrand, isComparableCard, type FacetCard } from "./facets";
import { MIN_HUB_PRODUCTS } from "./index-tiers";

/**
 * The pages the sitemap lists for a market: sports, brands and pairs with MIN_HUB_PRODUCTS or more COMPARABLE products (something
 * to buy or compare). The page's own noindex rule is the same test (`facetIndexable`), so the sitemap never lists a noindex URL.
 */
export function facetSitemapKeys(all: readonly FacetCard[]): { sports: string[]; brands: string[]; combos: string[] } {
  const tagged = all.filter((t) => isComparableCard(t.card));
  const enough = (m: Map<string, number>) => [...m].filter(([, n]) => n >= MIN_HUB_PRODUCTS).map(([k]) => k);
  return {
    sports: enough(countBySport(tagged)),
    brands: enough(countByBrand(tagged)),
    combos: enough(countBy(tagged, (t) => `${t.sport}/${t.brand.slug}`)),
  };
}

/** Indexable only with enough comparable products (a page with two rows of the same stores is what Search Console calls thin). */
export const facetIndexable = (tagged: readonly FacetCard[]): boolean => tagged.filter((t) => isComparableCard(t.card)).length >= MIN_HUB_PRODUCTS;

