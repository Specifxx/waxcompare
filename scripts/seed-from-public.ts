// Loads the committed public data (data/public/*.json) and the eBay call counter (data/state/ebay-calls.json) into the import job's
// own throwaway Postgres (a GitHub Actions service container), so an import starts from yesterday's rows exactly as if the database
// had been kept. SportsCardCompare has NO hosted database (DECISIONS.md 2026-11-07): the committed files are the only copy, the jobs run on
// an empty Postgres that dies with the runner, and nothing in it is private (models.ts PUBLIC_MODELS, plus the call counter).
//
//   DATABASE_URL=postgres://…localhost… npx tsx scripts/seed-from-public.ts
//
// Refuses any host but localhost / 127.0.0.1 / the "postgres" service name: it deletes every row first.
process.env.WAXCOMPARE_SCRIPT = "1";

import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { FILES, META_FILE, publicDataDir, type PublicDataMeta } from "../src/lib/public-data/format";

export const CALLS_FILE = path.join(process.cwd(), "data", "state", "ebay-calls.json");
const CHUNK = 2000;

function assertLocal(url: string | undefined): void {
  let host = "";
  try {
    host = new URL(url ?? "").hostname;
  } catch {
    /* falls through */
  }
  if (!["localhost", "127.0.0.1", "postgres"].includes(host)) throw new Error(`refusing to seed a non-local database (host "${host || "?"}")`);
}

function read<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function insert(model: string, rows: Record<string, unknown>[], create: (data: Record<string, unknown>[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) await create(rows.slice(i, i + CHUNK));
  console.log(`[seed] ${model}: ${rows.length}`);
}

async function main() {
  assertLocal(process.env.DATABASE_URL);
  const dir = publicDataDir();
  const meta = read<PublicDataMeta>(path.join(dir, META_FILE));
  await prisma.$transaction([
    prisma.ebayListing.deleteMany(),
    prisma.offer.deleteMany(),
    prisma.productStat.deleteMany(),
    prisma.storeStat.deleteMany(),
    prisma.product.deleteMany(),
    prisma.ebayCallDay.deleteMany(),
  ]);
  if (meta) {
    const rows = (m: keyof typeof FILES) => read<Record<string, unknown>[]>(path.join(dir, FILES[m])) ?? [];
    await insert("Product", rows("Product"), (d) => prisma.product.createMany({ data: d as never }));
    // Offers carry no lastSeen when it is their store's common one (format.ts): put it back.
    const offers = rows("Offer").map((o) => ({ ...o, lastSeen: o.lastSeen ?? meta.seen[String(o.store)] ?? meta.generatedAt }));
    await insert("Offer", offers, (d) => prisma.offer.createMany({ data: d as never }));
    await insert("ProductStat", rows("ProductStat"), (d) => prisma.productStat.createMany({ data: d as never }));
    await insert("StoreStat", rows("StoreStat"), (d) => prisma.storeStat.createMany({ data: d as never }));
    await insert("EbayListing", rows("EbayListing"), (d) => prisma.ebayListing.createMany({ data: d as never }));
  } else {
    console.log("[seed] no data/public yet: starting empty (the first import).");
  }
  const calls = read<{ day: string; total: number }[]>(CALLS_FILE) ?? [];
  await insert("EbayCallDay", calls.map((c) => ({ day: c.day, total: c.total, updatedAt: new Date() })), (d) => prisma.ebayCallDay.createMany({ data: d as never }));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("[seed] failed:", e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
