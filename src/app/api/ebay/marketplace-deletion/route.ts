// eBay Marketplace Account Deletion endpoint, required for SportsCardCompare's own production Browse API keyset (ported from
// FigureCompare). SportsCardCompare stores no eBay user data (only listing prices, titles and photos), so a notification needs no
// action: it is acknowledged. Runs only when eBay calls it; no page uses it. Keep it deployed while the keyset exists.
import { createHash } from "node:crypto";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const ENDPOINT = `${SITE_URL}/api/ebay/marketplace-deletion`;

export function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("challenge_code");
  const token = process.env.EBAY_VERIFICATION_TOKEN;
  if (!code || !token) return new Response("Not configured", { status: 400 });
  const challengeResponse = createHash("sha256").update(code + token + ENDPOINT).digest("hex");
  return Response.json({ challengeResponse }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  await req.text().catch(() => "");
  return new Response(null, { status: 200 });
}
