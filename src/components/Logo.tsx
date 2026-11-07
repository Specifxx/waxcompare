// The WaxCompare mark (2026-11-07): two trading cards fanned on a night-navy tile, closed by a red wax seal with a star: sealed
// sports cards, drawn as our own. No league, team, card maker or player logo, and no shape taken from one. The same geometry is
// src/app/icon.svg, public/logo.svg, the PNG icons (apple-icon, icon-192, icon-512) and src/app/favicon.ico; src/lib/og-card.tsx draws a
// flat copy for the share cards (satori has no gradients).
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  // In a host span so the Christmas Santa hat (globals.css .xmas-logo-hat, hidden outside the season) can sit on the mark.
  return (
    <span className="xmas-hat-host">
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <defs>
          <radialGradient id="wcm-bg" cx="0.5" cy="0.3" r="0.85"><stop offset="0" stopColor="#1b2f63"/><stop offset="1" stopColor="#070d20"/></radialGradient>
          <radialGradient id="wcm-seal" cx="0.38" cy="0.32" r="0.8"><stop offset="0" stopColor="#ff5a68"/><stop offset="0.55" stopColor="#d8233a"/><stop offset="1" stopColor="#8e0c1f"/></radialGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#wcm-bg)"/>
        <g transform="rotate(-12 26 32)"><rect x="12" y="13" width="24" height="34" rx="3" fill="#3d5fb3" stroke="#070d20" strokeWidth="1.2"/><rect x="15" y="16" width="18" height="21" rx="1.5" fill="#5a7ccc"/></g>
        <g transform="rotate(8 34 30)"><rect x="21" y="10" width="25" height="35" rx="3" fill="#f6f7fb" stroke="#070d20" strokeWidth="1.2"/><rect x="24" y="13" width="19" height="22" rx="1.5" fill="#c3d0ee"/><rect x="24" y="37.5" width="12" height="3" rx="1.5" fill="#9cadd6"/></g>
        <circle cx="43" cy="45" r="11" fill="url(#wcm-seal)" stroke="#070d20" strokeWidth="1.2"/>
        <circle cx="43" cy="45" r="7.6" fill="none" stroke="#ffc2c8" strokeOpacity="0.6" strokeWidth="1"/>
        <path d="M43.00 40.00 L44.23 43.30 L47.76 43.45 L45.00 45.65 L45.94 49.05 L43.00 47.10 L40.06 49.05 L41.00 45.65 L38.24 43.45 L41.77 43.30 Z" fill="#fff3f4"/>
      </svg>
      <span aria-hidden="true" className="xmas-logo-hat" />
    </span>
  );
}

/**
 * The mark and the wordmark. `wordmark` sets when the word shows: the header passes "hidden sm:inline", so a phone's one row keeps
 * its width for the search box (the mark alone is the home link there, named by the link's aria-label).
 */
export function Logo({ wordmark = "" }: { wordmark?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className="h-8 w-8 shrink-0" />
      <span className={`font-display text-[19px] font-extrabold tracking-tight ${wordmark}`}>
        Wax<span className="text-brand">Compare</span>
      </span>
    </span>
  );
}
