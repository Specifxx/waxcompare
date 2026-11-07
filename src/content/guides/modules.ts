// Each guide's body module, by slug: what /[region]/guides/[slug] renders. Kept apart from the registry (index.ts), which the
// sitemap imports and which must stay free of React and the database.
import type { GuideSlug } from "./index";
import type { GuideModule } from "./kit";
import * as boxTypes from "./hobby-vs-blaster-vs-mega-box";
import * as whereToBuy from "./where-to-buy-sealed-sports-cards-online";
import * as resealed from "./how-to-avoid-resealed-sports-card-boxes";

export const GUIDE_MODULES: Record<GuideSlug, GuideModule> = {
  "hobby-vs-blaster-vs-mega-box": boxTypes,
  "where-to-buy-sealed-sports-cards-online": whereToBuy,
  "how-to-avoid-resealed-sports-card-boxes": resealed,
};
