// The sport and brand pages' read (lib/facets.ts says what they are): every product the market lists, tagged with its sport and
// maker. ONE scoped read of the card columns, kept per request by React cache(); the pages are CDN-cached for a day
// (next.config.js CDN_PAGES), so it runs about once per region per release.
import { cache } from "react";
import { cardSelect, toCard } from "./data";
import { prisma } from "./db";
import { tagCards, type FacetCard } from "./facets";
import type { Market } from "./regions";

/** Every product of the market with a release, tagged. Thin and sold-out ones included: a hub page lists what exists. */
export const taggedProducts = cache(async (market: Market): Promise<FacetCard[]> => {
  const rows = await prisma.productStat.findMany({ where: { market }, select: cardSelect });
  return tagCards(rows.map(toCard));
});
