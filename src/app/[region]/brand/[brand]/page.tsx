import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FacetView } from "@/components/facets/FacetView";
import { taggedProducts } from "@/lib/facet-data";
import { facetMetadata, resolveFacet } from "@/lib/facet-meta";
import { filterTagged } from "@/lib/facets";
import { lastCheckedAt } from "@/lib/data";

// Rendered per request and kept by Vercel's CDN for a day (next.config.js, CDN_PAGES), never ISR, like the type pages.
export const dynamic = "force-dynamic";

type Params = { region: string; brand: string };

export const generateMetadata = ({ params }: { params: Params }): Promise<Metadata> => facetMetadata(params);

export default async function BrandPage({ params }: { params: Params }) {
  const { r, brand } = resolveFacet(params);
  const [tagged, checked] = await Promise.all([taggedProducts(r.market), lastCheckedAt(r.market)]);
  if (!filterTagged(tagged, { brand }).length) notFound();
  return <FacetView r={r} tagged={tagged} brand={brand} checked={checked} />;
}
