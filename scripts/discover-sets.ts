// Adds every release 2+ stores now sell to data/sets/releases.json (lib/set-discovery.ts has the rules). Run by the sealed import
// AFTER the stores are read and BEFORE the export, so the new release's page ships with the same data commit. Reads two columns of
// the import's own database (Product.setCode, Offer.store); no network. Never fails the import: on an error the file is kept.
process.env.WAXCOMPARE_SCRIPT = "1";

import fs from "node:fs";
import path from "node:path";
import { appendFileSync } from "node:fs";
import { prisma } from "../src/lib/db";
import { mergeReleases } from "../src/lib/set-discovery";
import type { StoredRelease } from "../src/lib/sets";

const FILE = path.join(process.cwd(), "data/sets/releases.json");

async function main() {
  const stored = JSON.parse(fs.readFileSync(FILE, "utf8")) as StoredRelease[];
  const rows = await prisma.offer.findMany({ select: { store: true, product: { select: { setCode: true } } } });
  const storesByCode = new Map<string, Set<string>>();
  for (const r of rows) {
    const code = r.product.setCode;
    if (!code) continue;
    const s = storesByCode.get(code) ?? new Set<string>();
    s.add(r.store);
    storesByCode.set(code, s);
  }
  const today = new Date().toISOString().slice(0, 10);
  const res = mergeReleases(stored, storesByCode, today);
  if (res.added.length) fs.writeFileSync(FILE, `[\n${res.releases.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`);
  const lines = [
    `### Releases: ${res.releases.length} with a page, ${res.added.length} new today`,
    ...res.added.map((r) => `- new: ${r.name} (\`${r.slug}\`)`),
    res.waiting.length ? `- ${res.waiting.length} release(s) at one store only, waiting for a second` : "",
    ...res.unknown.map((c) => `- unreadable or clashing code, not added: \`${c}\``),
  ].filter(Boolean);
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.log(`::warning::Release discovery failed, data/sets/releases.json kept as it was: ${(e as Error).message.slice(0, 200)}`);
  await prisma.$disconnect().catch(() => {});
});
