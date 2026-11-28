// What of the deals card's picks is still true in the browser (components/DealsPopup.tsx). PURE: tests/deals-popup.test.ts.
import type { DealPick } from "./deal-picks";

export const AMAZON_MAX_AGE_MS = 24 * 3600_000;

/** Amazon's prices under 24 hours old only (its licence), and its deal badge only before Amazon's own end. */
export function livePicks(picks: DealPick[], now: number): DealPick[] {
  return picks
    .filter((p) => p.brand !== "amazon" || (!!p.at && Number.isFinite(Date.parse(p.at)) && now - Date.parse(p.at) < AMAZON_MAX_AGE_MS))
    .map((p) => (p.until && now >= Date.parse(p.until) ? { ...p, deal: undefined, off: undefined } : p));
}
