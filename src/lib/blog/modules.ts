// Each post's body module, by slug. Kept apart from the registry (index.ts), which must stay free of React and the database.
import type { PostSlug } from "./index";
import type { PostModule } from "./kit";
import { cheapest, dearest } from "./posts/boxes";

export const POST_MODULES: Record<PostSlug, PostModule> = {
  "cheapest-sports-card-boxes": cheapest,
  "most-expensive-sports-card-boxes": dearest,
};
