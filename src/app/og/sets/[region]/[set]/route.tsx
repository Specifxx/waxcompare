import { ogCard } from "@/lib/og-card";
import { listingCard, listingChart } from "@/lib/og-chart";
import { productsBySet } from "@/lib/data";
import { money } from "@/lib/format";
import { isRegion, REGIONS } from "@/lib/regions";
import { SET_BY_SLUG } from "@/lib/sets";

// /og/sets/<region>/<set>: a set's share card (og:image of /<region>/sets/<set>): the chart of its products' real savings
// (lib/og-chart.tsx). Drawn per request and kept by the CDN for a day, like the page. Too few priced products, or an unknown
// set, draws the site's plain card.
export const dynamic = "force-dynamic";

const CDN = "public, s-maxage=86400, stale-while-revalidate=86400";

export async function GET(_req: Request, { params }: { params: { region: string; set: string } }) {
  const r = isRegion(params.region) ? REGIONS[params.region] : null;
  const s = SET_BY_SLUG.get(params.set);
  const chart = r && s ? listingChart(await productsBySet(r.market, s.code).catch(() => [])) : null;
  const res =
    r && s && chart
      ? listingCard({ tag: r.name, title: s.name, chart, fmt: (c) => money(c, r.market), sub: "In stock, checked daily" })
      : ogCard({ lines: [["Compare sports card", false], ["sealed prices", true]], sub: "Hobby, mega and blaster boxes, cheapest first", chips: [] });
  res.headers.set("Cache-Control", "public, max-age=3600");
  res.headers.set("CDN-Cache-Control", CDN);
  res.headers.set("Vercel-CDN-Cache-Control", CDN);
  return res;
}
