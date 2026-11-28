"use client";
// The deals card (owner, 2026-11-28: "for the other sites like Compare Empire, KaeYoung, ScentCompare with Black Friday, can we
// have some eBay or Amazon pop-ups … with actual products"). It overrides the family's no-pop-up line on this site, on the
// owner's explicit word, and keeps every rule a prompt here has:
//
//   • Once a visit, and it takes the visit's one prompt slot: the rate-us card stands down after it (and it after the rate card).
//   • Never on arrival: OPEN_AFTER_MS on the page, and never while the visitor is typing (a focused field, or a key in the last
//     QUIET_MS), nor over another dialog. A card in the corner, not a modal: the page stays usable, ✕ and Escape close it.
//   • Real products only (lib/deal-picks.ts, /api/deal-picks/<region>, CDN-kept): Amazon's price with its time, dropped after 24 hours,
//     and Amazon's own deal badge, dropped after Amazon's own end; eBay's delivered Buy It Now price. Labelled Ad, rel sponsored.
//     No "was" price, no saving of ours, no countdown.
//   • During Black Friday mode its ✕ hides it for the visit; after, for OFFER_CLOSE_DAYS.
import { useEffect, useState } from "react";
import { BF_PHASE_LABEL, bfModeOn, bfPhase } from "@/lib/bf-mode";
import { OFFER_CLOSE_DAYS, OFFER_PHASE_SHORT, offerPhase } from "@/lib/offer-calendar";
import type { DealPicks } from "@/lib/deal-picks";
import { livePicks } from "@/lib/deal-picks-live";

export const OPEN_AFTER_MS = 9000;
export const QUIET_MS = 5000;
const SHOWN_KEY = "deals-popup";
const CLOSED_AT_KEY = "deals-popup-closed-at";
/** The rate-us card's once-a-visit key (lib/site-reviews.ts SESSION_KEY): one prompt a visit between them. */
const RATE_SESSION_KEY = "srv_rate_seen";

function typingTarget(el: Element | null): boolean {
  if (!el) return false;
  const t = el.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || (el as HTMLElement).isContentEditable;
}

function slotFree(): boolean {
  try {
    if (sessionStorage.getItem(SHOWN_KEY) === "1" || sessionStorage.getItem(RATE_SESSION_KEY) === "1") return false;
    const at = Number(localStorage.getItem(CLOSED_AT_KEY) || 0);
    if (at && Date.now() - at < (bfModeOn(Date.now()) ? 0 : OFFER_CLOSE_DAYS * 86_400_000)) return false;
    return true;
  } catch {
    return false; // storage refused: never ask on our own
  }
}

function claimSlot(): boolean {
  if (!slotFree()) return false;
  try {
    sessionStorage.setItem(SHOWN_KEY, "1");
    sessionStorage.setItem(RATE_SESSION_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export function DealsPopup({ region }: { region: string }) {
  const [data, setData] = useState<DealPicks | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!slotFree()) return;
    let live = true;
    fetch(`/api/deal-picks/${region}`)
      .then((r) => (r.ok ? (r.json() as Promise<DealPicks>) : null))
      .then((d) => live && d && d.region === region && setData(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [region]);

  const picks = data ? livePicks(data.picks, Date.now()) : [];
  const ready = picks.length >= 2;

  useEffect(() => {
    if (!ready || open) return;
    let lastKey = 0;
    let timer = 0;
    const key = () => (lastKey = Date.now());
    window.addEventListener("keydown", key, true);
    const tryOpen = () => {
      const now = Date.now();
      if (typingTarget(document.activeElement) || now - lastKey < QUIET_MS || document.querySelector('dialog[open], [aria-modal="true"]')) {
        timer = window.setTimeout(tryOpen, 2000);
        return;
      }
      if (claimSlot()) setOpen(true);
    };
    timer = window.setTimeout(tryOpen, OPEN_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", key, true);
    };
  }, [ready, open]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  function close() {
    try {
      localStorage.setItem(CLOSED_AT_KEY, String(Date.now()));
    } catch {
      /* storage refused: it closes for this page */
    }
    setOpen(false);
  }

  if (!open || !ready) return null;
  const now = Date.now();
  const bf = bfModeOn(now);
  const chip = bf ? BF_PHASE_LABEL[bfPhase(now)] : OFFER_PHASE_SHORT[offerPhase(now)];
  const brands = [...new Set(picks.map((p) => (p.brand === "amazon" ? "Amazon" : "eBay")))].join(" and ");
  const amazonAt = picks.find((p) => p.brand === "amazon")?.at;
  const when = amazonAt && data?.clock
    ? new Date(amazonAt).toLocaleString("en-GB", { timeZone: data.clock.timeZone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) + ` ${data.clock.label}`
    : null;
  return (
    <aside
      data-deals-popup=""
      role="dialog"
      aria-modal="false"
      aria-label={`${chip} deals on ${brands}`}
      style={{
        position: "fixed", zIndex: 60,
        left: "max(12px, env(safe-area-inset-left))", right: "max(12px, env(safe-area-inset-right))", bottom: "max(12px, env(safe-area-inset-bottom))",
        maxWidth: 380, marginLeft: "auto", background: "#0b0b0c", color: "#fff", border: "1px solid #27272a", borderRadius: 10,
        boxShadow: "0 10px 30px rgba(0,0,0,.35)", padding: "12px 14px 10px", fontSize: 14, lineHeight: 1.35,
      }}
    >
      <button type="button" aria-label="Close the deals card" onClick={close}
        style={{ position: "absolute", top: 4, right: 4, width: 32, height: 32, borderRadius: 999, color: "#a1a1aa", background: "transparent", border: 0, cursor: "pointer" }}>
        ✕
      </button>
      <p style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, paddingRight: 28 }}>
        <span style={{ background: "#ffd400", color: "#0b0b0c", borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase" }}>{chip}</span>
        <span style={{ color: "#a1a1aa", fontSize: 12 }}>Ad · {brands}</span>
      </p>
      <p style={{ margin: "6px 0 8px", fontSize: 16, fontWeight: 800 }}>Deals on {brands}</p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {picks.map((p) => (
          <li key={`${p.brand}-${p.id}`} style={{ minWidth: 0 }}>
            <a href={p.href} rel="sponsored nofollow noopener" target="_blank"
              style={{ display: "flex", gap: 8, alignItems: "center", color: "#fff", textDecoration: "none", background: "#18181b", borderRadius: 8, padding: 6, minHeight: 64 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.img} alt={p.name} width={48} height={48} loading="lazy" referrerPolicy="no-referrer"
                style={{ width: 48, height: 48, objectFit: "contain", background: "#fff", borderRadius: 6, flex: "none" }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 12, color: "#d4d4d8" }}>{p.name}</span>
                {p.deal || p.off ? (
                  <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#4ade80" }}>{p.deal ? p.deal : `${p.off}% off at Amazon`}</span>
                ) : null}
                <span style={{ display: "block", fontWeight: 800, fontSize: 14 }}>{p.price}<span style={{ fontWeight: 600, fontSize: 11, color: "#a1a1aa" }}> · {p.brand === "amazon" ? "Amazon" : "eBay"}</span></span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p style={{ margin: "8px 0 0", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 6, fontSize: 11, color: "#a1a1aa" }}>
        <span title="Product prices and availability are accurate as of the date/time indicated and are subject to change. Any price and availability information displayed on Amazon at the time of purchase will apply to the purchase of this product.">
          {when ? `Amazon prices as of ${when}*` : "eBay prices include delivery"}
        </span>
        <a href={`/${region}/deals`} style={{ color: "#ffd400", fontWeight: 700, textDecoration: "none" }}>Our store deals →</a>
      </p>
    </aside>
  );
}
