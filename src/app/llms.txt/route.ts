import { GUIDES, guideRegions } from "@/content/guides";
import { TOOLS } from "@/content/tools";
import { REGION_LIST, X_DEFAULT_REGION } from "@/lib/regions";
import { TRADEMARK_DISCLAIMER, SECTION_PATHS, SITE_NAME, SITE_URL } from "@/lib/site";
import { SETS } from "@/lib/sets";
import { STORES } from "@/lib/stores";

// /llms.txt (llmstxt.org): a plain map of the site for AI answer engines, as RiftCompare
// publishes, so "where do I compare hobby box prices" can be answered with a
// link here. Constants only (no database): built once per deploy.
export const dynamic = "force-static";

export function GET() {
  const d = X_DEFAULT_REGION;
  const u = (p: string) => `${SITE_URL}/${d}${p}`;
  const sets = SETS.filter((s) => !s.generic).sort((a, b) => b.releaseDate.localeCompare(a.releaseDate)).slice(0, 30);
  const md = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_NAME} is a free price comparison site for sealed sports cards (hobby, jumbo, mega, blaster and hanger boxes, cases and packs of baseball, basketball, football, soccer, hockey, F1 and more). It reads ${STORES.length} independent card shops in ${REGION_LIST.length} regions (${REGION_LIST.map((r) => r.region.toUpperCase()).join(", ")}) about twice a day and lists every product's offers in stock first, cheapest first, in the region's own currency. No account needed.`,
    "",
    "## Regions",
    ...REGION_LIST.map((r) => `- [${r.name}](${SITE_URL}/${r.region})`),
    "",
    "## Main pages (US shown; every region has the same paths)",
    `- [All sealed products](${u(SECTION_PATHS.sealed)})`,
    `- [Hobby box prices](${u(SECTION_PATHS.hobbyBoxes)})`,
    `- [Jumbo box prices](${u(SECTION_PATHS.jumboBoxes)})`,
    `- [Mega box prices](${u(SECTION_PATHS.megaBoxes)})`,
    `- [Blaster box prices](${u(SECTION_PATHS.blasterBoxes)})`,
    `- [Hobby case prices](${u(SECTION_PATHS.hobbyCases)})`,
    `- [Deals](${u(SECTION_PATHS.deals)})`,
    `- [Price moves](${u(SECTION_PATHS.priceMoves)})`,
    `- [Releases](${u(SECTION_PATHS.sets)}) and the [release calendar](${u(SECTION_PATHS.releases)})`,
    `- [About and methodology](${SITE_URL}/about)`,
    "",
    "## Releases (sealed prices per release)",
    ...sets.map((s) => `- [${s.name}](${u(`/sets/${s.slug}`)})`),
    "",
    "## Tools",
    ...TOOLS.map((t) => `- [${t.title}](${u(`/tools/${t.slug}`)}): ${t.description}`),
    "",
    "## Guides",
    ...GUIDES.map((g) => {
      const r = guideRegions(g).includes(d) ? d : guideRegions(g)[0];
      return `- [${g.title}](${SITE_URL}/${r}/guides/${g.slug}): ${g.description}`;
    }),
    "",
    "## Legal",
    TRADEMARK_DISCLAIMER,
    "",
  ].join("\n");
  return new Response(md, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
