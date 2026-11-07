import { menuSets } from "@/lib/release";
import type { Region } from "@/lib/regions";
import { SET_BY_CODE } from "@/lib/sets";
import { sectionHref, type SectionKey } from "@/lib/site";

export type MenuLink = { href: string; label: string };
export type MenuColumn = { title: string; links: MenuLink[] };

/**
 * The desktop "All sealed" dropdown's columns (lg and up), category-first like the big skin and card marketplaces: what kind of
 * product, which set, and the value pages. The same destinations the phone menu and the footer already link, so it adds no page
 * and no read: a static list (sets from lib/sets.ts, in release.ts featureOrder: the newest released set first, never a pre-order).
 * Ported from DexCompare (CompareEmpire #68, 2026-10-28). Pure, so the tests pin it.
 */
export function shopMenuColumns(region: Region, today: string = new Date().toISOString().slice(0, 10), listed?: ReadonlySet<string> | null): MenuColumn[] {
  const s = (key: SectionKey, label: string): MenuLink => ({ href: sectionHref(region, key), label });
  const type = (slug: string, label: string): MenuLink => ({ href: `/${region}/type/${slug}`, label });
  const sets = menuSets(7, today, listed)
    .map((c) => SET_BY_CODE.get(c)!)
    .map((set) => ({ href: `/${region}/sets/${set.slug}`, label: set.releaseDate > today ? `${set.name} (pre-order)` : set.name }));
  return [
    {
      title: "By product",
      links: [
        s("hobbyBoxes", "Hobby boxes"),
        s("jumboBoxes", "Jumbo boxes"),
        s("megaBoxes", "Mega boxes"),
        s("blasterBoxes", "Blaster boxes"),
        type("hanger-boxes", "Hanger boxes"),
        s("hobbyCases", "Hobby cases"),
        type("packs", "Packs"),
      ],
    },
    { title: "By release", links: [...sets, s("sets", "Every release →")] },
    {
      title: "By value",
      links: [s("deals", "Deals"), s("backInStock", "Back in stock"), s("priceMoves", "Price moves"), s("outOfPrint", "Older releases in stock"), s("sealed", "Browse & filter all →")],
    },
  ];
}
