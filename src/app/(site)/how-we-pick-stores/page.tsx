import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ReportStore } from "@/components/ReportForms";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { STORES, isMarketplace } from "@/lib/stores";

export const metadata: Metadata = {
  title: "How we choose stores",
  description: `How ${SITE_NAME} finds and checks the shops it lists, what we checked on 9 November 2026, and how to report one.`,
  alternates: { canonical: `${SITE_URL}/how-we-pick-stores` },
};

const h2 = { fontSize: "1.25rem", fontWeight: 700, margin: "28px 0 8px" } as const;
const ul = { paddingLeft: 20, margin: "8px 0", lineHeight: 1.6 } as const;
const p = { margin: "8px 0", lineHeight: 1.6 } as const;

export default function HowWePick() {
  const real = STORES.filter((s) => !isMarketplace(s));
  const names = real.map((s) => s.name);
  return (
    <div className="page max-w-3xl py-12">
      <Breadcrumbs items={[{ href: "/", label: SITE_NAME }, { label: "How we choose stores" }]} />
      <div className="prose-dex mt-6" style={{ maxWidth: 720 }}>
        <h1 style={{ fontSize: "1.9rem", fontWeight: 800, margin: "8px 0 12px" }}>How we choose stores</h1>
        <p style={p}>
          Fair question, and worth a straight answer: many of the shops here are small independent card shops you won&apos;t have heard of.
          Here is exactly how they got on the site, what we checked, and what we can and can&apos;t promise.
        </p>

        <h2 style={h2}>How shops get found</h2>
        <p style={p}>
          We didn&apos;t pick them by hand. A script looked for online shops that sell sealed sports cards (boxes, blasters, packs) and that run
          a standard, public store front, then kept the ones whose listings we could read exactly. That is why the list is long and includes
          local card shops rather than the famous big names. A shop being on the list was never a recommendation.
        </p>

        <h2 style={h2}>What we checked on 9 November 2026</h2>
        <p style={p}>
          After a visitor asked whether the cheaper shops were real, we went through all {real.length + 9} shops one by one, from the outside, the way
          a careful buyer would:
        </p>
        <ul style={ul}>
          <li><strong>The site works and is secure.</strong> It loads, with a valid HTTPS certificate, and isn&apos;t parked, for sale or closed.</li>
          <li><strong>It is a business you can reach.</strong> A contact email or phone number, and its own refund and shipping policies. Most also show a street address for a real shop or warehouse.</li>
          <li><strong>It isn&apos;t brand new.</strong> We looked up when each domain was registered. Where it was readable, most were registered more than a year ago and many more than five; a handful are younger and are listed only because they show a street address, a phone number and full policies.</li>
          <li><strong>The listings are real.</strong> We re-opened the cheapest in-stock products of every shop on the shop&apos;s own pages and compared price and stock. Almost all were genuinely in stock.</li>
          <li><strong>The prices aren&apos;t too good to be true.</strong> No shop was consistently far below the others; the cheapest shops are typically 3 to 15 percent under the middle price, not 50 percent. Prices well under what the other shops charge are dropped automatically.</li>
        </ul>
        <p style={p}>
          <strong>Result:</strong> {real.length} shops passed. We removed nine we couldn&apos;t verify: shops with no email or phone and no policies, shops without
          a domain of their own, and one where the cheapest products were sold out. None of them is accused of anything. They can come back when they
          show their contact details and policies.
        </p>

        <h2 style={h2}>What we can&apos;t promise</h2>
        <ul style={ul}>
          <li>We haven&apos;t placed an order with every shop. Passing these checks means a shop is a real, reachable business, not that it will never have a slow delivery.</li>
          <li>Review sites such as Trustpilot can&apos;t be read automatically, so reviews are a hand check we do for the shops people click on most. Many small shops simply have few online reviews.</li>
          <li>Some shop domains (for example .de, .it and .nz) don&apos;t publish a registration date, so we couldn&apos;t check their age that way.</li>
        </ul>

        <h2 style={h2}>After a shop is listed</h2>
        <ul style={ul}>
          <li>Prices and stock are read from each shop&apos;s own store front every day. A shop that stops answering drops off.</li>
          <li>No shop pays to be listed or to rank higher. Shops are always sorted by price.</li>
          <li>eBay and Amazon rows are marketplaces, not shops: they are labelled, kept apart and never counted as a store. We don&apos;t vet individual sellers there, so check a seller&apos;s feedback before you buy.</li>
          <li>A shop that is reported and turns out to be a problem is removed and banned.</li>
        </ul>

        <h2 style={h2}>Report a store</h2>
        <p style={p}>
          Had a problem with a shop we list, or does one look wrong to you? Tell us here, no account needed. Know a good shop we are missing?{" "}
          <a href="/contact#suggest" style={{ textDecoration: "underline" }}>Suggest it</a>.
        </p>
        <ReportStore stores={names} buttonClassName="btn-primary" />

        <h2 style={h2}>Before you buy anywhere</h2>
        <ul style={ul}>
          <li>Pay by card or PayPal, which let you dispute a charge. Be wary of a shop that only takes bank transfer or crypto.</li>
          <li>A price far under every other shop is a warning sign, not a bargain.</li>
          <li>For a big order, look the shop up on Trustpilot or Google and read its contact page and policies first.</li>
        </ul>
      </div>
    </div>
  );
}
