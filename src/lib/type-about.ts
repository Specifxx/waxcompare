// Keyed by the type's slug (sealed-title.ts PRODUCT_TYPES): the type page's intro, and the words other pages (the guides) use when
// they describe a type. What the product is, never a price, a trend, a pack count, a hit count or a claim about value: those differ
// by release and are printed on the box. Pure.

// A sentence per type that says what it is, so a category page is more than a grid.
export const TYPE_ABOUT: Readonly<Record<string, string>> = {
  "hobby-boxes": "A hobby box is the card-shop format of a release. Most releases print on the box how many autographs, memorabilia or numbered cards it promises; pack counts differ by release.",
  "jumbo-boxes": "A jumbo box (Topps calls it HTA) is a hobby format with bigger packs and, on most releases, more promised hits than the standard hobby box.",
  "fotl-boxes": "A First Off The Line (FOTL) box is a hobby box sold for a short time at a release's launch, usually with parallels found only in that format.",
  "breakers-delight-boxes": "A Breaker's Delight box is a smaller hobby format made for group breaks, usually built around a few guaranteed hits.",
  "choice-boxes": "A Choice box is a Panini hobby format with few cards and a small number of promised hits.",
  "fast-break-boxes": "A Fast Break box is a Panini hobby format with smaller packs and its own parallels.",
  "hybrid-boxes": "An H2 or hybrid box mixes hobby and retail: hobby-style hits with retail-style packs, sold mainly through card shops.",
  "lite-boxes": "A lite box is a smaller, cheaper version of a release's hobby box.",
  "super-boxes": "A super box is a premium version of a release's hobby box, with more cards or hits as the maker lists them.",
  "hobby-cases": "A hobby case is a sealed case of hobby boxes as the maker ships it to card shops, still in its outer wrap.",
  "hobby-packs": "Single hobby packs, loose, from a release's hobby boxes.",
  "mega-boxes": "A mega box is a retail format, bigger than a blaster, often with inserts or parallels found only in mega boxes.",
  "monster-boxes": "A monster box is a large retail format of a release, with more packs than its mega box.",
  "blaster-boxes": "A blaster box is the everyday retail format of a release: a few packs, often with a retail-only parallel or insert.",
  "hanger-boxes": "A hanger box is a small retail format made to hang on a store peg: one or a few packs.",
  "value-packs": "Value packs and fat packs are single retail packs with more cards than a standard retail pack.",
  "value-boxes": "A value box is a retail box of a release's value or fat packs, sold as one sealed unit.",
  "cello-packs": "Cello packs are clear-wrapped retail packs with more cards than a standard pack.",
  tins: "Tins are retail products sold in a metal tin, usually with packs and sometimes an exclusive card.",
  "display-boxes": "A retail display box is a sealed box of a release's retail packs, as it is shipped to stores.",
  packs: "Single retail packs, loose.",
  "factory-sets": "A factory set is a release's complete base set as the maker packs it, sometimes with exclusive rookie or parallel cards.",
  "starter-packs": "A sticker starter pack is an album with a few packets of stickers to begin a collection.",
  "sticker-albums": "A sticker album is the empty book a sticker collection goes in.",
};
