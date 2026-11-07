// Sports card creators featured on /creators (owner, 2026-10-30: "a section on WaxCompare, just like on RiftCompare"), modelled on
// RiftCompare's lib/content/creators.ts. A hand-curated list a commit edits: no database, no form, no account. A creator mentions or
// links WaxCompare in their content; in return they get a card here and a face in the homepage strip. Use the creator's own
// spelling and handles, and only links they show publicly. Not called "partners" anywhere: that word means the affiliate links.

export type CreatorPlatform = "Instagram" | "YouTube" | "Threads" | "TikTok" | "Facebook" | "X" | "Twitch" | "Website";

export interface CreatorLink {
  platform: CreatorPlatform;
  url: string;
  /** As displayed, e.g. "@handle". */
  handle?: string;
  /** The link's own words when it is not their profile (a single video, say). */
  label?: string;
}

export interface Creator {
  /** Stable id, lowercase with hyphens: the card's anchor (/creators#slug). */
  slug: string;
  name: string;
  /** What they make, one line. */
  blurb: string;
  /** A few sentences for their spotlight. */
  about: string;
  /** Their channels, most important first. The first is the card's main button. */
  links: CreatorLink[];
  /** Short content tags. At most four show. */
  tags: string[];
  /** Where they're based, as they say it. */
  based?: string;
  /** A square photo in public/img/creators/ (not public/creators/: next.config.js redirects /creators/* to the hub), already cropped to a circle. Initials without one. */
  avatar?: string;
  /** One headline number they show publicly, with the month it was read ("15.9K Instagram followers, Oct 2026"). */
  reach?: string;
  /** ISO date the listing went live. The newest is the spotlight. */
  since: string;
}

/** Empty until the first creator signs up (a new site, 2026-11-07): the page shows only the "get featured" invitation. */
export const CREATORS: Creator[] = [];

/** Newest first. Pure. */
export function featuredCreators(list: Creator[] = CREATORS): Creator[] {
  return [...list].sort((a, b) => b.since.localeCompare(a.since) || a.name.localeCompare(b.name));
}

/** "Kevin Lepage" → "KL". Pure. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
