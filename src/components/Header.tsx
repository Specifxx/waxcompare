import Link from "@/components/Link";

import { inSeason, saleStrip } from "@/lib/black-friday";
import { navGroups } from "@/lib/nav";
import { REGIONS, X_DEFAULT_REGION, type Region } from "@/lib/regions";
import { sectionHref, SECTION_PATHS, type SectionKey } from "@/lib/site";
import { EbayNavLink } from "./Ebay";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { NavLink } from "./NavLink";
import { RegionSwitcher } from "./RegionSwitcher";
import { HeaderNavItems, SoftHeaderNavItems, SoftRegionSwitcher, SoftSearchBox, type HeaderNavItem } from "./HeaderNav";
import { brandsMenuColumns, shopMenuColumns, sportsMenuColumns } from "./ShopMenu";
import { ThemeToggle } from "./ThemeToggle";
import { CartHeaderLink } from "./cart/CartHeaderLink";
import { SearchBox } from "./SearchBox";

/**
 * The desktop nav (lg and up), in order. `also`: other paths (under the region) that count as the section, for its current
 * state: a type page is part of "All sealed", the per-pack ranking and the weekly digest sit with "Deals".
 */
export const HEADER_NAV: { key: SectionKey | "sports" | "brands"; label: string; also?: string[]; xl?: boolean }[] = [
  { key: "deals", label: "Deals", also: [SECTION_PATHS.thisWeek, SECTION_PATHS.backInStock, SECTION_PATHS.priceMoves, SECTION_PATHS.outOfPrint] },
  // Owner, 2026-11-09: a collector shops by sport and by brand first. Each opens a dropdown; the sets, the release calendar and the
  // guides moved to the "All sealed" dropdown, the sidebar and the phone menu (the row had no room for them).
  { key: "sports", label: "Sports", also: ["/sport"] },
  { key: "brands", label: "Brands", also: ["/brand"] },
  { key: "sealed", label: "All sealed", also: ["/type"] },
  { key: "stores", label: "Stores" },
];

/** The nav as rendered: HEADER_NAV, with "Black Friday" after Deals while the season is on (lib/black-friday.ts inSeason). */
export function headerNav(today = new Date().toISOString().slice(0, 10)): typeof HEADER_NAV {
  if (!inSeason(today)) return HEADER_NAV;
  // xl only: at lg (1024) the row has no room for a seventh item; the phone menu, the footer and the region home link it there.
  // From the Sunday after Black Friday to the day after Cyber Monday the entry is Cyber Monday's (saleStrip).
  const cm = saleStrip(today)?.key === "cyberMonday";
  return [HEADER_NAV[0], cm ? { key: "cyberMonday", label: "Cyber Monday", xl: true } : { key: "blackFriday", label: "Black Friday", xl: true }, ...HEADER_NAV.slice(1)];
}

/**
 * The desktop nav's items for a region, links and all (the dropdowns of Sports, Brands and All sealed included). An open pre-order
 * hub leads the sidebar's Releases group (lib/nav.ts); the header row has no room for it.
 */
export function headerNavItems(region: Region, today = new Date().toISOString().slice(0, 10), listed?: ReadonlySet<string> | null): HeaderNavItem[] {
  return headerNav(today).map((n) => ({
    href: n.key === "sports" ? `/${region}/sport` : n.key === "brands" ? `/${region}/brand` : sectionHref(region, n.key),
    label: n.label,
    also: n.also?.map((p) => `/${region}${p}`),
    xl: n.xl,
    // Three dropdowns (components/ShopMenu.tsx): sports, brands and the sealed browse (by product, by set, by value).
    menu: n.key === "sealed" ? shopMenuColumns(region, today, listed) : n.key === "sports" ? sportsMenuColumns(region, listed) : n.key === "brands" ? brandsMenuColumns(region, listed) : undefined,
  }));
}

/**
 * The site header: ONE row, var(--hdr) tall (60px; 64px from lg), sticky. Everything a page needs to go somewhere else is in it at
 * every width, so nothing below it has to repeat it. From xl it spans the shell (the sidebar's column and the page's).
 *
 * - Below lg: the logo mark (the word from sm), the search box filling the row, the flag-only region button and the menu button
 *   (components/MobileMenu.tsx: every product type, set and section, then the regions).
 * - lg and up: logo, the sections (NavLink marks the current one), eBay's labelled search link (xl, region pages), search, region.
 * - No region (the landing page, About, the legal pages, a 404): the same header, for the visitor's region (owner, 2026-10-28: the
 *   whole navigation from the first page, no "Continue to <region>" step). The server's HTML has the default region's links; the
 *   browser moves them to the suggested one (HeaderNav.tsx), and a region picked there switches the page in place.
 *
 * The search box is components/SearchBox.tsx with its own props; `.hdr-search` (globals.css) only sizes it to the row.
 */
export function Header({ region, listed }: { region: Region | null; listed?: ReadonlySet<string> | null }) {
  const home = region ? `/${region}` : "/";
  const built = region ?? X_DEFAULT_REGION;
  const items = headerNavItems(built, undefined, listed);
  const groups = navGroups(built, undefined, listed);
  return (
    <header className="sticky top-0 z-40 h-[var(--hdr)] bg-surface/90 backdrop-blur-md">
      {/* The jersey stripe along the header's foot (the sports-card look, 2026-11-08), in place of the hairline. */}
      <span aria-hidden="true" className="wx-stripe pointer-events-none absolute inset-x-0 bottom-0 h-[4px]" />
      <div className="page flex h-full items-center gap-2 sm:gap-3 lg:gap-4 xl:max-w-shell">
        <Link href={home} className="flex h-11 shrink-0 items-center rounded-lg" aria-label={`SportsCardCompare${region ? ` ${REGIONS[region].name}` : ""} home`}>
          <Logo wordmark="hidden sm:inline" />
        </Link>
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {region ? <HeaderNavItems items={items} /> : <SoftHeaderNavItems items={items} />}
          {/* From 1440px only: below that the row ran out of room once the side rails narrowed nothing but the page (the sidebar's
              "Guides & news" group links the blog on every screen). */}
          <NavLink href="/blog" className="hidden whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors min-[1440px]:inline-flex">
            Blog
          </NavLink>
          {/* A discreet, labelled sponsored item (xl and up only): eBay's search, tagged. Not a section of the site. */}
          {region && <EbayNavLink region={region} />}
        </nav>
        <div className="hdr-search min-w-0 flex-1 lg:ml-auto lg:min-w-[7rem] lg:max-w-64">{region ? <SearchBox region={region} size="sm" /> : <SoftSearchBox />}</div>
        <ThemeToggle />
        {region ? <RegionSwitcher region={region} compact /> : <SoftRegionSwitcher />}
        {/* The cart list (components/cart, owner 2026-11-06): every width, with its count. */}
        <CartHeaderLink />
        <MobileMenu region={region} groups={groups} built={built} className="lg:hidden" />
      </div>
    </header>
  );
}
