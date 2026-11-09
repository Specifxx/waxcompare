// Stores the owner has banned. Never list them, never show a price from them, never let a probe or a registry merge add
// them back. Matched on the store key OR any part of the host, so a renamed key or a custom domain in front of the same
// Shopify shop is caught too. Pure (no imports): the importer, the probes, the file store and the tests all read it.
//
// - tcgsynergy (TCG Synergy, tcgsynergy.myshopify.com, CA): owner, 2026-10-31, "it's a scam site".
// - hbtcollectables (HBT Collectables, hbtcollectables.com, AU): asked not to be linked, legal notice to the
//   owner, 2026-11-04. Not a scam; a store that does not want the traffic.
//
// - UNVERIFIED_STORES (2026-11-09, a visitor asked how the shops were chosen): shops the first QA pass could not
//   verify (no email or phone and no refund or shipping policy, no domain of their own, or no stock behind the
//   listings). Not accused of anything: they come back when they show a contact and their policies.
export const UNVERIFIED_STORES: readonly string[] = [
  "ip5f5c0a", "theplatypusparty", "mgmh", "dejouer", "thehyperiongames", "collectorsspace", "mymintcards", "todohits", "mantisgamestudio",
];
export const BLOCKED_STORES: readonly string[] = ["tcgsynergy", "hbtcollectables", ...UNVERIFIED_STORES];

function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** True when a store key, name, base URL or host names a banned store. */
export function isBlockedStore(...values: (string | null | undefined)[]): boolean {
  return values.some((v) => typeof v === "string" && BLOCKED_STORES.some((b) => squash(v).includes(b)));
}
