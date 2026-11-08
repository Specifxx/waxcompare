// "Looking for single card prices?": the short answer for searches that land here looking for one card. The site compares sealed
// product (CLAUDE.md); this says so plainly and sends the reader to the sealed pages and guides. Static: no read. On the guides
// index.
import Link from "@/components/Link";
import { guideHref } from "@/content/guides/kit";
import type { RegionInfo } from "@/lib/regions";
import { sectionHref } from "@/lib/site";

const A = "font-semibold text-brand underline-offset-2 hover:underline";

export function SinglesNote({ r, className = "page mt-14" }: { r: RegionInfo; className?: string }) {
  return (
    <section className={className} aria-labelledby="singles-h">
      <div className="mx-auto max-w-3xl rounded-xl border border-line bg-surface p-5 text-[15px] leading-7 text-muted sm:p-6">
        <h2 id="singles-h" className="font-display text-xl font-bold tracking-tight text-ink">
          Looking for single card prices?
        </h2>
        <p className="mt-2">
          SportsCardCompare compares <strong className="text-ink">sealed sports cards</strong>: hobby, jumbo, mega and blaster boxes, cases and packs, across card shops in{" "}
          {r.inName}. Single cards, graded cards, breaks and store-made repacks are left out, so every product page compares the same factory-sealed item from shop to
          shop.
        </p>
        <p className="mt-2">
          New to the formats? Start with{" "}
          <Link href={guideHref(r, "hobby-vs-blaster-vs-mega-box")} prefetch={false} className={A}>
            hobby box vs blaster vs mega box
          </Link>
          , or go straight to{" "}
          <Link href={sectionHref(r.region, "hobbyBoxes")} prefetch={false} className={A}>
            hobby boxes in stock in {r.inName}
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
