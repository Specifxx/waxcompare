// The two hobby-box posts: the cheapest sealed sports card boxes in stock in each market, and the dearest. Built from the stores'
// live listings.
import Link from "@/components/Link";
import type { PostData } from "../data";
import { ByMarket, Lede, MarketsBlock, NoFx, Prose, type PostOutline } from "../kit";

const KINDS = () => (
  <Prose>
    <ul>
      <li>
        <strong>Hobby box:</strong> the card-shop format. Most releases print on the box how many autographs, memorabilia or numbered cards it promises.
      </li>
      <li>
        <strong>Jumbo (HTA) box:</strong> a hobby format with bigger packs, for the releases that have one.
      </li>
      <li>
        <strong>Mega, blaster and hanger boxes:</strong> retail formats, cheaper, with fewer cards and few or no promised hits.
      </li>
    </ul>
    <p>Pack counts and hits differ from release to release, so read what the maker prints on the box.</p>
  </Prose>
);

export const cheapest = {
  outline(data: PostData): PostOutline {
    return {
      intro: (
        <Lede>
          The cheapest sealed sports card boxes in stock today, market by market, from the card shops we compare: hobby, jumbo and retail boxes of every sport.
        </Lede>
      ),
      sections: [
        {
          id: "cheapest",
          title: "The cheapest boxes in stock, by market",
          body: (
            <>
              <MarketsBlock checked={data.checked}>
                <ByMarket cards={data.boxes} />
              </MarketsBlock>
              <NoFx />
            </>
          ),
        },
        { id: "kinds", title: "Which kind of box is which", body: KINDS() },
        {
          id: "before-you-buy",
          title: "Before you buy the cheapest",
          body: (
            <Prose>
              <p>
                The cheapest box is usually a retail box or an older release. Check the year, the release, the sport and the format, and add shipping: our prices
                exclude it. More in the guide <Link href="/us/guides/hobby-vs-blaster-vs-mega-box">hobby box vs blaster vs mega box</Link>.
              </p>
            </Prose>
          ),
        },
      ],
    };
  },
};

export const dearest = {
  outline(data: PostData): PostOutline {
    return {
      intro: (
        <Lede>
          The most expensive sealed sports card boxes in stock today, in each market we compare, at each one’s cheapest store price. The top end is mostly
          high-end hobby boxes and cases of older releases.
        </Lede>
      ),
      sections: [
        {
          id: "dearest",
          title: "The dearest boxes in stock, by market",
          body: (
            <>
              <MarketsBlock checked={data.checked}>
                <ByMarket cards={data.boxes} />
              </MarketsBlock>
              <NoFx />
            </>
          ),
        },
        { id: "kinds", title: "Hobby, jumbo and retail boxes", body: KINDS() },
        {
          id: "cheapest",
          title: "Looking for the cheapest instead?",
          body: (
            <Prose>
              <p>
                See <Link href="/blog/cheapest-sports-card-boxes">the cheapest sports card boxes in stock</Link>.
              </p>
            </Prose>
          ),
        },
      ],
    };
  },
};
