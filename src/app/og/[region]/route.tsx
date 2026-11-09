import { ogCard } from "@/lib/og-card";
import { listingCard, listingChart } from "@/lib/og-chart";
import { marketProducts } from "@/lib/data";
import { money } from "@/lib/format";
import { regionOrNotFound } from "@/lib/regions";
import { storesInMarket } from "@/lib/stores";

// /og/<region>: the region home's share card (its og:image, seo.ts regionOgImage), the one a link to /au or /us shows on Reddit,
// Discord or X. Drawn per request and kept by the CDN for a day (never at build: no database read, vercel-ignore-build test): the chart of the region's real savings from the public data files (lib/og-chart.tsx), else the plain card.
export const dynamic = "force-dynamic";

const CDN = "public, s-maxage=86400, stale-while-revalidate=86400";

export async function GET(_req: Request, { params }: { params: { region: string } }) {
  const r = regionOrNotFound(params.region);
  const n = storesInMarket(r.market).length;
  const chart = listingChart(await marketProducts(r.market).catch(() => []), 6);
  const res = chart ? listingCard({ tag: r.name, title: `Sports card boxes across ${n} stores`, chart, fmt: (c) => money(c, r.market), sub: "In stock, checked daily", storesTile: String(n) })
    : ogCard({
    tag: r.name,
    lines: [
      ["Sports card boxes,", false],
      ["cheapest first, across", false],
      [`${n} ${r.adjective} stores`, true],
    ],
    size: r.adjective.length > 10 ? 54 : 60,
    sub: "Hobby, mega and blaster boxes · live stock",
    chips: [`Prices in ${r.currency}`, "Free", "No sign-up"],
  });
  res.headers.set("Cache-Control", "public, max-age=3600");
  res.headers.set("CDN-Cache-Control", CDN);
  res.headers.set("Vercel-CDN-Cache-Control", CDN);
  return res;
}
