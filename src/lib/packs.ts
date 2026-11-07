// How many packs a sealed product holds, so a price can be shown per pack. Current-state arithmetic only.
//
// Sports boxes hold a different number of packs in every release (a 2025 Topps Chrome hobby box is not a 2024 one, and a Jumbo box
// is not a hobby box), and the makers' counts change mid-year. We never invent one (CLAUDE.md), so every product returns null and no
// page shows a per-pack price (a single pack's would only repeat its price).
import { TYPE_BY_LABEL, type TypeKey } from "./sealed-title";

/** Packs in one unit of the product, or null when we can't confirm it. */
export function packsFor(type: TypeKey, setCode: string | null, name = ""): number | null {
  void setCode;
  void name;
  void type;
  return null;
}

/** packsFor() by the product type LABEL a Product row carries ("Play Booster Box"). */
export function packsForLabel(typeLabel: string, setCode: string | null, name = ""): number | null {
  const t = TYPE_BY_LABEL.get(typeLabel);
  return t ? packsFor(t.key, setCode, name) : null;
}

/** Price per pack in cents, rounded, or null. */
export function perPackCents(priceCents: number | null | undefined, packs: number | null): number | null {
  if (!packs || !priceCents || priceCents <= 0) return null;
  return Math.round(priceCents / packs);
}
