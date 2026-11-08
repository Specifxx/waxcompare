// Guide: sports card Black Friday 2026 (2026-11-07). The dates, today's cheapest boxes, Bundles and Commander decks in the region as the
// prices to compare a Black Friday price with, and the checks before buying. The deals themselves are /<region>/black-friday and
// /<region>/cyber-monday. No claim about what will be cheaper on the day: we only know what stores ask today.
import Link from "next/link";
import type { RegionInfo } from "@/lib/regions";
import type { GuideData } from "./data";
import { GUIDE_BY_SLUG } from "./index";
import { Checklist, GuideBody, guideHref, Lede, linesOf, LiveBlock, PriceTable, Prose, storesPhrase, whereToBuy, type BodyProps, type GuideOutline } from "./kit";
import { faqSection } from "./kit-more";

const GUIDE = GUIDE_BY_SLUG.get("sports-cards-black-friday-2026")!;

export function outline(r: RegionInfo, data: GuideData): GuideOutline {
  const bf = `/${r.region}/black-friday`;
  const cm = `/${r.region}/cyber-monday`;
  return {
    intro: (
      <Lede>
        Black Friday is Friday 27 November 2026 and Cyber Monday is Monday 30 November. Before the week starts, it pays to know what sealed sports card boxes cost at{" "}
        {storesPhrase(r)} today, so a Black Friday price can be checked against the cheapest store rather than against a sticker.
      </Lede>
    ),
    sections: [
      {
        id: "deals",
        title: "Where the Black Friday deals are",
        body: (
          <Prose>
            <p>
              Our <Link prefetch={false} href={bf}>sports card Black Friday deals</Link> page lists the sealed boxes the cheapest store in {r.inName} sells well under the other
              stores today, rebuilt every day through the week, and <Link prefetch={false} href={cm}>Cyber Monday deals</Link> does the same for the Monday. This guide is the
              reference to read them against.
            </p>
          </Prose>
        ),
      },
      {
        id: "prices",
        title: "The prices to compare with",
        live: true,
        body: (
          <>
            <Prose>
              <p>The cheapest hobby, mega and blaster boxes in stock at {storesPhrase(r)} right now, cheapest first:</p>
            </Prose>
            <LiveBlock r={r} checked={data.checked}>
              <PriceTable
                r={r}
                caption={`The cheapest sealed sports card boxes in ${r.inName} today`}
                lines={[
                  ...linesOf(data.rows["hobby-box"], "Hobby Box"),
                  ...linesOf(data.rows["mega-box"], "Mega Box"),
                  ...linesOf(data.rows["blaster-box"], "Blaster Box"),
                ]}
              />
            </LiveBlock>
          </>
        ),
      },
      {
        id: "checks",
        title: "Five checks before you pay",
        body: (
          <Checklist
            items={[
              "Compare with the cheapest store today, not with a struck-through price or the MSRP: a sticker can sit against a price no store charges.",
              "Add the delivery. A box a little cheaper with paid shipping can cost more than one with free shipping over a threshold.",
              "Check it is in stock. A low price on a pre-order or a backorder ships later, or not at all.",
              <>
                Be careful with a box far under every store: it is more often a different product, a retail box listed as hobby, or a resealed or searched one. See{" "}
                <Link prefetch={false} href={guideHref(r, "how-to-avoid-resealed-sports-card-boxes")}>how to avoid resealed sports card boxes</Link>.
              </>,
              "Read a code's terms: stores often leave hobby boxes and pre-orders out of site-wide codes.",
            ]}
          />
        ),
      },
      faqSection([
        { q: "When is Black Friday 2026?", a: "Friday 27 November 2026. Cyber Monday is Monday 30 November 2026. Many stores start earlier in the week." },
        { q: `Where can I find sports card Black Friday deals in ${r.inName}?`, a: `SportsCardCompare's Black Friday page lists the sealed boxes the cheapest store in ${r.inName} sells well under the other stores today, updated every day through Black Friday and Cyber Monday.` },
        { q: "Do these prices include shipping?", a: "No: each is the store's listed price, excluding delivery. Check the store's delivery cost before you buy." },
      ]),
      whereToBuy(r, { links: [{ href: bf, label: "Black Friday deals" }, { href: cm, label: "Cyber Monday deals" }] }),
    ],
  };
}

export function Body({ r, data }: BodyProps) {
  return <GuideBody guide={GUIDE} r={r} outline={outline(r, data)} />;
}
