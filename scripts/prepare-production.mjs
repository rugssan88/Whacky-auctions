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
for (const [slug, page] of Object.entries(pages)) {
  const links = page.links.map(([href, label]) => `<a href="${esc(href)}">${esc(label)}</a>`).join(" · ");
  const supportingCopy = `Whacky Auctions uses real item photographs, straightforward condition notes and transparent pricing information. Before bidding, buyers can review the lot description, opening bid, bidding increment, buyer costs, closing time, payment deadline and collection arrangements. Working, untested, worn or incomplete goods are identified plainly so bidders can make an informed decision. The platform is based in Florida, Gauteng and operates for South African buyers in rand.\n+
Late bidding is handled through a fair soft close. When a valid bid arrives during the final two minutes, the closing window returns to a full two minutes so other bidders have time to respond. Published auction rules remain available throughout the process, and customers can contact the team before committing if an item description or collection requirement needs clarification.\n+
Early-access registration and bidder activation are separate steps. Visitors can join for previews and launch news without activating bidding immediately. People who decide to bid can complete the separate verification process from their private account. This keeps browsing simple while protecting the integrity of live auctions.`;
  const fallback = `<div id="app"><header class="topbar"><div class="container nav"><a class="brand" href="/"><span class="brandmark">W</span><span>Whacky Auctions</span></a><nav class="navlinks" aria-label="Primary navigation"><a href="/">Home</a><a href="/auctions">Auctions</a><a href="/how-it-works">How it works</a><a href="/about">About</a><a href="/contact">Contact</a></nav></div></header><main><section class="page-hero"><div class="container"><span class="eyebrow">${esc(page.eyebrow)}</span><h1>${esc(page.heading)}</h1><p>${esc(page.copy)}</p>${supportingCopy.split("\n\n").map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}<p>${links}</p></div></section></main></div>`;
  const html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(page.description)}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="https://www.whackyauctions.co.za/${slug}" />`)
    .replace(/<div id="app">[\s\S]*?<\/div>\s*<div id="toast"/, `${fallback}\n  <div id="toast"`);
  const dir = path.join(publicDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
}

console.log("Production assets minified and crawlable route pages generated.");
