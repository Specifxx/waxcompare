import { PrismaClient } from "@prisma/client";
import { routeQuery } from "./public-data/route";

// ─── WHERE THE DATA LIVES ─────────────────────────────────────────────────────────
// Every public table is exported to data/public/ after each import and committed to main (scripts/export-public-data.ts), and
// the site reads THOSE FILES (src/lib/public-data/, PUBLIC_DATA_MODE "files", the default): no page, route or build touches a
// database. WaxCompare has no hosted database (DECISIONS.md 2026-11-07): the importers (scripts set WAXCOMPARE_SCRIPT=1) run on a
// throwaway Postgres inside the GitHub runner, seeded from the committed files. A read the file engine cannot answer exactly falls
// through to the database and logs [public-data:unsupported] once, which tests/public-data.test.ts keeps at zero for the loaders.
//
// The tables live in their own Postgres schema, "sealed" (inherited from MTG Compare, where it kept them apart from an older
// site's): databaseUrl() adds it for any caller, so every script sees the same tables.
export const DB_SCHEMA = "sealed";
export function databaseUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  const url = env.SEALED_DATABASE_URL?.trim() || env.DATABASE_URL?.trim() || undefined;
  return url ? withSchema(url) : undefined;
}

/** The URL with `schema=sealed` added, unless it already names a schema. */
export function withSchema(url: string): string {
  if (/[?&]schema=/.test(url)) return url;
  // schema= is Prisma's (its model queries); search_path is Postgres's, which raw SQL ($queryRaw) needs.
  return `${url}${url.includes("?") ? "&" : "?"}schema=${DB_SCHEMA}&options=-c%20search_path%3D${DB_SCHEMA}`;
}

// ─── DATA-EGRESS RULES (read before adding a query) ────────────────────────────
// (Inherited from MTG Compare, which ran on Neon: its free tier allows 5 GB/month of transfer. MTG Compare
// killed two databases by breaking it, and Rift Compare a dozen more.) They still bound any database read,
// so these are the rules this codebase starts from (src/lib/db.ts in Rift):
//
//   1. A query on the request path is scoped to one entity or one page of rows —
//      never a whole table. The listing pages read ProductStat (precomputed by
//      the importer), not an aggregate over Offer.
//   2. `select` only the columns you render, and `take` a cap wherever the row
//      count isn't bounded by the entity.
//   3. Whole-table reads belong in scripts/import.ts, never in a page.
//   4. Pages are ISR-cached (`export const revalidate`, generateStaticParams
//      returning []) and re-rendered after each import via /api/revalidate. The
//      TTL is 86400 and never under 21600 (6 h: the owner, 2026-10-14; pinned by
//      tests/cache-ttl.test.ts): the import is what refreshes prices. No
//      unstable_cache anywhere: its TTL leaks to the whole route segment, and a
//      short one silently re-runs every query on the page.
//   5. The eBay strips read the EbayListing table through /api/ebay/<region> (src/lib/ebay-read.ts): ONE indexed
//      query, at most 8 rows of the first feed of a cascade that has enough fresh rows (never a scan of the table),
//      CDN-cached for 5 minutes. The importer (scripts/ebay-import.ts) is the only thing that writes it.
//
// The guard below makes a violation visible: any single query returning a big
// payload logs to the Vercel function log instead of quietly burning allowance.
// ────────────────────────────────────────────────────────────────────────────────
const BIG_ROWS = 300;
const BIG_BYTES = 500_000;

// Neon suspends idle computes; a generous connect_timeout rides out the resume
// instead of failing the first request after a quiet spell with P1001.
function withConnectTimeout(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "15");
    return u.toString();
  } catch {
    return url;
  }
}

function makeClient() {
  const base = new PrismaClient({
    datasourceUrl: withConnectTimeout(databaseUrl()),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const res = await routeQuery(model, operation, args, query as (a: unknown) => Promise<unknown>);
          if (process.env.WAXCOMPARE_SCRIPT !== "1" && Array.isArray(res) && res.length >= BIG_ROWS) {
            try {
              const bytes = JSON.stringify(res).length;
              if (bytes >= BIG_BYTES) {
                console.warn(
                  `[egress-guard] ${model}.${operation} returned ~${(bytes / 1e6).toFixed(1)} MB (${res.length} rows) ` +
                    `on a request path. Scope it or move it into the importer — see src/lib/db.ts.`,
                );
              }
            } catch {
              /* sizing is best-effort */
            }
          }
          return res;
        },
      },
    },
  });
}

type Client = ReturnType<typeof makeClient>;
const g = globalThis as unknown as { prisma?: Client };
export const prisma = g.prisma ?? makeClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
