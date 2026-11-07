// Guide: hobby box vs blaster vs mega box. Where each kind is sold and what sets it apart (general, true of every maker: the box
// itself says what a given release holds), what each costs in the region today (the cheapest open boxes of each kind), and which
// suits whom (general guidance, no value or pull-rate claims).
import { GUIDE_BY_SLUG } from "./index";
import { Decisions, GuideBody, guideHref, Lede, linesOf, LiveBlock, Note, PriceTable, Prose, storesPhrase, whereToBuy, type BodyProps, type GuideOutline, type GuideSection } from "./kit";
import type { GuideData } from "./data";
import type { RegionInfo } from "@/lib/regions";
import Link from "@/components/Link";

const GUIDE = GUIDE_BY_SLUG.get("hobby-vs-blaster-vs-mega-box")!;

export function outline(r: RegionInfo, data: GuideData): GuideOutline {
  const sections: GuideSection[] = [
    {
      id: "the-difference",
      title: "The difference, in short",
      body: (
        <Prose>
          <p>
            <strong>Hobby boxes</strong> are made for card shops. They usually cost the most, and most releases print on the box how many autographs, memorabilia
            cards or numbered parallels it promises: a guaranteed “hit” count is what you pay for.
          </p>
          <p>
            <strong>Blaster, mega and hanger boxes</strong> are retail products, made for big stores and supermarkets as well as card shops. They cost less and hold
            fewer cards, most promise few or no hits, and many carry parallels or inserts found only in that retail format.
          </p>
          <p>
            Some releases add more formats: <strong>jumbo</strong> (or HTA) boxes with bigger packs, <strong>first off the line</strong> boxes sold for a short
            time at launch, and <strong>breaker’s delight</strong> boxes made for group breaks. Pack counts, cards per pack and hits differ from release to release,
            so read what the maker prints on the box you’re buying.
          </p>
        </Prose>
      ),
    },
    {
      id: "today",
      title: "What each costs today",
      live: true,
      body: (
        <>
          <Prose>
            <p>The cheapest boxes of each kind in stock at {storesPhrase(r)} right now, of any sport and release:</p>
          </Prose>
          <LiveBlock r={r} checked={data.checked}>
            <PriceTable
              r={r}
              caption={`Hobby, mega, blaster and hanger boxes in ${r.inName} today`}
              lines={[
                ...linesOf(data.rows["hobby-box"], "Hobby box"),
                ...linesOf(data.rows["mega-box"], "Mega box"),
                ...linesOf(data.rows["blaster-box"], "Blaster box"),
                ...linesOf(data.rows["hanger-box"], "Hanger box"),
              ]}
            />
          </LiveBlock>
          <p className="text-xs leading-5 text-muted">Each store’s listed price, excluding shipping. The cheapest of each kind can be from different releases and sports.</p>
        </>
      ),
    },
    {
      id: "which-suits-you",
      title: "Which one suits you?",
      body: (
        <>
          <Decisions
            rows={[
              { when: "You want the autographs and numbered cards a release is known for", then: <>A hobby box: it is the format that promises them, and the box says how many.</> },
              { when: "You want to open something without spending much", then: <>A blaster or hanger box: the cheapest way into a release, with the retail-only parallels.</> },
              { when: "You want more packs than a blaster for less than a hobby box", then: <>A mega box, where the release has one.</> },
              { when: "You want one particular player’s card", then: <>Buy that card on its own. Opening boxes is a gamble on what you get.</> },
            ]}
          />
          <Note>
            A sealed box bought below what card shops ask can be a resealed one. See <Link href={guideHref(r, "how-to-avoid-resealed-sports-card-boxes")}>how to avoid resealed boxes</Link>.
          </Note>
        </>
      ),
    },
    whereToBuy(r),
  ];
  return {
    intro: (
      <Lede>
        A <strong>hobby box</strong> is the card-shop format that promises a set number of hits, and a <strong>blaster</strong>, <strong>mega</strong> or{" "}
        <strong>hanger box</strong> is a cheaper retail format with fewer. Here’s how they compare, with today’s prices from {storesPhrase(r)}.
      </Lede>
    ),
    sections,
  };
}

export function Body({ r, data }: BodyProps) {
  return <GuideBody guide={GUIDE} r={r} outline={outline(r, data)} />;
}
