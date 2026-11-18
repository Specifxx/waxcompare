// The phone bottom nav's switch and tabs (components/BottomNav.tsx, owner 2026-11-18; DECISIONS.md "Phone bottom nav").
// BOTTOM_NAV: "off" is the rollback (nothing renders, ?bn=1 included), "optin" shows it only to a visitor who opened a page with
// ?bn=1, "on" shows it to every phone visitor (?bn=0 still opts out). The tabs are worked out in the browser from the page.
import type { BottomNavMode, BottomNavTab } from "@/components/BottomNav";

export const BOTTOM_NAV: BottomNavMode = "optin";

import { X_DEFAULT_REGION, isRegion, LIVE_REGIONS, type Region } from "@/lib/regions";

/** The header's search box (this site has no /search page: the Search tab focuses it). */
export const BOTTOM_NAV_SEARCH_INPUT = "header input[type='search'], header input[name='q'], header input[type='text']";

/** The page's region, else the one the visitor last browsed (`wax-region`, lib/regions.ts REGION_BOOT_SCRIPT), else the US. */
function regionFor(pathname: string): Region {
  const seg = pathname.split("/")[1];
  if (isRegion(seg) && LIVE_REGIONS.includes(seg)) return seg;
  try {
    const kept = typeof localStorage === "undefined" ? null : localStorage.getItem("wax-region");
    if (isRegion(kept) && LIVE_REGIONS.includes(kept)) return kept;
  } catch {
    /* storage blocked */
  }
  return X_DEFAULT_REGION;
}

export function bottomNavTabs(pathname: string): BottomNavTab[] {
  const r = regionFor(pathname);
  return [
    { key: "home", label: "Home", href: `/${r}`, also: ["/"], exact: true, icon: "home" },
    { key: "search", label: "Search", action: "search", icon: "search" },
    { key: "deals", label: "Deals", href: `/${r}/deals`, also: [`/${r}/price-moves`], icon: "deals" },
    { key: "cart", label: "Cart", action: "cart", icon: "cart" },
    { key: "menu", label: "Menu", action: "menu", icon: "menu" },
  ];
}
