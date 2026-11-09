// Guide: buying a sealed hobby case or single boxes. General (a case is a sealed carton of boxes; how many differs by release), and
// today's cheapest cases and boxes in the region. No pack-count, value or pull-rate claims.
import type { RegionInfo } from "@/lib/regions";
import type { GuideData } from "./data";
import { GUIDE_BY_SLUG } from "./index";
import { Checklist, GuideBody, guideHref, Lede, linesOf, LiveBlock, PriceTable, Prose, storesPhrase, whereToBuy, type BodyProps, type GuideOutline } from "./kit";
import Link from "@/components/Link";

const GUIDE = GUIDE_BY_SLUG.get("hobby-case-vs-single-box")!;

export function outline(r: RegionInfo, data: GuideData): GuideOutline {
  return {
    intro: (
      <Lede>
        A sealed <strong>hobby case</strong> is a carton of hobby boxes as the maker packs it. Whether to buy a case or single boxes depends on how many boxes you want and what shipping costs. Today’s
        prices from {storesPhrase(r)}:
      </Lede>
    ),
    sections: [
      {
        id: "today",
        title: "Cases and boxes today",
        live: true,
        body: (
          <>
            <LiveBlock r={r} checked={data.checked}>
              <PriceTable
                r={r}
                caption={`Hobby cases and boxes in ${r.inName} today`}
                lines={[...linesOf(data.rows["hobby-case"], "Hobby case"), ...linesOf(data.rows["hobby-box"], "Hobby box")]}
              />
            </LiveBlock>
            <p className="text-xs leading-5 text-muted">Each store’s listed price, excluding shipping. A case and a box can be different releases, so divide a case’s price by the boxes it holds, which the listing states, before comparing.</p>
          </>
        ),
      },
      {
        id: "check",
        title: "Before you buy a case",
        body: (
          <Checklist
            items={[
              "How many boxes the listing says the case holds: it differs by release.",
              "That the case is factory sealed, and how it ships: whole, with padding, tracked and insured.",
              "Shipping on something this heavy, which our prices exclude.",
              "The return terms if the carton arrives damaged.",
            ]}
          />
        ),
      },
      {
        id: "related",
        title: "Related",
        body: (
          <Prose>
            <p>
              See <Link href={guideHref(r, "hobby-vs-blaster-vs-mega-box")}>hobby vs blaster vs mega box</Link> and <Link href={guideHref(r, "how-to-avoid-resealed-sports-card-boxes")}>how to avoid resealed boxes</Link>.
            </p>
          </Prose>
        ),
      },
      whereToBuy(r),
    ],
  };
}

export function Body({ r, data }: BodyProps) {
  return <GuideBody guide={GUIDE} r={r} outline={outline(r, data)} />;
}
