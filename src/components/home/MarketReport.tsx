// The region home's written market report: what sealed sports cards cost today, what is cheapest, how the regions differ and how
// stock looks, every number from lib/home-report.ts (the public data files, read at render) and every sentence built from it. No
// template text without a number behind it; when a read is empty the sentence says so. Server-rendered: nothing waits on a script.
// The words follow lib/copy-rules.ts: "today", never a history claim the files cannot back.
import Link from "@/components/Link";
import { COUNTRY_GUIDE } from "@/content/guides/country-prices";
import { guideHref } from "@/content/guides/kit";
import type { ProductCardData } from "@/lib/data";
import { money, plural } from "@/lib/format";
import type { HomeReport, ReportType, TypeRange } from "@/lib/home-report";
import { REGIONS, type RegionInfo } from "@/lib/regions";
import { TYPE_BY_LABEL } from "@/lib/sealed-title";

const A = "font-semibold text-brand underline-offset-2 hover:underline";

const WORDS: Record<ReportType, { many: string; one: string; note: string }> = {
  "Hobby Box": { many: "hobby boxes", one: "hobby box", note: "A hobby box is a release’s card-shop format, and most print on the box how many autographs or numbered cards they promise." },
  "Jumbo Box": { many: "jumbo boxes", one: "jumbo box", note: "A jumbo (HTA) box is a hobby format with bigger packs, on the releases that have one." },
  "Mega Box": { many: "mega boxes", one: "mega box", note: "A mega box is a retail format, bigger than a blaster, often with its own inserts." },
  "Blaster Box": { many: "blaster boxes", one: "blaster box", note: "A blaster box is a release’s everyday retail format: a few packs, often with a retail-only parallel." },
};

const typeHref = (r: RegionInfo, t: ReportType) => {
  const x = TYPE_BY_LABEL.get(t);
  return x ? `/${r.region}/type/${x.slug}` : `/${r.region}/sealed`;
};
const P = ({ r, p }: { r: RegionInfo; p: ProductCardData }) => (
  <Link href={`/${r.region}/p/${p.slug}`} prefetch={false} className={A}>
    {p.name}
  </Link>
);

function RangeParagraph({ r, x }: { r: RegionInfo; x: TypeRange }) {
  const w = WORDS[x.type];
  const m = (c: number) => money(c, r.market);
  return (
    <div>
      <h3 className="font-display text-lg font-bold text-ink">
        <Link href={typeHref(r, x.type)} prefetch={false} className="hover:text-brand">
          {w.many[0].toUpperCase() + w.many.slice(1)} in {r.inName}
        </Link>
      </h3>
      <p className="mt-1.5">
        {w.note} We read {plural(x.n, w.one, w.many)} open in {r.inName} today, from <strong className="text-ink">{m(x.low)}</strong> to {m(x.high)}; the middle price is{" "}
        {m(x.median)}, so half of them cost less than that.
        {x.widest && x.widest.inStockStores > 1 && (
          <>
            {" "}
            The one most stores hold is <P r={r} p={x.widest} />, in stock at {plural(x.widest.inStockStores, "store")}, the easiest one to compare: its cheapest store is{" "}
            {m(x.widest.lowestPriceCents ?? 0)}.
          </>
        )}
      </p>
      {x.top.length > 0 && (
        <p className="mt-1.5">
          Cheapest today:{" "}
          {x.top.map((p, i) => (
            <span key={p.slug}>
              {i > 0 && (i === x.top.length - 1 ? " and " : ", ")}
              <P r={r} p={p} /> ({m(p.lowestPriceCents ?? 0)})
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
}

export function MarketReport({ report }: { report: HomeReport }) {
  const r = REGIONS[report.region];
  const lines = report.regions;
  const withBox = lines.filter((l) => l.cheapest["Hobby Box"]);
  const most = lines.slice().sort((a, b) => b.stores - a.stores)[0];
  const fewest = lines.slice().sort((a, b) => a.stores - b.stores)[0];
  const cheapToday = report.ranges.map((x) => ({ x, p: x.top[0] })).filter((y) => y.p);
  const wrapBy = new Map(report.wrapCards.map((c) => [c.slug, c]));
  const moves = [...report.wrap.lower, ...report.wrap.higher].filter((m) => wrapBy.has(m.slug)).slice(0, 6);
  if (!lines.length && !report.ranges.length) return null;
  return (
    <section className="page mt-14" aria-labelledby="report-h">
      <div className="mx-auto max-w-3xl space-y-10 text-[15px] leading-7 text-muted">
        <div>
          <h2 id="report-h" className="font-display text-2xl font-bold tracking-tight text-ink">
            Sealed sports card prices today: hobby, jumbo, mega and blaster boxes
          </h2>
          <p className="mt-3">
            What sealed sports card boxes cost right now, from the listings we read today. Prices below are for {r.inName}, in {r.currency} before shipping; the
            region table further down gives every region its own figures in its own currency.
          </p>
          <div className="mt-5 space-y-6">
            {report.ranges.map((x) => (
              <RangeParagraph key={x.type} r={r} x={x} />
            ))}
          </div>
        </div>

        {cheapToday.length > 0 && (
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">What’s cheapest this week</h2>
            <p className="mt-3">
              The lowest open price of each kind of product in {r.inName} today. A low price on an older release often means only one or two stores still hold it, so check the
              store count on the product page before you decide.
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              {cheapToday.map(({ x, p }) => (
                <li key={x.type}>
                  The cheapest {WORDS[x.type].one}: <P r={r} p={p} />, {money(p.lowestPriceCents ?? 0, r.market)}
                  {p.inStockStores > 0 ? `, in stock at ${plural(p.inStockStores, "store")}` : ""}.
                </li>
              ))}
            </ul>
            {moves.length > 0 ? (
              <>
                <p className="mt-3">
                  Week on week ({report.wrap.from} to {report.wrap.through}), these moved the most among products in stock at two or more stores on both days:
                </p>
                <ul className="mt-2 list-disc space-y-1.5 pl-5">
                  {moves.map((mv) => (
                    <li key={mv.slug}>
                      <P r={r} p={wrapBy.get(mv.slug)!} />: {money(mv.before, r.market)} → {money(mv.after, r.market)} ({mv.pct > 0 ? "+" : ""}
                      {mv.pct}%).
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-3">
                Week-on-week moves need seven days of our daily snapshots; until then today’s cheapest prices above are the figures to go by.
              </p>
            )}
          </div>
        )}

        {lines.length > 0 && (
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">How prices differ by region</h2>
            <p className="mt-3">
              Each region compares only stores that charge in its own currency, and we never convert a price: an Australian dollar figure and a US dollar figure are two
              different shelves, not one price in two currencies. What changes between regions is how many stores we read, how much of the catalogue they carry and where
              the cheapest box sits.
              {most && fewest && most.region !== fewest.region && (
                <>
                  {" "}
                  {REGIONS[most.region].name} has the most stores we compare ({most.stores}), {REGIONS[fewest.region].name} the fewest ({fewest.stores}), so a product
                  sold out in one region can be on several shelves in another.
                </>
              )}
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">Stores, open products and the cheapest hobby and blaster box in each region today, in local currency</caption>
                <thead className="text-xs uppercase tracking-wide text-faint">
                  <tr>
                    <th scope="col" className="px-3 py-2">Region</th>
                    <th scope="col" className="px-3 py-2">Stores</th>
                    <th scope="col" className="px-3 py-2">Open products</th>
                    <th scope="col" className="px-3 py-2">Cheapest hobby box</th>
                    <th scope="col" className="px-3 py-2">Cheapest blaster box</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lines.map((l) => {
                    const x = REGIONS[l.region];
                    const pb = l.cheapest["Hobby Box"];
                    const cb = l.cheapest["Blaster Box"];
                    return (
                      <tr key={l.region}>
                        <th scope="row" className="px-3 py-2 font-semibold text-ink">
                          <Link href={`/${x.region}`} prefetch={false} className="hover:text-brand">
                            {x.name}
                          </Link>
                        </th>
                        <td className="px-3 py-2 tabular">{l.stores}</td>
                        <td className="px-3 py-2 tabular">{l.open.toLocaleString("en")}</td>
                        <td className="px-3 py-2 tabular">{pb ? <Link href={`/${x.region}/p/${pb.slug}`} prefetch={false} className={A}>{money(pb.lowestPriceCents, x.market)}</Link> : "—"}</td>
                        <td className="px-3 py-2 tabular">{cb ? <Link href={`/${x.region}/p/${cb.slug}`} prefetch={false} className={A}>{money(cb.lowestPriceCents, x.market)}</Link> : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 space-y-3">
              {withBox.map((l) => {
                const x = REGIONS[l.region];
                const pb = l.cheapest["Hobby Box"]!;
                const cd = l.cheapest["Blaster Box"];
                const bu = l.cheapest["Mega Box"];
                return (
                  <p key={l.region}>
                    <strong className="text-ink">{x.name}:</strong> {plural(l.open, "product")} open at {plural(l.stores, `${x.adjective} card shop`)}. The cheapest
                    hobby box there today is <P r={x} p={pb} /> at {money(pb.lowestPriceCents, x.market)}
                    {bu ? <>, the cheapest mega box {money(bu.lowestPriceCents, x.market)}</> : null}
                    {cd ? <> and the cheapest blaster box {money(cd.lowestPriceCents, x.market)}</> : null}.{" "}
                    <Link href={`/${x.region}/type/hobby-boxes`} prefetch={false} className={A}>
                      Hobby boxes in {x.inName}
                    </Link>
                    .
                  </p>
                );
              })}
            </div>
            <p className="mt-3">
              The cheapest box is often a different release from one region to the next: each region’s shops hold different leftovers of older releases, and a release’s
              stock arrives in each region on its own schedule. The{" "}
              <Link href={COUNTRY_GUIDE.path} prefetch={false} className={A}>
                box prices by country
              </Link>{" "}
              guide lines up the same box across every region.
            </p>
          </div>
        )}

        {lines.length > 0 && (
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Stock: what is on the shelf, and when it changes</h2>
            <p className="mt-3">
              We keep a product listed after it sells out, so its page shows which stores had it and when we last read them. Of the products we list in each region, this
              many are open (in stock somewhere, or on pre-order) today:{" "}
              {lines
                .filter((l) => l.products > 0)
                .map((l, i, all) => (
                  <span key={l.region}>
                    {i > 0 && (i === all.length - 1 ? " and " : ", ")}
                    {REGIONS[l.region].name} {Math.round((l.open / l.products) * 100)}% ({l.open.toLocaleString("en")} of {l.products.toLocaleString("en")})
                  </span>
                ))}
              .
            </p>
            <p className="mt-3">
              The pattern behind those numbers is the release calendar. A new release’s hobby and retail boxes reach most card shops in the same week, so in its first
              weeks a box is usually open at many shops at once. As a release ages, shops stop reordering it, the store count on its page falls, and the boxes that are
              left are spread across fewer shelves, sometimes cheaper, sometimes dearer.
            </p>
            <p className="mt-3">
              Stores are read about twice a day, so a product that returns to a store’s shelf shows up here at the next read, with the time we read it. For a release that
              is not out yet, the{" "}
              <Link href={`/${r.region}/releases`} prefetch={false} className={A}>
                release calendar
              </Link>{" "}
              list who takes orders and when it ships.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
