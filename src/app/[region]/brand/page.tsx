import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FacetIndex } from "@/components/facets/FacetIndex";
import { taggedProducts } from "@/lib/facet-data";
import { regionOrNotFound } from "@/lib/regions";
import { pageMeta, regionAlternates } from "@/lib/seo";

// Rendered per request and kept by Vercel's CDN for a day (next.config.js, CDN_PAGES), never ISR.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { region: string } }): Promise<Metadata> {
  const r = regionOrNotFound(params.region);
  if (!(await taggedProducts(r.market)).length) notFound();
  return pageMeta({
    title: "Sports card boxes by brand in " + r.inName,
    description: "Every sports card box, case and pack by brand: Topps, Panini, Upper Deck and more, with stock and the lowest price today.",
    path: `/${r.region}/brand`,
    alternates: regionAlternates(r.region, "/brand"),
  });
}

export default async function BrandIndexPage({ params }: { params: { region: string } }) {
  const r = regionOrNotFound(params.region);
  const tagged = await taggedProducts(r.market);
  if (!tagged.length) notFound();
  return <FacetIndex r={r} tagged={tagged} kind="brand" />;
}
