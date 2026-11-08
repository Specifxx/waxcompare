/** @type {import('next').NextConfig} */

// Safe defaults on every response. The Content-Security-Policy is REPORT-ONLY:
// product photos are hotlinked from ~250 store CDNs, and an enforcing policy
// that is wrong silently blanks them. Report-only never blocks anything; a
// violation shows in the browser console (there is no report endpoint), and the
// audit before switching it to enforce is: browse a few pages, read the console.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "img-src https: data:",
  // Google AdSense (only loaded once NEXT_PUBLIC_ADSENSE_CLIENT is set: src/lib/adsense.ts).
  "script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.gstatic.com https://*.adtrafficquality.google https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "connect-src 'self' https://riftcompare.com https://api.github.com https://raw.githubusercontent.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://vitals.vercel-insights.com https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.adtrafficquality.google",
  "frame-src https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

// THE PAGES ARE CACHED BY VERCEL'S CDN, NOT ISR (2026-10-17, DEPLOY.md "Caching"). An ISR write is billed per 8 KB of the page
// (~45 units for a product page's HTML + RSC) and every release empties the ISR cache, so each visited page was written again after
// every release: about twenty times what rendering it costs. Every data page is force-dynamic and this header keeps its response at
// the CDN for a day: Vercel-CDN-Cache-Control is read by Vercel's CDN before the page's own `private, no-store` and never reaches the
// browser. The data only changes with a release, and a release empties the CDN. Safe because no page reads a cookie, a header or
// the session: one copy is right for every visitor (tests/cache-ttl.test.ts walks them).
const CDN_CACHE = "public, s-maxage=86400, stale-while-revalidate=86400";
const CDN_PAGES = ["/", "/:region(au|us|uk|ca|eu)", "/:region(au|us|uk|ca|eu)/:path*", "/guides/:slug", "/blog", "/blog/:slug", "/forum", "/forum/:path*", "/widgets", "/widgets/:path*"];

// The canonical origin (src/lib/site.ts SITE_URL). Until the owner buys sportscardcompare.com (2026-11-08) the site lives at its
// .vercel.app address, so a production build with no NEXT_PUBLIC_SITE_URL takes Vercel's own production domain: canonicals, the
// sitemap and JSON-LD then name the address the site really serves, and the day the domain is added in Vercel the next build
// switches to it by itself. Set here, the value is the same on the server and in the browser.
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, "")}`
    : "");

const nextConfig = {
  reactStrictMode: true,
  ...(SITE_ORIGIN ? { env: { NEXT_PUBLIC_SITE_URL: SITE_ORIGIN } } : {}),
  // The public data files (data/public/, ~25 MB: src/lib/public-data/) ride with every server function, which reads them instead of
  // Neon. Only when the build will read them (PUBLIC_DATA_MODE "files", the default, or "fallback").
  experimental: {
    outputFileTracingIncludes: {
      "/**": [
        ...((process.env.PUBLIC_DATA_MODE || "files").trim().toLowerCase() === "db" ? [] : ["./data/public/**/*.json"]),
        // The product page's Amazon row: ASINs from the daily import, and the prices this build fetched (lib/amazon-live.ts).
        "./data/amazon/*.json",
        "./data/amazon-live/*.json",
      ],
    },
  },
  poweredByHeader: false,
  // Product photos are plain <img> tags pointing at each store's own CDN. Never
  // route them through Vercel Image Optimization, which is metered.
  images: { unoptimized: true },
  // A new site (2026-11-07): no old URLs to keep. Region-less section paths go to the US copy; /guides (bar the one region-less
  // guide that lives there) to the US guides. Upper-case region prefixes (/AU) are lowercased by src/middleware.ts: a redirect
  // here matches case-insensitively, so "/AU/:path*" → "/au/:path*" would match /au too and loop.
  async redirects() {
    return [
      { source: "/:path(sealed|sets|stores|releases|deals)", destination: "/us/:path", permanent: true },
      { source: "/creators/:rest+", destination: "/creators", permanent: true },
      { source: "/guides", destination: "/us/guides", permanent: true },
      { source: "/guides/:path((?!sports-card-box-prices-by-country$).*)", destination: "/us/guides", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The embeddable widgets (DECISIONS.md, "Free price widgets", 2026-11-02) are framed on other sites: these two
      // override the SAMEORIGIN and report-only frame-ancestors above, for /widgets/:path+ only (never /widgets itself).
      { source: "/widgets/:path+", headers: [{ key: "X-Frame-Options", value: "ALLOWALL" }, { key: "Content-Security-Policy", value: "frame-ancestors *" }] },
      ...CDN_PAGES.map((source) => ({ source, headers: [{ key: "Vercel-CDN-Cache-Control", value: CDN_CACHE }] })),
    ];
  },
};

module.exports = nextConfig;
