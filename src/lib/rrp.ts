// US MSRP, so US pages can say "below MSRP". Topps, Panini and Upper Deck publish no list price for hobby product (stores set
// their own, and release-day prices move with demand), so there is none: every lookup returns null and no page claims an MSRP.
import { TYPE_BY_LABEL, type TypeKey } from "./sealed-title";

export { RRP_AS_OF, RRP_NOTE } from "./rrp-note";

/** US MSRP in cents for a product, or null (always, for sports cards). */
export function usMsrpCents(type: TypeKey, setCode: string | null): number | null {
  void type;
  void setCode;
  return null;
}

/** usMsrpCents() by the product type LABEL a Product row carries; null outside the US. */
export function usMsrpForCard(market: string, typeLabel: string, setCode: string | null): number | null {
  if (market !== "US") return null;
  const t = TYPE_BY_LABEL.get(typeLabel);
  return t ? usMsrpCents(t.key, setCode) : null;
}


