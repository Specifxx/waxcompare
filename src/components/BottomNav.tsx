"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CART_OPEN_EVENT, cartCount, onCartChange, readCart } from "@/lib/cart-list";
import { BOTTOM_NAV_SEARCH_INPUT, bottomNavTabs } from "@/lib/bottom-nav";
import { CartIcon } from "./cart/CartIcon";

// The phone bottom nav (owner, 2026-11-18, after Catchback's; first built on TCG Prices, `Specifxx/tcgcompare` PRs 69 and 72, and
// ported here unchanged in behaviour). Rift's earlier bar (deleted 2026-09-18) rode up the screen because it computed where the
// browser's address bar was (calc(100lvh - 100dvh), then a visualViewport "lift") and floated under pinch-zoom. THIS bar does no
// position arithmetic at all:
//
//   • `position: fixed; bottom: 0` (globals.css `.bn`), the placement the phone ad dock has run in production since 2026-11-06, with
//     `env(safe-area-inset-bottom)` padding. It moves on `transform` only (CLS 0), never `bottom`, never a measured number.
//   • Browser only (nothing in the server HTML: SEO and the first paint are untouched) and phones only (below 768px).
//   • `BOTTOM_NAV` in lib/bottom-nav.ts is the switch: "off" (the rollback, ignores everything), "optin" (only a visitor who opened
//     any page with `?bn=1`, kept in localStorage; `?bn=0` clears it) or "on" (everyone, `?bn=0` still opts out).
//   • Hides on scroll down, shows on scroll up and at the top; hides while pinch-zoomed, while a text field has focus (the keyboard),
//     while any dialog, the menu or the cart drawer is open, on a page with the phone buy bar, and whenever an Add to cart button is
//     in the strip it would cover (so it never sits on one).
//   • It and the ad dock alternate: the dock yields while the nav shows (`html[data-bottomnav]`). One bar at a time.
//   • The tabs are the site's own (lib/bottom-nav.ts); this file is the same in every site that has the bar.

export type BottomNavMode = "off" | "optin" | "on";

/** One tab: a link (`href`, active on it and on `also`), or an action (the cart drawer, the site menu, the header's search box). */
export interface BottomNavTab {
  key: string;
  label: string;
  icon: "home" | "search" | "deals" | "grid" | "trend" | "heart" | "cart" | "menu";
  href?: string;
  also?: string[];
  /** Active on `href` itself only, not on the pages under it (a region's home). */
  exact?: boolean;
  action?: "cart" | "menu" | "search";
}

export interface BottomNavState {
  narrow: boolean;
  scrollY: number;
  /** The scroll direction as last settled: "up", "down", or "" before the visitor has moved. */
  dir: "up" | "down" | "";
  zoomed: boolean;
  typing: boolean;
  modal: boolean;
  buybar: boolean;
  /** An Add to cart button is inside the strip the bar would cover. */
  covers: boolean;
  enabled: boolean;
}

/** The scroll distance below which the bar always shows (the top of a page). */
export const NAV_TOP = 80;
/** The least a scroll must move, in px, to flip the direction (finger jitter and iOS rubber-banding never flip it). Down is slower to
 *  decide than up: showing the bar on the first real upward flick is what makes it feel immediate. */
export const NAV_DELTA = 10;
export const NAV_DELTA_UP = 4;
/** The bar's height above the safe area. */
export const NAV_H = 56;
const OPT_KEY = "bn";

/** Whether the bar shows. Pure, for the tests. */
export function bottomNavShows(s: BottomNavState): boolean {
  if (!s.enabled || !s.narrow || s.zoomed || s.typing || s.modal || s.buybar || s.covers) return false;
  if (s.scrollY < NAV_TOP) return true;
  return s.dir === "up";
}

/** The next scroll direction given the last settled one, where the scroll was, and where it is now. Pure, for the tests. */
export function nextDir(dir: "up" | "down" | "", anchor: number, y: number): { dir: "up" | "down" | ""; anchor: number } {
  // The anchor is the scroll position the direction was last decided at: it follows the page while the direction holds and stays
  // put until the page has moved NAV_DELTA the other way.
  if (y > anchor + NAV_DELTA) return { dir: "down", anchor: y };
  if (y < anchor - NAV_DELTA_UP) return { dir: "up", anchor: y };
  if (dir === "down" && y > anchor) return { dir, anchor: y };
  if (dir === "up" && y < anchor) return { dir, anchor: y };
  return { dir, anchor };
}

/** Whether the visitor has the bar: the site's mode, then `?bn=` (1 keeps it, 0 clears it), then what they kept. */
export function bottomNavEnabled(mode: BottomNavMode, search: string, stored: string | null): { enabled: boolean; store: "1" | "0" | null } {
  if (mode === "off") return { enabled: false, store: null };
  const q = new URLSearchParams(search).get("bn");
  if (q === "1") return { enabled: true, store: "1" };
  if (q === "0") return { enabled: false, store: "0" };
  if (mode === "on") return { enabled: stored !== "0", store: null };
  return { enabled: stored === "1", store: null };
}

/** Whether a tab is the current page: Home only on its own path, the others on their path or anything under it. Pure, for the tests. */
export function bottomNavActive(pathname: string, tab: Pick<BottomNavTab, "href" | "also" | "exact">): boolean {
  if (!tab.href) return false;
  const p = pathname.replace(/\/+$/, "") || "/";
  return [tab.href, ...(tab.also ?? [])].some((h) => {
    const t = h.replace(/\/+$/, "") || "/";
    if (t === "/" || tab.exact) return p === t;
    return p === t || p.startsWith(`${t}/`);
  });
}

const SVG = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

function TabIcon({ icon }: { icon: BottomNavTab["icon"] }) {
  switch (icon) {
    case "home":
      return <svg {...SVG}><path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-5h4v5" /></svg>;
    case "search":
      return <svg {...SVG}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
    case "deals":
      return <svg {...SVG}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>;
    case "grid":
      return <svg {...SVG}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
    case "trend":
      return <svg {...SVG}><path d="m3 17 6-6 4 4 8-8M15 7h6v6" /></svg>;
    case "heart":
      return <svg {...SVG}><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 12 5.6 5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" /></svg>;
    case "cart":
      return <CartIcon size={22} />;
    case "menu":
    default:
      return <svg {...SVG}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
  }
}

function narrowNow(): boolean {
  return window.matchMedia("(max-width: 767px)").matches;
}

export function BottomNav({ mode }: { mode: BottomNavMode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [count, setCount] = useState(0);
  const [tabs, setTabs] = useState<BottomNavTab[]>([]);
  const ref = useRef<HTMLElement>(null);

  // The opt-in, read once in the browser (never in the server HTML).
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(OPT_KEY);
    } catch {
      /* storage blocked: the query alone decides, for this page */
    }
    const r = bottomNavEnabled(mode, location.search, stored);
    if (r.store !== null) {
      try {
        localStorage.setItem(OPT_KEY, r.store);
      } catch {
        /* nothing to keep it in */
      }
    }
    setEnabled(r.enabled);
  }, [mode]);

  // The tabs follow the page (a region prefix, the visitor's region), so they are worked out in the browser.
  useEffect(() => {
    if (enabled) setTabs(bottomNavTabs(pathname));
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled) return;
    const sync = () => setCount(cartCount(readCart()));
    sync();
    return onCartChange(sync);
  }, [enabled]);

  // The controller. SMOOTHNESS (owner, 2026-11-18: "a bit of lag"): the scroll path reads scrollY and nothing else (no layout reads, no
  // React state, no re-render): the show/hide is two attribute writes, and CSS moves the bar on `transform` alone. Everything that
  // needs the DOM (an open dialog, a cart button in the bar's strip) is cached and refreshed by observers, never in the scroll handler.
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current as (HTMLElement & { inert?: boolean }) | null;
    if (!el) return;
    const root = document.documentElement;
    const stripPx = NAV_H + 12;
    let dir: "up" | "down" | "" = "";
    let anchor = window.scrollY;
    let typing = false;
    let modal = false;
    let buybar = false;
    let covers = 0;
    let last: boolean | null = null;

    const apply = (show: boolean) => {
      if (show === last) return;
      last = show;
      el.dataset.bottomnavBar = show ? "shown" : "hidden";
      el.inert = !show;
      if (show) el.removeAttribute("aria-hidden");
      else el.setAttribute("aria-hidden", "true");
      root.toggleAttribute("data-bottomnav", show);
      root.style.scrollPaddingBottom = show ? `calc(${NAV_H}px + env(safe-area-inset-bottom))` : "";
    };
    const decide = () => {
      const y = Math.max(0, window.scrollY); // iOS rubber-banding reports negative values past the top
      const n = nextDir(dir, anchor, y);
      dir = n.dir;
      anchor = n.anchor;
      const vv = window.visualViewport;
      apply(
        bottomNavShows({
          enabled: true,
          narrow: narrowNow(),
          scrollY: y,
          dir,
          // Pinch-zoomed: the visual viewport is smaller than the layout one and a fixed bar is drawn at the zoomed scale.
          zoomed: !!vv && vv.scale > 1.02,
          typing,
          modal,
          buybar,
          covers: covers > 0,
        }),
      );
    };

    // Cached facts, refreshed when the DOM changes (not per scroll frame).
    const refresh = () => {
      modal =
        // The cart drawer is always in the DOM, aria-modal but inert and aria-hidden while closed: only an open one counts.
        [...document.querySelectorAll("dialog[open], [aria-modal='true']")].some((d) => !d.closest("[inert], [aria-hidden='true']")) ||
        document.body.style.overflow === "hidden" ||
        root.style.overflow === "hidden" ||
        root.matches(".capacitor-native");
      buybar = !!document.querySelector("[data-buybar]");
      decide();
    };

    // An Add to cart button inside the strip along the foot of the screen: the bar stays away. An IntersectionObserver reports it
    // (no layout reads in the scroll path); its root is the viewport shrunk from the top to just that strip.
    let io: IntersectionObserver | null = null;
    const inStrip = new Set<Element>();
    const watch = () => {
      io?.disconnect();
      inStrip.clear();
      covers = 0;
      if (typeof IntersectionObserver === "undefined") return;
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) (e.isIntersecting ? inStrip.add(e.target) : inStrip.delete(e.target));
          covers = inStrip.size;
          decide();
        },
        { rootMargin: `-${Math.max(0, window.innerHeight - stripPx)}px 0px 0px 0px` },
      );
      document.querySelectorAll(".ce-cart-add, .ce-cart-inline").forEach((b) => io!.observe(b));
    };

    let frame = 0;
    const later = () => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), refresh(), watch()));
    };
    const isField = (t: Element | null) =>
      !!t?.matches?.("input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select, [contenteditable='true']");
    // A field that already had focus when the bar arrived (a search page's autofocus): the keyboard is up.
    typing = isField(document.activeElement);
    const onFocus = (e: FocusEvent) => {
      typing = isField(e.target as Element | null);
      decide();
    };
    const onBlur = () => {
      typing = false;
      decide();
    };
    const onResize = () => {
      watch();
      decide();
    };

    el.dataset.bottomnavBar = "hidden";
    refresh();
    watch();
    window.addEventListener("scroll", decide, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.visualViewport?.addEventListener("resize", decide);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    // Its own attribute writes (inert, aria-hidden) are not news.
    const mo = new MutationObserver((recs) => {
      if (recs.some((r) => !el.contains(r.target))) later();
    });
    // Two targets (observe() on the same node twice REPLACES its options): the page for what opens and closes, the body for its overflow.
    mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "aria-modal", "aria-hidden", "inert", "data-buybar"] });
    mo.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", decide);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", decide);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      mo.disconnect();
      io?.disconnect();
      root.removeAttribute("data-bottomnav");
      root.style.scrollPaddingBottom = "";
    };
  }, [enabled, pathname]);

  // Room under the footer (set once: below the fold, so no layout shift).
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.setAttribute("data-bottomnav-on", "");
    document.body.style.paddingBottom = `calc(${NAV_H}px + env(safe-area-inset-bottom))`;
    return () => {
      root.removeAttribute("data-bottomnav-on");
      document.body.style.paddingBottom = "";
    };
  }, [enabled]);

  if (!enabled) return null;

  const act = (tab: BottomNavTab) => {
    if (tab.action === "cart") window.dispatchEvent(new CustomEvent(CART_OPEN_EVENT));
    if (tab.action === "menu") document.querySelector<HTMLElement>("[data-bn-menu]")?.click();
    if (tab.action === "search") {
      // The header's own search box: back to the top, then the field (focus from the tap itself, so phones open the keyboard).
      const input = [...document.querySelectorAll<HTMLInputElement>(BOTTOM_NAV_SEARCH_INPUT)].find((i) => i.offsetParent !== null);
      window.scrollTo({ top: 0 });
      input?.focus({ preventScroll: true });
    }
  };

  return (
    <nav ref={ref} aria-label="Quick links" data-bottomnav-bar="hidden" aria-hidden="true" className="bn md:hidden">
      <ul className="bn-row">
        {tabs.map((t) => {
          const active = bottomNavActive(pathname, t);
          return (
            <li key={t.key} className="bn-cell">
              {t.href && !t.action ? (
                <Link
                  href={t.href}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  data-bn={t.key}
                  className="bn-tab"
                  // The target starts loading on touch-down, a head start on the tap itself (one page, only when it is touched).
                  onPointerDown={() => router.prefetch(t.href!)}
                >
                  <span className="bn-ico">
                    <TabIcon icon={t.icon} />
                  </span>
                  <span className="bn-label">{t.label}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  data-bn={t.key}
                  aria-haspopup={t.action === "search" ? undefined : "dialog"}
                  aria-label={t.action === "cart" && count ? `${t.label}, ${count} item${count === 1 ? "" : "s"}` : t.label}
                  onClick={() => act(t)}
                  className="bn-tab"
                >
                  <span className="bn-ico">
                    <TabIcon icon={t.icon} />
                    {t.action === "cart" && count > 0 && (
                      <span aria-hidden="true" className="bn-badge">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </span>
                  <span className="bn-label">{t.label}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
