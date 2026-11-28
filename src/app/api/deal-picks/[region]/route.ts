import { dealPicksFor } from "@/lib/deal-picks";
import { isRegion } from "@/lib/regions";

// GET /api/deal-picks/<region>: the deals card's products (lib/deal-picks.ts), read by the browser. Rendered per request and kept
// by Vercel's CDN for a day (the data only changes with a release, which empties the CDN), like /api/rails/amazon. The card drops
// an Amazon price over 24 hours old in the browser.
export const dynamic = "force-dynamic";

const CDN = "public, s-maxage=86400, stale-while-revalidate=86400";

export async function GET(_req: Request, { params }: { params: { region: string } }) {
  if (!isRegion(params.region)) return Response.json({ error: "unknown region" }, { status: 404, headers: { "Cache-Control": CDN } });
  const data = await dealPicksFor(params.region).catch(() => ({ region: params.region, picks: [], clock: null }));
  return Response.json(data, { headers: { "Cache-Control": "public, max-age=3600", "CDN-Cache-Control": CDN, "Vercel-CDN-Cache-Control": CDN } });
}
