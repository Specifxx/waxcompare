// The chart share cards (2026-11-09, owner: "graphical, with charts", like DexCompare's): a navy card with white stat tiles over a
// chart drawn from the page's own real prices. statsCard is a product's (one bar per in-stock store, cheapest to dearest, the median
// dashed); listingCard is a home, region, product-type or set page's (one row per product: how far its cheapest in-stock price sits
// below the median store price). Real prices only, never eBay or TCGplayer, never converted; no photos, so the PNG stays small.
// Sports-card look, original: navy field, red and gold accents, no maker or league marks.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { LOGO_MARK, OG_SIZE } from "@/lib/og-card";
import type { ProductCardData } from "@/lib/data";

const NAVY = "#0b1a3d";
const INK = "#15171c";
const MUTED = "#5c606c";
const BRAND = "#b8162e";
const LINE = "#dfe3ee";
const GREEN = "#147638";
const GOLD = "#f2b01e";

const font = (file: string) => readFileSync(join(process.cwd(), "src/app/fonts", file));
const FONTS = () => [
  { name: "Bricolage", data: font("BricolageGrotesque-ExtraBold.ttf"), weight: 800 as const, style: "normal" as const },
  { name: "Bricolage", data: font("BricolageGrotesque-SemiBold.ttf"), weight: 600 as const, style: "normal" as const },
];

export const STATS_MIN_STORES = 6;

type Tile = [label: string, value: string, color: string];

function Head({ tag }: { tag: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_MARK} width={44} height={44} alt="SportsCardCompare logo" />
      <div style={{ display: "flex", fontSize: 32, fontWeight: 800, letterSpacing: -1, color: "#ffffff" }}>
        SportsCard<span style={{ color: GOLD }}>Compare</span>
      </div>
      <div style={{ display: "flex", marginLeft: 6, padding: "3px 12px", borderRadius: 999, background: BRAND, color: "#ffffff", fontSize: 20, fontWeight: 600 }}>{tag}</div>
    </div>
  );
}

function Tiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div style={{ display: "flex", gap: 14, marginTop: 16 }}>
      {tiles.map(([label, value, color]) => (
        <div key={label} style={{ display: "flex", flexDirection: "column", flex: 1, padding: "10px 16px", borderRadius: 14, background: "#ffffff", borderBottom: `5px solid ${color}` }}>
          <div style={{ display: "flex", fontSize: 15, fontWeight: 600, color: MUTED, letterSpacing: 1 }}>{label}</div>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 800, color, letterSpacing: -1 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
  <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: NAVY, padding: "36px 48px", fontFamily: "Bricolage", color: "#ffffff" }}>{children}</div>
  );
}

function mix(t: number): string {
  const a = t < 0.5 ? [20, 118, 56] : [242, 176, 30];
  const b = t < 0.5 ? [242, 176, 30] : [214, 48, 60];
  const k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`;
}

export interface StatsCard {
  tag: string;
  name: string;
  /** In-stock store prices in cents, any order. */
  prices: number[];
  fmt: (cents: number) => string;
  sub: string;
}

export function statsCard({ tag, name, prices, fmt, sub }: StatsCard): ImageResponse {
  const s = [...prices].sort((x, y) => x - y);
  const n = s.length;
  const lo = s[0];
  const hi = s[n - 1];
  const med = n % 2 ? s[(n - 1) / 2] : Math.round((s[n / 2 - 1] + s[n / 2]) / 2);
  const H = 268;
  const top = hi * 1.05;
  const medY = Math.round((med / top) * H);
  const tiles: Tile[] = [
    ["CHEAPEST", fmt(lo), GREEN],
    ["MEDIAN", fmt(med), NAVY],
    ["DEAREST", fmt(hi), BRAND],
    ["DEAREST VS CHEAPEST", `${(hi / lo).toFixed(1)}x`, GOLD],
  ];
  const title = name.length > 56 ? `${name.slice(0, 54)}…` : name;
  return new ImageResponse(
    <Frame>
        <Head tag={tag} />
        <div style={{ display: "flex", fontSize: title.length > 40 ? 38 : 46, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05, marginTop: 14 }}>{title}</div>
        <Tiles tiles={tiles} />
        <div style={{ display: "flex", position: "relative", alignItems: "flex-end", gap: 3, height: H, marginTop: 18, borderBottom: "2px solid #4b5f96" }}>
          <div style={{ display: "flex", position: "absolute", left: 0, right: 0, bottom: medY, borderTop: "2px dashed #ffffff" }} />
          {s.map((p, i) => (
            <div key={i} style={{ display: "flex", flex: 1, height: Math.max(4, Math.round((p / top) * H)), borderRadius: "3px 3px 0 0", background: mix(n > 1 ? i / (n - 1) : 0) }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 21, fontWeight: 600, color: "#c3cce6" }}>
          <div style={{ display: "flex" }}>{`${n} stores, cheapest to dearest · dashed line is the median`}</div>
          <div style={{ display: "flex" }}>{sub}</div>
        </div>
    </Frame>,
    { ...OG_SIZE, fonts: FONTS() },
  );
}

export interface ListingRow {
  name: string;
  low: number;
  median: number;
}

export interface ListingChart {
  rows: ListingRow[];
  /** Products listed, products in stock, typical saving %, best saving %. */
  products: number;
  inStock: number;
  typical: number;
  best: number;
}

/** Rows and tiles from a page's own product cards: the products with 3+ in-stock stores and a real median above their cheapest. */
export function listingChart(cards: ProductCardData[], max = 6): ListingChart | null {
  const gaps = cards
    .filter((c) => c.inStockStores >= 3 && c.lowestPriceCents && c.medianOpenCents && c.medianOpenCents > c.lowestPriceCents)
    .map((c) => ({ name: c.name, low: c.lowestPriceCents!, median: c.medianOpenCents!, pct: Math.round((1 - c.lowestPriceCents! / c.medianOpenCents!) * 100) }))
    .filter((g) => g.pct >= 1 && g.pct <= 60); // a gap past 60% is more likely a bad match than a bargain: never charted
  if (gaps.length < 3) return null;
  const pcts = gaps.map((g) => g.pct).sort((a, b) => a - b);
  const typical = pcts[Math.floor(pcts.length / 2)];
  // The biggest real gaps among the products most stores stock: a mix, never only the outliers.
  const rows = [...gaps].sort((a, b) => b.pct - a.pct).slice(0, max);
  return {
    rows: rows.map(({ name, low, median }) => ({ name, low, median })),
    products: cards.length,
    inStock: cards.filter((c) => c.inStockStores > 0).length,
    typical,
    best: pcts[pcts.length - 1],
  };
}

export interface ListingCard {
  tag: string;
  title: string;
  chart: ListingChart;
  fmt: (cents: number) => string;
  sub: string;
  /** Replaces the "in stock" tile (the region home's store count). */
  storesTile?: string;
}

export function listingCard({ tag, title, chart, fmt, sub, storesTile }: ListingCard): ImageResponse {
  const tiles: Tile[] = [
    ["PRODUCTS COMPARED", String(chart.products), NAVY],
    storesTile ? ["STORES READ DAILY", storesTile, NAVY] : ["IN STOCK NOW", String(chart.inStock), GREEN],
    ["TYPICAL SAVING", `${chart.typical}%`, GREEN],
    ["BEST SAVING", `${chart.best}%`, BRAND],
  ];
  const t = title.length > 52 ? `${title.slice(0, 50)}…` : title;
  return new ImageResponse(
    <Frame>
        <Head tag={tag} />
        <div style={{ display: "flex", fontSize: t.length > 36 ? 40 : 48, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05, marginTop: 14 }}>{t}</div>
        <Tiles tiles={tiles} />
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 18 }}>
          {chart.rows.map((r) => {
            const pct = Math.round((1 - r.low / r.median) * 100);
            const nm = r.name.length > 36 ? `${r.name.slice(0, 34).trimEnd()}…` : r.name;
            return (
              <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 14, height: 34 }}>
                <div style={{ display: "flex", width: 450, fontSize: 21, fontWeight: 600, color: "#e6ebf8" }}>{nm}</div>
                <div style={{ display: "flex", flex: 1, height: 22, borderRadius: 11, background: "#27407f" }}>
                  <div style={{ display: "flex", width: `${Math.max(8, Math.round((r.low / r.median) * 100))}%`, height: 22, borderRadius: 11, background: GREEN }} />
                </div>
                <div style={{ display: "flex", width: 190, justifyContent: "flex-end", fontSize: 22, fontWeight: 800 }}>{`${fmt(r.low)}  `}<span style={{ color: GOLD, marginLeft: 8 }}>{`-${pct}%`}</span></div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", fontSize: 20, fontWeight: 600, color: "#c3cce6" }}>
          <div style={{ display: "flex" }}>Green bar: cheapest in-stock price against the median store price</div>
          <div style={{ display: "flex" }}>{sub}</div>
        </div>
    </Frame>,
    { ...OG_SIZE, fonts: FONTS() },
  );
}
