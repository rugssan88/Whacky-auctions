import fs from "node:fs";
import path from "node:path";
import { transform } from "esbuild";

const root = process.cwd();
const publicDir = path.join(root, "public");

async function minify(source, target, loader) {
  const input = fs.readFileSync(path.join(publicDir, source), "utf8");
  const result = await transform(input, { loader, minify: true, target: loader === "js" ? "es2020" : undefined });
  fs.writeFileSync(path.join(publicDir, target), result.code);
}

await Promise.all([
  minify("app.js", "app.min.js", "js"),
  minify("styles.css", "styles.min.css", "css"),
  minify("sw.js", "sw.min.js", "js"),
]);

const template = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
const pages = {
  auctions: {
    title: "Auctions | Whacky Auctions South Africa",
    description: "Browse live, upcoming and preview auction items with real photos, clear condition notes and transparent opening bids.",
    eyebrow: "Marketplace",
    heading: "South African online auctions",
    copy: "Browse useful goods, unusual finds and second-hand treasures with real item photos and straightforward condition notes. Published lots show their opening bid, bidding increment, closing time, buyer costs and collection requirements before bidding begins.",
    links: [["/how-it-works", "See how bidding works"], ["/join", "Join early access"]],
  },
  "how-it-works": {
    title: "How It Works | Whacky Auctions",
    description: "Understand bidder activation, fair soft-close bidding, secure payment and collection at Whacky Auctions.",
    eyebrow: "Simple, transparent bidding",
    heading: "How Whacky Auctions works",
    copy: "Review the actual item photos, condition notes, opening bid and collection details before bidding. Activated bidders can place bids while a lot is open. A valid bid in the final two minutes restores the full two-minute window, giving everyone a fair chance to respond. Winning bidders then follow the displayed secure payment and collection instructions.",
    links: [["/auctions", "Browse auctions"], ["/legal", "Read the auction rules"]],
  },
  about: {
    title: "About Whacky Auctions | Florida, Gauteng",
    description: "Meet Whacky Auctions, a proudly South African online auction platform built around honest descriptions and fair bidding.",
    eyebrow: "Proudly South African",
    heading: "About Whacky Auctions",
    copy: "Whacky Auctions is based in Florida, Gauteng and was built to make online auctions exciting without becoming confusing. We favour honesty over hype: real photographs, clear condition disclosures and rules that remain easy to find. Our goal is a friendly, professional auction room for South African buyers.",
    links: [["/how-it-works", "How it works"], ["/contact", "Contact us"]],
  },
  contact: {
    title: "Contact Whacky Auctions",
    description: "Contact Whacky Auctions about auction items, accounts, payments, collection, POPIA or PAIA enquiries.",
    eyebrow: "Customer support",
    heading: "Contact Whacky Auctions",
    copy: "For questions about an item, your account, payment, collection, POPIA or PAIA, email info@whackyauctions.co.za. Include the auction title or lot reference where relevant so the team can help efficiently. Whacky Auctions operates from Florida, Gauteng, South Africa.",
    links: [["mailto:info@whackyauctions.co.za", "Email Whacky Auctions"], ["/auctions", "Browse auctions"]],
  },
  join: {
    title: "Join Whacky Auctions Early Access",
    description: "Join the Whacky Auctions early-access list for first looks, launch alerts and upcoming online auctions in South Africa.",
    eyebrow: "Early access",
    heading: "Get first looks and launch alerts",
    copy: "Join the early-access list to hear about upcoming Whacky Auctions lots and launch updates. Early-access registration is separate from bidder activation, so you can browse previews and receive news without completing bidder verification until you decide to bid.",
    links: [["/auctions", "Browse previews"], ["/how-it-works", "Understand the process"]],
  },
  legal: {
    title: "Whacky Auctions Legal Centre | Rules & Buyer Information",
    description: "Read Whacky Auctions terms, auction rules, privacy information and buyer guidance.",
    eyebrow: "Trust and compliance",
    heading: "Whacky Auctions legal centre",
    copy: "Review the privacy policy, platform terms and master auction rules before bidding. Each published auction also provides its specific opening bid, increment, buyer costs, closing time, condition, payment deadline and collection requirements. Mandatory South African legal protections continue to apply.",
    links: [["/legal/privacy-policy.pdf", "Privacy policy"], ["/legal/terms-auction-rules.pdf", "Terms and auction rules"]],
  },
  install: {
    title: "Install the Whacky Auctions App",
    description: "Install Whacky Auctions on Android, iPhone or desktop for quick access to South African online auctions.",
    eyebrow: "Mobile access",
    heading: "Install Whacky Auctions",
    copy: "Whacky Auctions can be installed from a supported browser as a web app for quick access to auction previews, account features and bidding. Android users can use Chrome's Install app option. On iPhone or iPad, open the site in Safari and choose Add to Home Screen.",
    links: [["/auctions", "Browse auctions"], ["/contact", "Get help"]],
  },
};

const esc = (value) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const routeDetails = {
  auctions: ["Auction previews are a first look at items being prepared for sale. A preview is not an open auction: check the individual lot status before attempting to bid. Review the photographs and condition notes, and contact the team if you need more information about an item."],
  "how-it-works": ["Start by browsing previews or joining early access. Early-access registration does not activate bidding. Bidder verification is a separate step in your account when you choose to take part.", "Before placing a bid, read the lot-specific rules, buyer costs and collection arrangements. A winning bidder must follow the payment deadline and instructions shown for that auction. Courier arrangements and costs should be checked before bidding."],
  about: ["The platform focuses on second-hand goods and unusual finds, with an emphasis on showing the actual item rather than stock photography. Condition notes distinguish tested items from untested or incomplete goods.", "Whacky Auctions is an online business based in Florida, Gauteng. Browse the auction previews to see the range of goods, or contact the team with questions before deciding whether to register."],
  contact: ["For an item enquiry, include the item name and the detail you want confirmed. For account or payment support, describe the problem without sending passwords, full card details or other sensitive credentials by email.", "Collection and viewing arrangements depend on the individual lot. Please confirm arrangements with the team before travelling."],
  join: ["Early access is for people who want launch updates and a first look at upcoming items. Joining does not commit you to buying an item or placing a bid.", "Browse the previews and read how bidding works while you wait for launch updates. Auction availability and bidder activation are separate from joining the early-access list."],
  legal: ["Check both the platform terms and the rules attached to an individual auction. Lot-specific information covers the item condition, opening bid, closing time, buyer costs and collection arrangements.", "Privacy enquiries can be sent to the team using the Contact page. Read the privacy policy for information about personal data before registering."],
  install: ["On Android, open the website in Chrome and use the browser menu to look for Install app or Add to Home screen. On iPhone or iPad, use Safari's Share menu and choose Add to Home Screen.", "Installation is optional: the website also works in your browser. An installed shortcut does not change your account status or activate bidding."],
};
for (const [slug, page] of Object.entries(pages)) {
  const links = page.links.map(([href, label]) => `<a href="${esc(href)}">${esc(label)}</a>`).join(" · ");
  const supportingCopy = routeDetails[slug].join("\n\n");
  const fallback = `<div id="app"><header class="topbar"><div class="container nav"><a class="brand" href="/"><span class="brandmark">W</span><span>Whacky Auctions</span></a><nav class="navlinks" aria-label="Primary navigation"><a href="/">Home</a><a href="/auctions">Auctions</a><a href="/how-it-works">How it works</a><a href="/about">About</a><a href="/contact">Contact</a></nav></div></header><main><section class="page-hero"><div class="container"><span class="eyebrow">${esc(page.eyebrow)}</span><h1>${esc(page.heading)}</h1><p>${esc(page.copy)}</p>${supportingCopy.split("\n\n").map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}<p>${links}</p></div></section></main></div>`;
  const cleanFallback = fallback.replace(supportingCopy.split("\n\n").map((paragraph) => `<p>${esc(paragraph)}</p>`).join(""), routeDetails[slug].map((paragraph) => `<p>${esc(paragraph)}</p>`).join(""));
  const canonical = `https://www.whackyauctions.co.za/${slug}`;
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(page.description)}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="https://www.whackyauctions.co.za/${slug}" />`)
    .replace(/<div id="app">[\s\S]*?<\/div>\s*<div id="toast"/, `${cleanFallback}\n  <div id="toast"`);
  for (const [attribute, key, value] of [
    ["property", "og:title", page.title], ["property", "og:description", page.description],
    ["property", "og:url", canonical], ["name", "twitter:title", page.title],
    ["name", "twitter:description", page.description],
  ]) {
    html = html.replace(new RegExp(`<meta ${attribute}="${key}" content="[^"]*" \\/>`), `<meta ${attribute}="${key}" content="${esc(value)}" />`);
  }
  // Keep route identity available without JavaScript; preserve the Google tag verbatim.
  const schema = { "@context": "https://schema.org", "@type": slug === "about" ? "AboutPage" : slug === "contact" ? "ContactPage" : "WebPage", "@id": `${canonical}#webpage`, url: canonical, name: page.title, description: page.description, isPartOf: { "@id": "https://www.whackyauctions.co.za/#website" } };
  html = html.replace("</head>", `<script type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script>\n</head>`);
  const dir = path.join(publicDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
}

console.log("Production assets minified and crawlable route pages generated.");
