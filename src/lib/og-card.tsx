// The site's 1200×630 share card, drawn with next/og: the root card (app/opengraph-image.tsx), each region home's (app/og/[region])
// and each guide's (app/og/guides/[slug]). Static, rendered once at build: no database, no remote fetch (no emoji flags, no remote
// logos). Its text is the brand's display face, bundled in src/app/fonts (Bricolage Grotesque, SIL OFL 1.1, static instances: satori
// cannot read a variable font, and next/og's own font is a regular-weight Noto that would draw every heading thin).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

const INK = "#15171c";
const MUTED = "#5c606c";
const BRAND = "#b8162e";
const LINE = "#e4e3de";
const OPEN = "#147638";
const OPEN_SOFT = "#e2f5e8";

const font = (file: string) => readFileSync(join(process.cwd(), "src/app/fonts", file));

/** One comparison row of the card on the right: a store, its stock, its price, drawn as shapes (no invented names or prices). */
function Row({ best = false, store, price }: { best?: boolean; store: number; price: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "18px 20px",
        borderRadius: 16,
        background: best ? "#fdece7" : "#ffffff",
        border: `2px solid ${best ? BRAND : LINE}`,
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: best ? BRAND : "#efeee9", display: "flex", flexShrink: 0 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flexGrow: 1, minWidth: 0 }}>
        <div style={{ width: store, height: 14, borderRadius: 7, background: best ? INK : "#c9c8c2", display: "flex" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: 999, background: OPEN_SOFT, color: OPEN, fontSize: 16, alignSelf: "flex-start" }}>
          <div style={{ width: 7, height: 7, borderRadius: 7, background: OPEN, display: "flex" }} />
          In stock
        </div>
      </div>
      <div style={{ width: price, height: 22, borderRadius: 8, background: best ? INK : "#c9c8c2", display: "flex", flexShrink: 0 }} />
    </div>
  );
}

export interface OgCard {
  /** The headline, one entry per line; `true` draws that line in the brand's red. */
  lines: [string, boolean][];
  /** The line under the headline. */
  sub: string;
  /** Small pills along the bottom (region codes, a region's currency…). */
  chips: string[];
  /** A small label beside the logo ("Guide", "Australia"). */
  tag?: string;
  /** Headline size: 64 for four short lines, smaller for a long guide title. */
  size?: number;
}

/** The card as a PNG response. */
export function ogCard({ lines, sub, chips, tag, size = 64 }: OgCard): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f6f6f3",
          backgroundImage: "radial-gradient(circle at 0% 0%, rgba(210,48,10,0.14), rgba(210,48,10,0) 45%), radial-gradient(circle at 100% 0%, rgba(255,203,5,0.22), rgba(255,203,5,0) 40%)",
          padding: 64,
          fontFamily: "Bricolage",
          color: INK,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 650 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img width={64} height={64} alt="SportsCardCompare logo" src={LOGO_MARK} />
            <div style={{ display: "flex", fontSize: 42, fontWeight: 800, letterSpacing: -1 }}>
              SportsCard<span style={{ color: BRAND }}>Compare</span>
            </div>
            {tag && (
              <div style={{ display: "flex", marginLeft: 8, padding: "4px 14px", borderRadius: 999, background: INK, color: "#ffffff", fontSize: 22, fontWeight: 600 }}>{tag}</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: size, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2 }}>
            {lines.map(([text, accent]) => (
              <div key={text} style={{ display: "flex", color: accent ? BRAND : INK }}>
                {text}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", fontSize: 27, fontWeight: 600, color: MUTED }}>{sub}</div>
            <div style={{ display: "flex", gap: 10 }}>
              {chips.map((c) => (
                <div key={c} style={{ display: "flex", padding: "6px 16px", borderRadius: 999, border: `2px solid ${LINE}`, background: "#ffffff", fontSize: 22, fontWeight: 600, color: INK }}>
                  {c}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", marginLeft: "auto", width: 380 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              padding: 22,
              borderRadius: 28,
              background: "#ffffff",
              border: `2px solid ${LINE}`,
              boxShadow: "0 24px 60px -20px rgba(24,22,18,0.28)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 4px" }}>
              <div style={{ display: "flex", fontSize: 22, fontWeight: 800 }}>Cheapest first</div>
              <div style={{ display: "flex", padding: "4px 12px", borderRadius: 999, background: BRAND, color: "#ffffff", fontSize: 16, fontWeight: 600 }}>Best price</div>
            </div>
            <Row best store={118} price={78} />
            <Row store={92} price={84} />
            <Row store={128} price={88} />
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Bricolage", data: font("BricolageGrotesque-ExtraBold.ttf"), weight: 800, style: "normal" },
        { name: "Bricolage", data: font("BricolageGrotesque-SemiBold.ttf"), weight: 600, style: "normal" },
      ],
    },
  );
}

/** Words wrapped into lines of at most `max` characters (a share card's headline). */
export function wrapWords(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    if (line && (line + " " + w).length > max) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}

/** The logo mark (public/logo.svg), drawn by satori as an image. */
const LOGO_MARK = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDY0IDY0Ij4KICA8cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHJ4PSIxNCIgZmlsbD0iIzFkNGZkOCIvPgogIDxnIHRyYW5zZm9ybT0icm90YXRlKC0yNCAzMiA1OCkiPgogICAgPHJlY3QgeD0iMjAiIHk9IjEyIiB3aWR0aD0iMjQiIGhlaWdodD0iMzYiIHJ4PSIzIiBmaWxsPSIjZmZmIiBzdHJva2U9IiMwYjFhM2QiIHN0cm9rZS13aWR0aD0iMSIvPgogICAgPHJlY3QgeD0iMjIuNSIgeT0iMTQuNSIgd2lkdGg9IjE5IiBoZWlnaHQ9IjI0IiByeD0iMS41IiBmaWxsPSIjMGY3YTNmIi8+CiAgICA8ZWxsaXBzZSBjeD0iMjgiIGN5PSIyMSIgcng9IjUiIHJ5PSIzLjIiIGZpbGw9IiM4YjRhMWMiIHRyYW5zZm9ybT0icm90YXRlKC0zMCAyOCAyMSkiLz4KICAgIDxwYXRoIGQ9Ik0yNS42IDIxLjhsNC42LTIuNiIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjEiLz4KICA8L2c+CiAgPGcgdHJhbnNmb3JtPSJyb3RhdGUoMjQgMzIgNTgpIj4KICAgIDxyZWN0IHg9IjIwIiB5PSIxMiIgd2lkdGg9IjI0IiBoZWlnaHQ9IjM2IiByeD0iMyIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjMGIxYTNkIiBzdHJva2Utd2lkdGg9IjEiLz4KICAgIDxyZWN0IHg9IjIyLjUiIHk9IjE0LjUiIHdpZHRoPSIxOSIgaGVpZ2h0PSIyNCIgcng9IjEuNSIgZmlsbD0iI2ZmN2ExYSIvPgogICAgPGNpcmNsZSBjeD0iMzYiIGN5PSIyMSIgcj0iNC42IiBmaWxsPSIjZmZiMDY2IiBzdHJva2U9IiM3YTMzMDAiIHN0cm9rZS13aWR0aD0iMSIvPgogICAgPHBhdGggZD0iTTMxLjQgMjFoOS4yTTM2IDE2LjR2OS4yIiBzdHJva2U9IiM3YTMzMDAiIHN0cm9rZS13aWR0aD0iMSIvPgogIDwvZz4KICA8Zz4KICAgIDxyZWN0IHg9IjIwIiB5PSI5IiB3aWR0aD0iMjQiIGhlaWdodD0iMzgiIHJ4PSIzIiBmaWxsPSIjZmZmIiBzdHJva2U9IiMwYjFhM2QiIHN0cm9rZS13aWR0aD0iMS4yIi8+CiAgICA8cmVjdCB4PSIyMi41IiB5PSIxMS41IiB3aWR0aD0iMTkiIGhlaWdodD0iMjYiIHJ4PSIxLjUiIGZpbGw9IiNkMTE5MmYiLz4KICAgIDxnIGZpbGw9IiNmZmYiPgogICAgICA8Y2lyY2xlIGN4PSIzMSIgY3k9IjE3IiByPSIyLjkiLz4KICAgICAgPHBhdGggZD0iTTI4LjMgMjAuNmg1LjRsMS44IDcuMi0xLjguOS45IDguMWgtMi43bC0uOS02LjMtLjkgNi4zaC0yLjdsLjktOC4xLTEuOC0uOXoiLz4KICAgICAgPHBhdGggZD0iTTMzLjcgMjEuNWw3LjItNy4yIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgICA8L2c+CiAgICA8cmVjdCB4PSIyMi41IiB5PSI0MCIgd2lkdGg9IjE5IiBoZWlnaHQ9IjQiIHJ4PSIxIiBmaWxsPSIjMGIxYTNkIi8+CiAgPC9nPgo8L3N2Zz4K";
