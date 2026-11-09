// Each guide's body module, by slug: what /[region]/guides/[slug] renders. Kept apart from the registry (index.ts), which the
// sitemap imports and which must stay free of React and the database.
import type { GuideSlug } from "./index";
import type { GuideModule } from "./kit";
import * as boxTypes from "./hobby-vs-blaster-vs-mega-box";
import * as whereToBuy from "./where-to-buy-sealed-sports-cards-online";
import * as resealed from "./how-to-avoid-resealed-sports-card-boxes";
import * as jumbo from "./hobby-box-vs-jumbo-box";
import * as hobbyCase from "./hobby-case-vs-single-box";
import * as blackFriday from "./sports-cards-black-friday-2026";

export const GUIDE_MODULES: Record<GuideSlug, GuideModule> = {
  "hobby-vs-blaster-vs-mega-box": boxTypes,
  "where-to-buy-sealed-sports-cards-online": whereToBuy,
  "how-to-avoid-resealed-sports-card-boxes": resealed,
  "sports-cards-black-friday-2026": blackFriday,
  "hobby-box-vs-jumbo-box": jumbo,
  "hobby-case-vs-single-box": hobbyCase,
};
