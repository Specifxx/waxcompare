// The blog: dated posts at /blog/<slug>, region-less (one canonical URL), each built from the stores' live listings in every market
// we compare. This file is the registry. It is pure (no database, no React), so the sitemap, the OG route, next.config.js's tests
// and tests/guides.test.ts read it as it stands.
//
// The writing rules are the guides' (src/content/guides/index.ts): only facts we are sure of, with their source; live numbers say
// "today"; no currency conversion; nothing may match BANNED_COPY; no pull rates, EV, investment or trend claims.

export type PostSlug = "cheapest-sports-card-boxes" | "most-expensive-sports-card-boxes";

export interface Post {
  slug: PostSlug;
  title: string;
  description: string;
  kicker: string;
  /** First published and last substantively edited. */
  published: string;
  updated: string;
}

const D = "2026-11-07";

/** Newest first. */
export const POSTS: readonly Post[] = [
  {
    slug: "cheapest-sports-card-boxes",
    title: "The cheapest sealed sports card boxes in stock",
    description: "The cheapest sealed hobby, jumbo and retail sports card boxes in stock today, market by market, at each card shop's own price.",
    kicker: "Box prices",
    published: D,
    updated: D,
  },
  {
    slug: "most-expensive-sports-card-boxes",
    title: "The most expensive sports card boxes in stock",
    description: "The dearest sealed sports card boxes in stock today in each market we compare, at each one's cheapest card shop price.",
    kicker: "Box prices",
    published: D,
    updated: D,
  },
];

export const POST_BY_SLUG: ReadonlyMap<string, Post> = new Map(
  POSTS.map((p) => [p.slug, p]),
);
export const postPath = (slug: string) => `/blog/${slug}`;

/** The <title>: the template adds " | WaxCompare" when the whole still fits in 60; otherwise the title alone. */
export function postMetaTitle(title: string): string | { absolute: string } {
  return title.length + " | WaxCompare".length <= 60
    ? title
    : { absolute: title };
}
