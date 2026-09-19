const SITE = "https://www.whackyauctions.co.za";

const esc = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const json = (value: unknown) => JSON.stringify(value).replaceAll("<", "\\u003c");

function replaceMeta(html: string, selector: string, tag: string) {
  const pattern = new RegExp(`<meta\\s+[^>]*${selector}=["'][^"']+["'][^>]*>`, "i");
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `${tag}\n</head>`);
}

export default async (request: Request, context: any) => {
  const url = new URL(request.url);
  const headers = { "Cache-Control": "public, max-age=0, must-revalidate", "Netlify-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" };

  if (url.pathname === "/sitemap.xml") {
    const response = await fetch(`${url.origin}/api/auctions`);
    const data = response.ok ? await response.json() : { auctions: [] };
    const fixed = ["/", "/auctions", "/how-it-works", "/about", "/contact", "/join", "/legal", "/install"];
    const lots = (data.auctions || []).map((a: any) => `/auction/${encodeURIComponent(a.slug || a.id)}`);
    const urls = [...fixed, ...lots].map((path) => `  <url><loc>${SITE}${path}</loc><changefreq>${path.startsWith("/auction/") ? "daily" : "weekly"}</changefreq></url>`).join("\n");
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`, { headers: { ...headers, "Content-Type": "application/xml; charset=utf-8" } });
  }

  const match = url.pathname.match(/^\/auction\/([^/]+)\/?$/);
  if (!match) return context.next();
  const apiResponse = await fetch(`${url.origin}/api/auctions/${encodeURIComponent(decodeURIComponent(match[1]))}`);
  if (!apiResponse.ok) return context.next();
  const { auction: a } = await apiResponse.json();
  if (!a || a.status === "draft") return context.next();

  const canonical = `${SITE}/auction/${encodeURIComponent(a.slug || a.id)}`;
  const title = `${a.title} | Whacky Auctions`;
  const description = `${a.condition}. ${a.description || "View this South African auction item."}`.replace(/\s+/g, " ").slice(0, 158);
  const rawImage = a.images?.[0]?.url || "/previews/printer-bundle-1.webp";
  const image = `${SITE}/.netlify/images?url=${encodeURIComponent(rawImage)}&w=1200&h=630&fit=cover&q=82`;
  const page = await context.next();
  let html = await page.text();
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(title)}</title>`);
  html = html.replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${esc(canonical)}" />`);
  const metas = [
    ['name="description"', `<meta name="description" content="${esc(description)}" />`],
    ['property="og:title"', `<meta property="og:title" content="${esc(title)}" />`],
    ['property="og:description"', `<meta property="og:description" content="${esc(description)}" />`],
    ['property="og:url"', `<meta property="og:url" content="${esc(canonical)}" />`],
    ['property="og:type"', '<meta property="og:type" content="product" />'],
    ['property="og:image"', `<meta property="og:image" content="${esc(image)}" />`],
    ['property="og:image:alt"', `<meta property="og:image:alt" content="${esc(a.title)}" />`],
    ['name="twitter:title"', `<meta name="twitter:title" content="${esc(title)}" />`],
    ['name="twitter:description"', `<meta name="twitter:description" content="${esc(description)}" />`],
    ['name="twitter:image"', `<meta name="twitter:image" content="${esc(image)}" />`],
  ];
  for (const [selector, tag] of metas) html = replaceMeta(html, selector, tag);
  const schema = {
    "@context": "https://schema.org", "@type": "Product", name: a.title,
    description, image: a.images?.map((x: any) => `${SITE}${x.url}`) || [],
    itemCondition: "https://schema.org/UsedCondition",
    offers: { "@type": "Offer", url: canonical, priceCurrency: "ZAR", price: ((a.currentBidCents ?? a.openingBidCents) / 100).toFixed(2), priceValidUntil: a.currentEndAt, availability: ["closed", "unsold"].includes(a.status) ? "https://schema.org/OutOfStock" : "https://schema.org/PreOrder" },
  };
  html = html.replace("</head>", `<script type="application/ld+json">${json(schema)}</script>\n</head>`);
  return new Response(html, { status: page.status, headers: { ...Object.fromEntries(page.headers), ...headers, "Content-Type": "text/html; charset=utf-8" } });
};

export const config = { path: ["/auction/*", "/sitemap.xml"] };
