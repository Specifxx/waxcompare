import Link from "@/components/Link";
import type { Metadata } from "next";
import { SinglesNote } from "@/components/seo/SinglesNote";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { guidesFor } from "@/content/guides";
import { COUNTRY_GUIDE } from "@/content/guides/country-prices";
import { GuideCard, guideHref } from "@/content/guides/kit";
import { POSTS, postPath } from "@/lib/blog";
import { SETS } from "@/lib/sets";
import { regionOrNotFound } from "@/lib/regions";
import { jsonLd, pageMeta, regionAlternates } from "@/lib/seo";
import { fitDescription, seoCopy, seoTitleText } from "@/lib/seo-titles";
import { SITE_URL } from "@/lib/site";

// The guides index: the region's guides as cards. Built from the registry alone: no database read.
// Rendered per request and kept by Vercel's CDN for a day (next.config.js, CDN_PAGES), never ISR: an ISR write
// costs about twenty renders, and the data only changes with a release, which empties the CDN anyway.
export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { region: string } }): Metadata {
  const r = regionOrNotFound(params.region);
  return pageMeta({
    title: seoTitleText(seoCopy.guidesTitle(r)),
    description: seoCopy.guidesDescription(r),
    path: `/${r.region}/guides`,
    alternates: regionAlternates(r.region, "/guides"),
  });
}

export default function GuidesIndex({ params }: { params: { region: string } }) {
  const r = regionOrNotFound(params.region);
  const list = guidesFor(r.region);
  const today = new Date().toISOString().slice(0, 10);
  const sets = SETS.filter((x) => x.releaseDate <= today).slice(0, 6);
  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Sealed sports card buying guides (${r.name})`,
    itemListElement: list.map((g, i) => ({ "@type": "ListItem", position: i + 1, name: g.title, url: `${SITE_URL}${guideHref(r, g.slug)}` })),
  };
  return (
    <div className="page py-8">
      <Breadcrumbs items={[{ href: `/${r.region}`, label: r.name }, { label: "Guides" }]} />
      <header className="max-w-3xl">
        <div className="eyebrow">Guides</div>
        <h1 className="mt-2 page-h1">Sports card hobby box &amp; blaster price guides</h1>
        <p className="mt-3 text-lg leading-8 text-muted">
          Plain-English answers to what people ask before they buy sealed sports cards in {r.inName}, with prices from today’s listings at the card shops we
          compare.
        </p>
      </header>

      <ul role="list" className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((g) => (
          <li key={g.slug}>
            <GuideCard r={r} guide={g} />
          </li>
        ))}
        {/* The one guide that compares every market: the same page from every region's index. */}
        <li>
          <Link href={COUNTRY_GUIDE.path} prefetch={false} className="card group flex h-full flex-col p-5 transition-shadow hover:shadow-lift sm:p-6">
            <span className="eyebrow">{COUNTRY_GUIDE.kicker}</span>
            <h2 className="mt-2 font-display text-xl font-bold leading-snug tracking-tight group-hover:text-brand">{COUNTRY_GUIDE.h1}</h2>
            <p className="mt-2 flex-1 text-[15px] leading-6 text-muted">{COUNTRY_GUIDE.description}</p>
            <span className="mt-4 flex items-center justify-end gap-1 text-xs font-semibold text-brand">Compare every market →</span>
          </Link>
        </li>
      </ul>

      <SinglesNote r={r} className="mt-14" />

      <div className="mt-14 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="from-blog">
          <h2 id="from-blog" className="page-h2">
            From the blog
          </h2>
          <ul role="list" className="mt-4 flex flex-wrap gap-2">
            {POSTS.slice(0, 6).map((p) => (
              <li key={p.slug}>
                <Link href={postPath(p.slug)} prefetch={false} className="chip min-h-10">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="by-set">
          <h2 id="by-set" className="page-h2">
            Newest sets
          </h2>
          <ul role="list" className="mt-4 flex flex-wrap gap-2">
            {sets.map((s) => (
              <li key={s.code}>
                <Link href={`/${r.region}/sets/${s.slug}`} prefetch={false} className="chip min-h-10">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
    </div>
  );
}
