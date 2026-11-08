// The SportsCardCompare mark (owner's pick, 2026-11-08): three player cards fanned like a hand on a blue tile, a batter in front, a
// football and a basketball behind: sports trading cards, drawn as our own. No league, team, card maker or player logo, and no shape taken from one. The same geometry is
// src/app/icon.svg, public/logo.svg, the PNG icons (apple-icon, icon-192, icon-512) and src/app/favicon.ico; src/lib/og-card.tsx draws
// the same SVG as an image for the share cards.
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  // In a host span so the Christmas Santa hat (globals.css .xmas-logo-hat, hidden outside the season) can sit on the mark.
  return (
    <span className="xmas-hat-host">
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">  <rect width="64" height="64" rx="14" fill="#1d4fd8"/><g transform="rotate(-24 32 58)"><rect x="20" y="12" width="24" height="36" rx="3" fill="#fff" stroke="#0b1a3d" strokeWidth="1"/><rect x="22.5" y="14.5" width="19" height="24" rx="1.5" fill="#0f7a3f"/><ellipse cx="28" cy="21" rx="5" ry="3.2" fill="#8b4a1c" transform="rotate(-30 28 21)"/><path d="M25.6 21.8l4.6-2.6" stroke="#fff" strokeWidth="1"/></g><g transform="rotate(24 32 58)"><rect x="20" y="12" width="24" height="36" rx="3" fill="#fff" stroke="#0b1a3d" strokeWidth="1"/><rect x="22.5" y="14.5" width="19" height="24" rx="1.5" fill="#ff7a1a"/><circle cx="36" cy="21" r="4.6" fill="#ffb066" stroke="#7a3300" strokeWidth="1"/><path d="M31.4 21h9.2M36 16.4v9.2" stroke="#7a3300" strokeWidth="1"/></g><g><rect x="20" y="9" width="24" height="38" rx="3" fill="#fff" stroke="#0b1a3d" strokeWidth="1.2"/><rect x="22.5" y="11.5" width="19" height="26" rx="1.5" fill="#d1192f"/><g fill="#fff"><circle cx="31" cy="17" r="2.9"/><path d="M28.3 20.6h5.4l1.8 7.2-1.8.9.9 8.1h-2.7l-.9-6.3-.9 6.3h-2.7l.9-8.1-1.8-.9z"/><path d="M33.7 21.5l7.2-7.2" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></g><rect x="22.5" y="40" width="19" height="4" rx="1" fill="#0b1a3d"/></g></svg>
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
      <span className={`font-display text-[23px] font-extrabold italic uppercase leading-none tracking-[0.01em] ${wordmark}`}>
        SportsCard<span className="text-brand">Compare</span>
      </span>
    </span>
  );
}
