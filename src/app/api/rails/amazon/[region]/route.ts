import { amazonRail } from "@/lib/amazon-rail";
import { isRegion } from "@/lib/regions";

// GET /api/rails/amazon/<region>: the Amazon side rail's tiles (lib/amazon-rail.ts), read by the browser from 1280px wide. Rendered per
// request and kept by Vercel's CDN for a day (the data only changes with a release, which empties the CDN): one function invocation
// per region per release, never ISR. No price is ever in it. /api/ is disallowed in robots.txt.
export const dynamic = "force-dynamic";

const CDN = "public, s-maxage=86400, stale-while-revalidate=86400";

export async function GET(_req: Request, { params }: { params: { region: string } }) {
  if (!isRegion(params.region)) return Response.json({ error: "unknown region" }, { status: 404, headers: { "Cache-Control": CDN } });
  const rail = await amazonRail(params.region).catch(() => null);
  return Response.json(
    { rail },
    { headers: { "Cache-Control": "public, max-age=3600", "CDN-Cache-Control": CDN, "Vercel-CDN-Cache-Control": CDN } },
  );
}
