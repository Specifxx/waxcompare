"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AFFILIATE_NOTE_SHORT, ebayRetailer, ebayRetailerForHref, ebaySearchUrl, REL_SPONSORED, type Placement } from "@/lib/affiliate";
import { AMAZON_DISCLOSURE, amazonRetailer, amazonUrl, REL_AMAZON } from "@/lib/amazon";
import type { AmazonRail } from "@/lib/amazon-rail";
import { formatPrice } from "@/lib/ebay-context";
import type { Region } from "@/lib/regions";
import { useListings } from "./EbayStrip";
import { EbayMark } from "./EbayMark";
import { OutboundLink } from "./OutboundLink";
import { interleave } from "./AdDock";

// The one in-page ad block (owner, 2026-11-13: "a bigger, subtler horizontal ad inside the page, native to the site", in place of the side
// rails). A full-column-width box of up to six large tiles, eBay's and Amazon's taking turns (eBay first), each with its own logo word, a
// two-line title and, for eBay, its price; it scrolls sideways when the column is narrower than the row (.scroller). Those are the two paid
// groups here (the side rails' pair).
//
//   • Where: below a page's main content, once. A region home page, a product page and a set page place it themselves, after their own
//     sections (never in the hero, above a first list, beside a buy button or above a price); every other region page gets it from the
//     layout, directly above the footer (the old pre-footer strip is gone). Never in the quick view.
//   • Browser only: the server HTML holds an empty box of the block's height (no SEO change, CLS 0); the eBay listings (the sealed feed the
//     page's strips share, CDN-cached) and Amazon's tiles (/api/rails/amazon/<region>, CDN-cached) are fetched once it nears the viewport.
//     With fewer than three tiles the box is removed.
//   • Paid links, labelled "Ad", under their own placements (listings-inline, amazon-inline). Amazon tiles carry NO price (Amazon's licence
//     keeps a price 24 hours; this sits in a CDN copy for longer) and its Associates disclosure. Never a store row, a best price, a deal, an
//     alert or counted as a store.
//   • Not a pop-up, no overlay; the phone dock (AdDock.tsx) yields to it ([data-ad]).

export const INLINE_MAX = 6;
/** The block's height in every state (server, loading, ready): the header, one row of tiles, the note. */
export const INLINE_H = 340;

const EBAY: Placement = "listings-inline";
const AMZ: Placement = "amazon-inline";

// Pages with their own spot for the block (the region home, a product page, a set page): the layout's copy skips them.
const OWN = [/^\/[a-z]{2}\/?$/, /^\/[a-z]{2}\/p\//, /^\/[a-z]{2}\/sets\/[^/]+\/?$/];
export function layoutInlineAdsAllowed(path: string): boolean {
  return !OWN.some((r) => r.test(path));
}

/** eBay's and Amazon's tiles taking turns, eBay first, at most INLINE_MAX; one side short hands its turns to the other. Pure, for the tests. */
export function inlineOrder<E, A>(ebay: E[], amazon: A[], max = INLINE_MAX): Array<E | A> {
  return interleave<E | A>([{ items: ebay }, { items: amazon }]).slice(0, max);
}

/** The block the region layout draws above the footer on every page without a spot of its own. */
export function LayoutInlineAds({ region }: { region: Region }) {
  const path = usePathname() || "";
  if (!layoutInlineAdsAllowed(path)) return null;
  return <InlineAds key={`${region}|${path}`} region={region} className="mt-6" />;
}

interface Tile {
  kind: "ebay" | "amazon";
  key: string;
  href: string;
  img: string;
  title: string;
  /** eBay's listing price; Amazon tiles have none. */
  price: string | null;
}

/** The region's Amazon tiles, asked for once `go` (browser only; CDN-cached a day, no price in it). undefined: not asked or pending; null: none. */
function useAmazonTiles(region: Region, go: boolean): AmazonRail | null | undefined {
  const [rail, setRail] = useState<AmazonRail | null | undefined>(undefined);
  useEffect(() => {
    if (!go) return;
    let cancelled = false;
    fetch(`/api/rails/amazon/${region}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { rail: AmazonRail | null } | null) => {
        if (!cancelled) setRail(j?.rail && j.rail.tiles.length > 0 ? j.rail : null);
      })
      .catch(() => {
        if (!cancelled) setRail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [region, go]);
  return rail;
}

export function InlineAds({ region, className = "" }: { region: Region; className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { ref, state } = useListings({ region, context: "sealed", placement: EBAY, min: 1 });
  const settled = state.status !== "idle";
  const amazonRail = useAmazonTiles(region, settled);
  const ebay: Tile[] =
    state.status === "ready"
      ? state.a.items.slice(0, INLINE_MAX).map((i) => ({ kind: "ebay", key: `e${i.id}`, href: i.href, img: i.imageUrl, title: i.title, price: formatPrice(i.price) }))
      : [];
  const amazon: Tile[] = (amazonRail?.tiles ?? []).slice(0, INLINE_MAX).map((t) => ({ kind: "amazon", key: `a${t.id}`, href: t.href, img: t.img, title: t.name, price: null }));
  const shown = inlineOrder(ebay, amazon);
  const ready = mounted && settled && amazonRail !== undefined;
  // Settled with too little to show: no block at all.
  if (ready && shown.length < 3) return <div ref={ref} hidden />;
  return (
    <div ref={ref} className={className} style={{ minHeight: INLINE_H }}>
      {ready && (
        <section data-ad={EBAY} role="group" aria-label="Sponsored: sealed sports cards on eBay and Amazon" className="ad-box p-4" style={{ minHeight: INLINE_H }}>
          <div className="flex items-center gap-2">
            <span className="ad-pill">Ad</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">Sealed sports cards on eBay and Amazon</span>
            <OutboundLink href={ebaySearchUrl("", region, EBAY)} rel={REL_SPONSORED} retailer={ebayRetailer(region)} placement={EBAY} className="text-xs font-medium text-muted hover:text-ink hover:underline">
              All on eBay →
            </OutboundLink>
            {amazonRail && (
              <OutboundLink href={amazonUrl("", { region, placement: AMZ })} rel={REL_AMAZON} retailer={amazonRetailer(region)} placement={AMZ} className="hidden text-xs font-medium text-muted hover:text-ink hover:underline sm:inline">
                All on {amazonRail.label} →
              </OutboundLink>
            )}
          </div>
          <ul role="list" className="scroller mt-3 gap-3">
            {shown.map((t) => (
              <li key={t.key} className="w-[172px]">
                <OutboundLink
                  href={t.href}
                  rel={t.kind === "ebay" ? REL_SPONSORED : REL_AMAZON}
                  retailer={t.kind === "ebay" ? ebayRetailerForHref(t.href, region) : amazonRetailer(region)}
                  placement={t.kind === "ebay" ? EBAY : AMZ}
                  title={t.price ? `${t.title} · ${t.price}` : t.title}
                  className="group flex h-[256px] flex-col rounded-xl border border-line bg-surface p-2 transition-colors hover:border-ink/40"
                >
                  <span className="plate relative block aspect-square w-full shrink-0 overflow-hidden rounded-lg">
                    <img src={t.img} alt={t.title} width={156} height={156} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-contain p-1" />
                  </span>
                  <span className="mt-1.5 flex h-[18px] items-center">
                    {t.kind === "ebay" ? (
                      <EbayMark className="text-[13px]" />
                    ) : (
                      <span className="text-[13px] font-black leading-none tracking-tight" aria-label="Amazon">
                        amazon
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 h-9 text-xs font-semibold leading-[18px]">{t.title}</span>
                  <span className="tabular mt-auto flex items-baseline justify-between gap-2 text-sm font-bold">
                    <span className="truncate">{t.price ?? "Check price"}</span>
                    <span className="shrink-0 text-xs font-medium text-muted group-hover:text-ink">View</span>
                  </span>
                  <span className="sr-only">, on {t.kind === "ebay" ? "eBay" : "Amazon"}</span>
                </OutboundLink>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted">
            Sponsored. {AFFILIATE_NOTE_SHORT}
            {amazonRail && ` ${AMAZON_DISCLOSURE}`}
          </p>
        </section>
      )}
    </div>
  );
}
