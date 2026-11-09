// Guide: hobby box vs jumbo box. General and true of every maker (the box itself says what a release holds): what a jumbo (HTA) box
// is, who it suits, and what each costs in the region today. No pull-rate, value or pack-count claims.
import type { RegionInfo } from "@/lib/regions";
import type { GuideData } from "./data";
import { GUIDE_BY_SLUG } from "./index";
import { Decisions, GuideBody, guideHref, Lede, linesOf, LiveBlock, Note, PriceTable, Prose, storesPhrase, whereToBuy, type BodyProps, type GuideOutline } from "./kit";
import Link from "@/components/Link";

const GUIDE = GUIDE_BY_SLUG.get("hobby-box-vs-jumbo-box")!;

export function outline(r: RegionInfo, data: GuideData): GuideOutline {
  return {
    intro: (
      <Lede>
        A <strong>jumbo box</strong> (often called an HTA box) is a hobby format with bigger packs, offered by some releases beside the standard hobby box. Here is how the two differ and what each costs
        at {storesPhrase(r)} today.
      </Lede>
    ),
    sections: [
      {
        id: "the-difference",
        title: "The difference, in short",
        body: (
          <Prose>
            <p>
              Both are sold through card shops. A <strong>hobby box</strong> is the standard format of a release. A <strong>jumbo box</strong> holds fewer, larger packs with more cards in each, and not
              every release has one.
            </p>
            <p>
              What each promises (autographs, memorabilia cards, numbered parallels) differs from release to release and maker to maker. The box prints it, so read the box or the listing for the exact
              release before you compare prices.
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
            <LiveBlock r={r} checked={data.checked}>
              <PriceTable
                r={r}
                caption={`Hobby and jumbo boxes in ${r.inName} today`}
                lines={[...linesOf(data.rows["hobby-box"], "Hobby box"), ...linesOf(data.rows["jumbo-box"], "Jumbo box")]}
              />
            </LiveBlock>
            <p className="text-xs leading-5 text-muted">Each store’s listed price, excluding shipping. The cheapest of each kind can be from different releases and sports, so compare the same release.</p>
          </>
        ),
      },
      {
        id: "which-suits-you",
        title: "How to choose",
        body: (
          <>
            <Decisions
              rows={[
                { when: "You want the release’s standard hobby format", then: <>A hobby box: the format most releases are priced and discussed around.</> },
                { when: "You prefer bigger packs", then: <>A jumbo box, where the release offers one: check what the box says it holds.</> },
                { when: "You want to spend less", then: <>Look at the retail formats in <Link href={guideHref(r, "hobby-vs-blaster-vs-mega-box")}>hobby vs blaster vs mega box</Link>.</> },
              ]}
            />
            <Note>
              A box priced far below what card shops ask can be a resealed one. See <Link href={guideHref(r, "how-to-avoid-resealed-sports-card-boxes")}>how to avoid resealed boxes</Link>.
            </Note>
          </>
        ),
      },
      whereToBuy(r),
    ],
  };
}

export function Body({ r, data }: BodyProps) {
  return <GuideBody guide={GUIDE} r={r} outline={outline(r, data)} />;
}
