import { inSeason } from "./black-friday";
import { availableFrom, brandHref, brandsAvailable, brandsOfSport, comboHref, sportHref, sportNavLabel, sportsAvailable } from "./facets";
import { openPreorderGuides } from "./preorder-guides";
import { menuSets } from "./release";
import { isRegion, type Region } from "./regions";
import { SET_BY_CODE } from "./sets";
import { sectionHref, type SectionKey } from "./site";

/** `children`: the sidebar opens them under the page the visitor is on (a sport's brands); the phone menu lists the top level only. */
export type NavItem = { href: string; label: string; children?: NavItem[] };
export type NavGroup = { title: string; links: NavItem[] };

/**
 * Every place the site goes, grouped the way a buyer looks for it: what kind of product, which set, where the value is, and the rest.
 * The desktop sidebar (components/SideNav.tsx, xl and up) and the phone menu (components/MobileMenu.tsx) both draw this one list, so
 * the two never disagree. Static (sets from lib/sets.ts, newest released first by release.ts featureOrder, never a pre-order first):
 * no read, no page that doesn't exist. Owner, 2026-10-28: navigation from the first page, no "Continue to <region>" step first.
 */
export function navGroups(region: Region, today: string = new Date().toISOString().slice(0, 10), listed?: ReadonlySet<string> | null): NavGroup[] {
  const s = (key: SectionKey, label: string): NavItem => ({ href: sectionHref(region, key), label });
  const type = (slug: string, label: string): NavItem => ({ href: `/${region}/type/${slug}`, label });
  const sets = menuSets(8, today, listed)
    .map((c) => SET_BY_CODE.get(c)!)
    .map((set) => ({ href: `/${region}/sets/${set.slug}`, label: set.dateKnown && set.releaseDate > today ? `${set.name} (pre-order)` : set.name }));
  // Owner, 2026-11-09: collectors look for their sport and their brand first. Only what is listed in the market is linked.
  const avail = availableFrom(listed);
  const sports: NavItem[] = sportsAvailable(avail).map((x) => ({
    href: sportHref(region, x.key),
    label: x.nav,
    children: brandsOfSport(avail, x.key).map((b) => ({ href: comboHref(region, x.key, b), label: `${b.label} ${sportNavLabel(x.key).replace(/ \(.*\)$/, "")}` })),
  }));
  const brands: NavItem[] = brandsAvailable(avail).map((b) => ({ href: brandHref(region, b), label: b.label }));
  return [
    { title: "Shop by sport", links: sports },
    { title: "Shop by brand", links: brands },
    {
      title: "Shop by product",
      links: [
        s("hobbyBoxes", "Hobby boxes"),
        s("jumboBoxes", "Jumbo boxes"),
        s("megaBoxes", "Mega boxes"),
        s("blasterBoxes", "Blaster boxes"),
        type("hanger-boxes", "Hanger boxes"),
        s("hobbyCases", "Hobby cases"),
        type("packs", "Packs"),
        s("sealed", "All sealed"),
      ],
    },
    // An open pre-order hub leads the sets (lib/preorder-guides.ts; gone on release day).
    { title: "Releases", links: [...openPreorderGuides(today).map(({ set }) => ({ href: `/${region}/preorders/${set.slug}`, label: `${set.name} pre-orders` })), ...sets, s("sets", "Every release")] },
    {
      title: "Deals & stock",
      links: [
        s("deals", "Deals"),
        ...(inSeason(today) ? [s("blackFriday", "Black Friday"), s("cyberMonday", "Cyber Monday")] : []),
        s("thisWeek", "This week"),
        s("backInStock", "Back in stock"),
        s("priceMoves", "Price moves"),
        s("outOfPrint", "Older releases in stock"),
      ],
    },
    {
      title: "More",
      links: [s("releases", "Release calendar"), s("guides", "Buying guides"), s("tools", "Tools"), s("daily", "Price Duel game"), s("stores", "Where to buy"), { href: "/forum", label: "Community forum" }, { href: "/blog", label: "Blog" }, { href: "/creators", label: "Creators" }],
    },
  ];
}

/** The same link in another region: "/us/deals" → "/au/deals". Links outside a region ("/blog") are left alone. Pure. */
export function retargetHref(href: string, to: Region): string {
  const m = /^\/([a-z]{2})(?=\/|$|\?|#)/.exec(href);
  return m && isRegion(m[1]) ? `/${to}${href.slice(m[0].length)}` : href;
}

/** navGroups built for one region, moved to another (the pages with no region of their own follow the visitor's in the browser). */
export function retargetGroups(groups: NavGroup[], to: Region): NavGroup[] {
  const move = (l: NavItem): NavItem => ({ ...l, href: retargetHref(l.href, to), ...(l.children ? { children: l.children.map(move) } : {}) });
  return groups.map((g) => ({ ...g, links: g.links.map(move) }));
}
