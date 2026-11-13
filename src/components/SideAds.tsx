"use client";

import { useEffect, useState } from "react";
import { ebayRetailerForHref, REL_SPONSORED, type Placement } from "@/lib/affiliate";
import { formatPrice } from "@/lib/ebay-context";
import type { Region } from "@/lib/regions";
import { useListings } from "./EbayStrip";
import { useSoftRegion } from "./RegionSuggest";
import { EbayMark } from "./EbayMark";
import { OutboundLink } from "./OutboundLink";
import { AdDock, DockGate, DockTile, DOCK_LINK, type DockSide } from "./AdDock";

// The phone dock's host (the side rails that shared this file were removed 2026-11-13, owner: the ads are one horizontal block inside
// the page, components/InlineAds.tsx). Browser only, narrow screens only (below MIN_WIDTH); nothing is in the server HTML. The dock holds
// eBay listings only: Amazon is never in an overlay (Associates rules).
export const MIN_WIDTH = 1280;
/** Up to ten dock tiles, popular first. */
export const MAX_TILES = 10;

export function SideAds({ region }: { region: Region }) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`);
    const update = () => setNarrow(!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  // Wide screens have the in-page block (InlineAds.tsx); narrow ones get the dock after a scroll.
  return narrow ? <PhoneDock region={region} /> : null;
}

/**
 * The same dock on the pages with no region of their own (the home page, the blog, About…), in the visitor's suggested or picked region
 * (RegionSuggest.tsx), like their header and sidebar.
 */
export function SoftSideAds() {
  return <SideAds region={useSoftRegion()} />;
}

type ListingsState = ReturnType<typeof useListings>["state"];
type Listing = Extract<ListingsState, { status: "ready" }>["a"]["items"][number];

/** The ready feeds' listings in order, no listing twice, at most MAX_TILES. Pure, for the tests. */
export function mergeListings(states: ListingsState[]): Listing[] {
  const seen = new Set<string>();
  const out: Listing[] = [];
  for (const st of states) {
    if (st.status !== "ready") continue;
    for (const i of st.a.items) {
      if (out.length >= MAX_TILES) return out;
      if (seen.has(i.id)) continue;
      seen.add(i.id);
      out.push(i);
    }
  }
  return out;
}

/** The phone dock: the in-page block's eBay tiles (AdDock.tsx has the rules). Amazon is never in it: an overlay (Associates rules). */
function PhoneDock({ region }: { region: Region }) {
  return (
    <DockGate minWidth={MIN_WIDTH}>
      <DockAds region={region} />
    </DockGate>
  );
}

function DockAds({ region }: { region: Region }) {
  const placement: Placement = "listings-dock";
  // The block's three feeds, the same requests (CDN-cached, shared with the strips).
  const { state } = useListings({ region, context: "sealed", placement, min: 1, eager: true });
  const boxes = useListings({ region, context: "type:hobby-boxes", placement, min: 1, eager: true }).state;
  const collectors = useListings({ region, context: "type:blaster-boxes", placement, min: 1, eager: true }).state;
  const items = state.status === "ready" ? mergeListings([state, boxes, collectors]) : [];
  if (items.length === 0) return null;
  const sides: DockSide[] = [
    {
      key: "ebay",
      items: items.map((i) => (
        <OutboundLink key={i.id} href={i.href} rel={REL_SPONSORED} retailer={ebayRetailerForHref(i.href, region)} placement={placement} className={DOCK_LINK} title={`${i.title} · ${formatPrice(i.price)}`}>
          <DockTile img={i.imageUrl} alt={i.title} brand={<EbayMark className="text-[11px]" />} title={i.title} price={formatPrice(i.price)} cta="View" />
          <span className="sr-only">, on eBay</span>
        </OutboundLink>
      )),
    },
  ];
  return <AdDock label="Sponsored: sealed sports cards on eBay" sides={sides} placement={placement} minWidth={MIN_WIDTH} />;
}
