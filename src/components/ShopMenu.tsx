import { availableFrom, BRAND_BY_SLUG, brandHref, comboHref, POPULAR_COMBOS, sportHref, sportNavLabel, sportsAvailable, sportsOfBrand } from "@/lib/facets";
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

/**
 * The header's "Sports" dropdown (owner, 2026-11-09): the US leagues, the rest of the world, and the pairings collectors ask for
 * most (Panini basketball, Topps baseball…). Every link is a sport or sport-and-brand page with something listed in the market
 * (`listed`, lib/facets.ts availableFrom), so none is a dead end. Static, no read.
 */
export function sportsMenuColumns(region: Region, listed?: ReadonlySet<string> | null): MenuColumn[] {
  const avail = availableFrom(listed);
  const sports = sportsAvailable(avail);
  const link = (x: (typeof sports)[number]): MenuLink => ({ href: sportHref(region, x.key), label: x.nav });
  const combos: MenuLink[] = POPULAR_COMBOS.filter(([s, b]) => avail.combos.has(`${s}/${b}`))
    .slice(0, 6)
    .map(([s, b]) => ({ href: comboHref(region, s, BRAND_BY_SLUG.get(b)!), label: `${BRAND_BY_SLUG.get(b)!.label} ${sportNavLabel(s).replace(/ \(.*\)$/, "")}` }));
  return [
    { title: "Major leagues", links: sports.filter((x) => x.group === "us").map(link) },
    { title: "Around the world", links: sports.filter((x) => x.group === "world").slice(0, 8).map(link) },
    { title: "Popular", links: combos },
  ].filter((c) => c.links.length > 0);
}

/** The header's "Brands" dropdown: Topps and Panini each with the sports they are listed in, then Upper Deck and the smaller makers. */
export function brandsMenuColumns(region: Region, listed?: ReadonlySet<string> | null): MenuColumn[] {
  const avail = availableFrom(listed);
  const col = (slug: string): MenuColumn | null => {
    const b = BRAND_BY_SLUG.get(slug)!;
    if (!avail.brands.has(slug)) return null;
    return {
      title: b.label,
      links: [{ href: brandHref(region, b), label: `All ${b.label}` }, ...sportsOfBrand(avail, b).slice(0, 6).map((s) => ({ href: comboHref(region, s, b), label: sportNavLabel(s).replace(/ \(.*\)$/, "") }))],
    };
  };
  const ud = BRAND_BY_SLUG.get("upper-deck")!;
  const more: MenuLink[] = [];
  if (avail.brands.has("upper-deck")) more.push({ href: brandHref(region, ud), label: "All Upper Deck" }, ...sportsOfBrand(avail, ud).slice(0, 2).map((s) => ({ href: comboHref(region, s, ud), label: `Upper Deck ${sportNavLabel(s).replace(/ \(.*\)$/, "")}` })));
  for (const s of ["leaf", "select", "futera"]) if (avail.brands.has(s)) more.push({ href: brandHref(region, BRAND_BY_SLUG.get(s)!), label: BRAND_BY_SLUG.get(s)!.label });
  return [col("topps"), col("panini"), more.length ? { title: "More makers", links: more } : null].filter((c): c is MenuColumn => !!c);
}
