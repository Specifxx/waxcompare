// One-off store legitimacy QA (2026-11-09). Reads stores-in.json, writes vet-out.json.
import { readFileSync, writeFileSync } from "node:fs";
import tls from "node:tls";
const stores = JSON.parse(readFileSync(process.argv[2] || "scripts/qa/stores-in.json", "utf8"));
const UA = "Mozilla/5.0 (compatible; SportsCardCompareStoreCheck/1.0; +https://sportscardcompare.com)";
async function get(url, t = 15000) {
  try {
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(t), headers: { "User-Agent": UA } });
    return { status: r.status, url: r.url, body: (await r.text().catch(() => "")).slice(0, 3_000_000) };
  } catch (e) { return { status: 0, error: String(e?.cause?.code || e?.name || e) }; }
}
const dom = (h) => { const p = h.replace(/^www\./, "").split("."); const l2 = p.slice(-2).join("."); return p.length > 2 && /^(com|co|net|org)\.[a-z]{2}$/.test(l2) ? p.slice(-3).join(".") : l2; };
let BOOT = null;
const lastHit = {};
async function rdap(d) {
  if (!BOOT) { const b = await get("https://data.iana.org/rdap/dns.json", 15000); try { BOOT = {}; for (const [tlds, urls] of JSON.parse(b.body).services) for (const t of tlds) BOOT[t] = urls[0]; } catch { BOOT = {}; } }
  const tld = d.split(".").pop(); const base = BOOT[tld]; if (!base) return { age: null, note: "no rdap for ." + tld };
  let r;
  for (let a = 0; a < 4; a++) {
    const wait = Math.max(0, (lastHit[base] || 0) + 700 - Date.now()); lastHit[base] = Date.now() + wait; if (wait) await new Promise((x) => setTimeout(x, wait));
    r = await get(`${base.replace(/\/$/, "")}/domain/${d}`, 15000);
    if (r.status !== 429) break; await new Promise((x) => setTimeout(x, 2500 * (a + 1)));
  }
  if (r.status !== 200) return { age: null, note: `rdap ${r.status || r.error}` };
  try {
    const j = JSON.parse(r.body);
    const ev = (j.events || []).find((e) => /registration/i.test(e.eventAction));
    const reg = (j.entities || []).flatMap((e) => (e.roles || []).includes("registrar") ? [e.vcardArray?.[1]?.find((x) => x[0] === "fn")?.[3]] : []).filter(Boolean)[0];
    return { registered: ev?.eventDate?.slice(0, 10) ?? null, age: ev ? Math.floor((Date.now() - Date.parse(ev.eventDate)) / 864e5) : null, registrar: reg };
  } catch { return { age: null, note: "rdap parse" }; }
}
function cert(host) {
  return new Promise((res) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: 8000 }, () => {
      const c = s.getPeerCertificate(); s.end();
      res({ ok: s.authorized, issuer: c.issuer?.O, from: c.valid_from, to: c.valid_to, subject: c.subject?.CN });
    });
    s.on("error", (e) => res({ ok: false, err: e.code || String(e) }));
    s.on("timeout", () => { s.destroy(); res({ ok: false, err: "timeout" }); });
  });
}
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;/g, " ").replace(/\s+/g, " ");
const emails = (b) => [...new Set([...(b.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || [])].filter((e) => !/\.(png|jpg|webp|svg|gif)$|sentry|wixpress|example|shopify|\.js$/i.test(e)))].slice(0, 3);
const phones = (b) => [...new Set(b.match(/(?:tel:)?\+?\d[\d\s().-]{8,16}\d/g) || [])].filter((p) => /tel:|\(\d{3}\)|\+\d|\d{3}[ -]\d{3}[ -]\d{4}|0\d \d{4} \d{4}/.test(p)).slice(0, 2);
async function vet(s) {
  const host = new URL(s.base).host; const d = dom(host);
  const out = { key: s.key, name: s.name, base: s.base, market: s.market, domain: d, inStock: s.inStock };
  const [home, rd, ct] = await Promise.all([get(s.base + "/"), rdap(d), cert(host)]);
  out.homeStatus = home.status || home.error; out.finalHost = home.url ? new URL(home.url).host : null;
  out.whois = rd; out.cert = ct;
  const hb = home.body || "";
  out.title = (hb.match(/<title[^>]*>([^<]*)/i) || [])[1]?.trim().slice(0, 100);
  out.shopify = /cdn\.shopify\.com|Shopify\.shop/.test(hb);
  out.parked = /(for sale|buy this domain|parked|domain has expired|opening soon)/i.test(strip(hb).slice(0, 3000)) && hb.length < 60000;
  out.social = [...new Set((hb.match(/(facebook\.com|instagram\.com|tiktok\.com|youtube\.com|twitter\.com|x\.com|discord\.(?:gg|com))\/[\w.\-/]+/gi) || []).map((x) => x.toLowerCase()).filter((x) => !/sharer|share|tr\?|plugins|intent/.test(x)))].slice(0, 6);
  // policies + contact + about
  const paths = ["/policies/refund-policy", "/policies/shipping-policy", "/policies/terms-of-service", "/pages/contact", "/pages/contact-us", "/pages/about-us", "/pages/about"];
  const pg = await Promise.all(paths.map((p) => get(s.base + p, 12000)));
  out.pages = {}; let text = strip(hb);
  paths.forEach((p, i) => { const r = pg[i]; out.pages[p] = r.status === 200 ? r.body.length : r.status || r.error; if (r.status === 200) text += " " + strip(r.body); });
  out.emails = emails(hb + pg.map((r) => r.body || "").join(" "));
  out.phones = phones(text);
  const addr = text.match(/\d{1,5}\s+[A-Z][\w. ]{2,30}\s(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Dr|Drive|Way|Lane|Ln|Pkwy|Hwy|Court|Ct|Strasse|Straße|Platz)\b[^.]{0,60}/);
  out.address = addr?.[0]?.slice(0, 90) || null;
  out.abn = (text.match(/ABN[:\s]*([\d ]{11,14})/i) || [])[1]?.trim() || null;
  out.policies = pg.slice(0, 3).filter((r) => r.status === 200).length;
  // listing reality: re-read sample products
  out.samples = [];
  for (const x of s.sample) {
    let u = x.url.split("?")[0].split("#")[0];
    const vid = (x.url.match(/variant=(\d+)/) || [])[1];
    const r = await get(u + ".js", 12000);
    let rec = { url: x.url, ourPrice: x.price, status: r.status || r.error };
    if (r.status === 200) { try { const p = JSON.parse(r.body); const v = p.variants.find((v) => String(v.id) === vid) || p.variants[0]; rec.title = p.title; rec.livePrice = v.price; rec.available = v.available; rec.match = v.price === x.price; rec.vfound = String(v.id) === vid; } catch { rec.status = "parse"; } }
    out.samples.push(rec);
  }
  // catalogue size
  const pj = await get(s.base + "/products.json?limit=1", 12000);
  out.productsJson = pj.status;
  return out;
}
const res = []; let i = 0;
await Promise.all(Array.from({ length: 10 }, async () => { while (i < stores.length) { const s = stores[i++]; try { res.push(await vet(s)); } catch (e) { res.push({ key: s.key, base: s.base, error: String(e) }); } if (res.length % 20 === 0) console.log(res.length); } }));
res.sort((a, b) => a.key.localeCompare(b.key));
writeFileSync(process.argv[3] || "scripts/qa/vet-out.json", JSON.stringify(res, null, 1));
console.log("done", res.length);
