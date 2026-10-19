import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const base = "https://www.whackyauctions.co.za";
const template = fs.readFileSync("public/index.html", "utf8");
const tag = template.match(/<script>\s*window.dataLayer[\s\S]*?<\/script>/)[0];
const csp = fs.readFileSync("netlify.toml", "utf8");
const hash = crypto.createHash("sha256").update(tag.replace(/^<script>/, "").replace(/<\/script>$/, "")).digest("base64");
assert.ok(csp.includes(`sha256-${hash}`), "Google tag must match CSP hash");
const sitemap = fs.readFileSync("public/sitemap.xml", "utf8");
const titles = new Set();
for (const slug of ["auctions", "how-it-works", "about", "contact", "join", "legal", "install"]) {
  const html = fs.readFileSync(`public/${slug}/index.html`, "utf8");
  const title = html.match(/<title>(.*?)<\/title>/)[1];
  assert.ok(!titles.has(title)); titles.add(title);
  assert.ok(html.includes(`rel="canonical" href="${base}/${slug}"`), slug);
  assert.ok(html.includes(`property="og:url" content="${base}/${slug}"`), slug);
  assert.ok(html.includes(`property="og:title" content="${title}"`), slug);
  assert.ok(html.includes(`name="twitter:title" content="${title}"`), slug);
  assert.equal((html.match(/<h1>/g) || []).length, 1, slug);
  assert.ok(!html.includes("\n+\n"), slug);
  assert.ok(html.includes(tag), "Google tag must remain unchanged");
  assert.ok(sitemap.includes(`${base}/${slug}</loc>`), slug);
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(match[1]);
}
console.log("SEO checks passed for all seven public routes; Google tag and CSP preserved.");
