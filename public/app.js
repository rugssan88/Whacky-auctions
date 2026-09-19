const state = {
  me: null,
  settings: {},
  auctions: [],
  serverOffset: 0,
  deferredInstall: null,
  adminTab: "overview",
  editingAuction: null,
  quickPhotos: [],
  quickPhotoKey: null,
  quickOriginalImageIds: [],
  quickSavedAuction: null,
  lastTrackedPath: null,
};
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
const randMoney = (c) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    Number(c || 0) / 100,
  );
const fmtDate = (d) =>
  new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));
const now = () => Date.now() + state.serverOffset;
const optimisedImage = (url, width, height = 0, fit = "cover") => {
  if (!url || String(url).startsWith("blob:")) return url;
  const p = new URLSearchParams({ url: String(url), w: String(width), fit, q: "82" });
  if (height) p.set("h", String(height));
  return `/.netlify/images?${p}`;
};
const PREVIEW_ITEMS = [
  {
    title: "Printer & craft-printing bundle",
    category: "Creative equipment",
    condition: "A colourful setup for personalised gifts and crafts—printer, press, inks, blanks and designs included as pictured. Untested.",
    openingBidCents: 90000,
    images: ["/previews/printer-bundle-1.webp", "/previews/printer-bundle-2.webp"],
  },
  {
    title: "Pair of decorative copper pots",
    category: "Home & décor",
    condition: "A striking handled copper pair with loads of old-school charm. Visible age marks and interior oxidation/patina; sold as pictured.",
    openingBidCents: 48000,
    images: ["/previews/copper-pots-1.webp", "/previews/copper-pots-2.webp"],
  },
  {
    title: "Nesty GR55 TWS portable speaker",
    category: "Audio",
    condition: "Portable boombox with carry handle plus USB, AUX and TF inputs. Tested and working, with visible cosmetic marks.",
    openingBidCents: 18000,
    images: ["/previews/nesty-speaker-1.webp", "/previews/nesty-speaker-2.webp"],
  },
  {
    title: "Nike Tiempo-branded football boots",
    category: "Sport",
    condition: "Bold red-and-black football boots for the next kick-about. Used with creasing and sole/stud wear; authenticity not independently verified.",
    openingBidCents: 20000,
    images: ["/previews/nike-tiempo-1.webp", "/previews/nike-tiempo-2.webp"],
  },
  {
    title: "Kaufmann 16L backpack sprayer",
    category: "Garden & outdoor",
    condition: "Handy 16L backpack sprayer with hose, wand and straps for garden or property work. Used with surface marks; untested.",
    openingBidCents: 12000,
    images: ["/previews/kaufmann-sprayer-1.webp", "/previews/kaufmann-sprayer-2.webp"],
  },
];
function previewCard(item) {
  return `<article class="card preview-card">
    <div class="preview-images">${item.images.map((src, i) => `<img loading="lazy" src="${esc(optimisedImage(src, 520, 390))}" alt="${esc(item.title)} — view ${i + 1}">`).join("")}<span class="chip preview-chip">Sneak peek</span></div>
    <div class="card-body"><div class="label">${esc(item.category)}</div><h3 class="card-title">${esc(item.title)}</h3><p class="preview-condition">${esc(item.condition)}</p><div class="preview-bid"><span>Bidding set to start at</span><strong>${randMoney(item.openingBidCents)}</strong></div><div class="preview-status">Coming to Whacky · Not open for bidding</div></div>
  </article>`;
}
function toast(msg, error = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast show" + (error ? " error" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = "toast"), 3600);
}
async function api(path, opt = {}) {
  const o = { credentials: "include", ...opt };
  if (o.body && !(o.body instanceof FormData) && typeof o.body !== "string") {
    o.headers = { ...(o.headers || {}), "content-type": "application/json" };
    o.body = JSON.stringify(o.body);
  }
  const r = await fetch("/api/" + path.replace(/^\//, ""), o);
  const ct = r.headers.get("content-type") || "";
  const data = ct.includes("json") ? await r.json() : await r.text();
  if (!r.ok)
    throw Object.assign(
      new Error(data?.error || data || `Request failed (${r.status})`),
      { status: r.status, data },
    );
  return data;
}
function recordPageView() {
  const path = location.pathname || "/";
  if (path.startsWith("/admin") || state.lastTrackedPath === path) return;
  state.lastTrackedPath = path;
  const body = JSON.stringify({ path });
  if (navigator.sendBeacon) navigator.sendBeacon("/api/page-view", new Blob([body], { type: "application/json" }));
  else fetch("/api/page-view", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
}
function trackFunnel(event) {
  const body = JSON.stringify({ event, path: location.pathname || "/" });
  if (navigator.sendBeacon) navigator.sendBeacon("/api/funnel-event", new Blob([body], { type: "application/json" }));
  else fetch("/api/funnel-event", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
}
function setServerTime(s) {
  if (s) state.serverOffset = new Date(s).getTime() - Date.now();
}
async function bootstrap() {
  try {
    const d = await api("bootstrap");
    state.me = d.me;
    state.settings = d.settings;
    setServerTime(d.serverTime);
  } catch (e) {
    console.error(e);
  }
  render();
}
function route() {
  return location.pathname.replace(/^\/|\/$/g, "") || "home";
}
function go(path) {
  closeModal();
  history.pushState({}, "", path.startsWith("/") ? path : "/" + path);
  render();
  scrollTo({ top: 0, behavior: "smooth" });
}
const SEO_BASE = "https://www.whackyauctions.co.za";
function seoMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    document.head.appendChild(el);
  }
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
}
function applySeo(r) {
  if (location.pathname.replace(/\/$/, "") === "/join") r = "join";
  const pages = {
    home: {
      title: "Whacky Auctions | Online Auctions South Africa",
      description: "Browse honest online auctions in South Africa with real item photos, clear condition notes, sensible opening bids and a fair two-minute soft close.",
      path: "/",
    },
    auctions: {
      title: "Auctions | Whacky Auctions South Africa",
      description: "Browse live, upcoming and completed Whacky Auctions lots with real photos and clear condition notes.",
      path: "/auctions",
    },
    "how-it-works": {
      title: "How It Works | Whacky Auctions",
      description: "Understand bidder verification, fair soft-close bidding, secure payment and collection at Whacky Auctions.",
      path: "/how-it-works",
    },
    about: {
      title: "About Whacky Auctions | Florida, Gauteng",
      description: "Meet Whacky Auctions, a proudly South African online auction platform built around honest descriptions and fair bidding.",
      path: "/about",
    },
    contact: {
      title: "Contact Whacky Auctions",
      description: "Contact Whacky Auctions for help with items, accounts, payments, collections, POPIA or PAIA enquiries.",
      path: "/contact",
    },
    account: {
      title: "My Account | Whacky Auctions",
      description: "Manage your Whacky Auctions bids, watchlist, wins, profile and bidder status.",
      path: "/account",
    },
    join: {
      title: "Join Whacky Auctions Early Access",
      description: "Join the Whacky Auctions early-access list for first looks, launch alerts and upcoming online auctions in South Africa.",
      path: "/join",
    },
    legal: {
      title: "How Whacky Auctions Works | Rules & Buyer Information",
      description: "Learn how Whacky Auctions works, including honest condition disclosures, bidding, soft-close rules, payments and collection in South Africa.",
      path: "/legal",
    },
    install: {
      title: "Install the Whacky Auctions App",
      description: "Install Whacky Auctions on Android, iPhone or desktop for quick access to upcoming South African online auctions.",
      path: "/install",
    },
  };
  const privateRoute = ["admin", "admin-setup", "my-bids", "watchlist", "wins", "profile", "verify-bidder"].includes(r) || r.startsWith("rules/");
  const page = pages[r] || (r.startsWith("auction/") && state.seoAuction
    ? state.seoAuction
    : {
        title: "Whacky Auctions",
        description: "South African online auctions with real photos and honest condition notes.",
        path: location.pathname,
      });
  const canonical = SEO_BASE + page.path;
  document.title = page.title;
  seoMeta('meta[name="description"]', { name: "description", content: page.description });
  seoMeta('meta[name="robots"]', { name: "robots", content: privateRoute ? "noindex,nofollow" : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" });
  const canonicalLink = document.head.querySelector('link[rel="canonical"]');
  if (canonicalLink) canonicalLink.href = canonical;
  seoMeta('meta[property="og:title"]', { property: "og:title", content: page.title });
  seoMeta('meta[property="og:description"]', { property: "og:description", content: page.description });
  seoMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
  seoMeta('meta[property="og:type"]', { property: "og:type", content: r.startsWith("auction/") ? "product" : "website" });
  seoMeta('meta[name="twitter:title"]', { name: "twitter:title", content: page.title });
  seoMeta('meta[name="twitter:description"]', { name: "twitter:description", content: page.description });
  if (r.startsWith("auction/") && state.seoAuction?.image) {
    const socialImage = SEO_BASE + optimisedImage(state.seoAuction.image, 1200, 630);
    seoMeta('meta[property="og:image"]', { property: "og:image", content: socialImage });
    seoMeta('meta[property="og:image:alt"]', { property: "og:image:alt", content: state.seoAuction.title.replace(" | Whacky Auctions", "") });
    seoMeta('meta[name="twitter:image"]', { name: "twitter:image", content: socialImage });
  }
}
window.addEventListener("popstate", () => {
  closeModal();
  render();
});
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-link]");
  if (a) {
    e.preventDefault();
    go(a.getAttribute("href") || a.dataset.link);
  }
});
function countdown(end, status) {
  if (["closed", "unsold", "cancelled"].includes(status))
    return status === "closed"
      ? "Ended · sold"
      : status === "unsold"
        ? "Ended · unsold"
        : "Cancelled";
  const diff = new Date(end).getTime() - now();
  if (diff <= 0) return "Closing…";
  const s = Math.floor(diff / 1000),
    d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}
function statusChip(a) {
  const status = (a.status || "").toLowerCase();
  const text =
    status === "live"
      ? "Live now"
      : status === "scheduled"
        ? "Upcoming"
        : status === "closed"
          ? "Sold"
          : status === "unsold"
            ? "Unsold"
            : status;
  return `<span class="chip ${status}">${esc(text)}</span>`;
}
function card(a) {
  const img = a.images?.[0]?.url;
  const bid = a.currentBidCents == null ? a.openingBidCents : a.currentBidCents;
  const label = a.currentBidCents == null ? "Opening bid" : "Current bid";
  return `<article class="card auction-card" data-link="/auction/${esc(a.slug || a.id)}">
  <div class="card-img">${img ? `<img loading="lazy" src="${esc(optimisedImage(img, 720, 520))}" alt="${esc(a.images[0].alt || a.title)}">` : ""}${statusChip(a)}</div>
  <div class="card-body"><div class="label">${esc(a.category)}</div><h3 class="card-title">${esc(a.title)}</h3>
    <div class="card-meta"><div><div class="label">${label}</div><div class="price">${randMoney(bid)}</div></div><div class="right"><div class="label">${a.status === "scheduled" ? "Starts" : "Time left"}</div><div class="countdown" data-countdown="${esc(a.currentEndAt)}" data-status="${esc(a.status)}">${a.status === "scheduled" ? fmtDate(a.startAt) : countdown(a.currentEndAt, a.status)}</div></div></div>
  </div></article>`;
}
function header() {
  return `<header class="topbar"><div class="container nav"><a class="brand" href="/" data-link><span class="brandmark">W</span><span>Whacky Auctions</span></a>
<nav class="navlinks"><a href="/" data-link>Home</a><a href="/auctions" data-link>Auctions</a><a href="/how-it-works" data-link>How it works</a><a href="/about" data-link>About</a><a href="/contact" data-link>Contact</a>${state.me?.role === "admin" ? '<a href="/admin" data-link>Admin</a>' : ""}${state.me ? `<a class="nav-account" href="/account" data-link>${esc(state.me.firstName)}’s account</a>` : '<a class="nav-join" href="/join" data-link>Join early access</a><button id="loginBtn">Sign in</button>'}</nav>
<button class="btn btn-secondary mobile-menu" id="mobileBtn" aria-label="Open navigation">Menu</button></div></header>`;
}
function footer() {
  return `<footer class="footer"><div class="container footer-grid"><div><div class="brand"><span class="brandmark">W</span><span>Whacky Auctions</span></div><p class="muted small">A proudly South African auction room. Lekker goods, honest notes and no funny business.</p><p class="small">Whacky Auctions PTY LTD · Florida, Gauteng</p></div><div><b>Explore</b><a href="/" data-link>Home</a><a href="/auctions" data-link>Auctions</a><a href="/how-it-works" data-link>How it works</a><a href="/about" data-link>About us</a></div><div><b>Help & account</b><a href="/contact" data-link>Contact us</a><a href="/join" data-link>Early access</a><a href="/account" data-link>My account</a><a href="/install" data-link>Install the app</a></div><div><b>Trust & legal</b><a href="/legal" data-link>Legal centre</a><a href="/legal/privacy-policy.pdf" target="_blank">Privacy Policy</a><a href="/legal/terms-auction-rules.pdf" target="_blank">Terms & Auction Rules</a><a href="https://pay.yoco.com/whacky-auctions" target="_blank" rel="noopener">Secure payments by Yoco ↗</a></div></div><div class="container footer-bottom"><span>© ${new Date().getFullYear()} Whacky Auctions</span><a href="mailto:info@whackyauctions.co.za">info@whackyauctions.co.za</a></div></footer>`;
}
async function loadAuctions() {
  const d = await api("auctions");
  state.auctions = d.auctions;
  setServerTime(d.serverTime);
  return d.auctions;
}
async function home() {
  let auctions = [];
  try { auctions = await loadAuctions(); } catch {}
  const featured = auctions.filter((a) => ["live", "scheduled"].includes(a.status)).slice(0, 3);
  return `${header()}<main>
<section class="hero professional-hero"><div class="container hero-grid"><div><span class="eyebrow">🇿🇦 Online auctions, made properly for Mzansi</span><h1>Good finds.<br><span class="grad">Fair bidding. No nonsense.</span></h1><p>Browse useful, unusual and properly described goods with real photos, transparent condition notes and a fair two-minute soft close.</p><div class="hero-actions"><a class="btn btn-primary" href="/auctions" data-link>Browse auctions</a><a class="btn btn-secondary" href="/how-it-works" data-link>See how it works</a></div><div class="hero-proof"><span>✓ Honest condition notes</span><span>✓ Secure Yoco payments</span><span>✓ South African support</span></div></div><aside class="launch-card"><div class="fair-icon">🔨</div><div><div class="label">Whacky, not dodgy</div><h3>Auction excitement without the funny business.</h3><div class="mini">Clear rules, sensible opening bids and enough time to answer a late bid before the hammer drops.</div></div><a class="softclose home-card-link" href="/join" data-link><b>Join early access</b><div class="mini">Get launch alerts and first looks.</div></a></aside></div></section>
<section class="how-strip" aria-label="Whacky Auctions promises"><div class="container steps"><div><span>01</span><b>Real photos</b><small>See the actual item you are bidding on.</small></div><div><span>02</span><b>Straight-up notes</b><small>Condition disclosed without sales talk.</small></div><div><span>03</span><b>Fair soft close</b><small>No last-second sniping nonsense.</small></div></div></section>
<section class="section"><div class="container"><div class="section-head"><div><div class="label">Featured</div><h2>${featured.length ? "Auctions worth a look" : "A taste of what’s coming"}</h2></div><a class="text-link" href="/auctions" data-link>View all auctions →</a></div>${featured.length ? `<div class="grid">${featured.map(card).join("")}</div>` : `<div class="grid preview-grid home-preview-grid">${PREVIEW_ITEMS.slice(0, 3).map(previewCard).join("")}</div>`}</div></section>
<section class="section home-trust"><div class="container trust-grid"><div><div class="label">Built for trust</div><h2>Know the rules before you bid.</h2><p>We separate the exciting part from the important part. Payments, collection, condition and soft-close rules are easy to find before you commit.</p><a class="btn btn-secondary" href="/legal" data-link>Open legal centre</a></div><div class="panel trust-list"><div><b>Clear costs</b><span>Opening bids, increments and buyer premiums are shown upfront.</span></div><div><b>Protected bidding time</b><span>Late bids restore the full closing window.</span></div><div><b>Real support</b><span>Email the Whacky Auctions team directly when you need help.</span></div></div></div></section>
<section class="section final-cta"><div class="container cta-panel"><div><div class="label">Ready when you are</div><h2>Come have a look around.</h2><p>Browse the goods now or join early access for launch news.</p></div><div class="hero-actions"><a class="btn btn-primary" href="/auctions" data-link>See auctions</a><a class="btn btn-secondary" href="/join" data-link>Join early access</a></div></div></section></main>${footer()}`;
}

async function auctionsPage() {
  let auctions = [];
  try { auctions = await loadAuctions(); } catch (e) { toast(e.message, true); }
  const live = auctions.filter((a) => a.status === "live");
  const upcoming = auctions.filter((a) => a.status === "scheduled");
  const ended = auctions.filter((a) => ["closed", "unsold"].includes(a.status));
  const active = [...live, ...upcoming];
  return `${header()}<main><section class="page-hero"><div class="container"><span class="eyebrow">Marketplace</span><h1>Auctions</h1><p>Real items, real photos and clear condition notes. Have a squiz before you bid.</p></div></section><section class="section"><div class="container"><div class="auction-summary"><span><b>${live.length}</b> live</span><span><b>${upcoming.length}</b> upcoming</span><span><b>${ended.length}</b> completed</span></div>${active.length ? `<div class="section-head"><div><div class="label">Open for attention</div><h2>${live.length ? "Live and upcoming lots" : "Upcoming lots"}</h2></div></div><div class="grid">${active.map(card).join("")}</div>` : `<div class="empty"><h2>The auction room is being prepared.</h2><p>Join early access for the launch alert, or browse the preview stock below.</p><a class="btn btn-primary" href="/join" data-link>Join early access</a></div>`}</div></section><section class="section preview-section"><div class="container"><div class="section-head"><div><div class="label">Preview stock</div><h2>What’s on the stoep</h2></div><span class="muted">${PREVIEW_ITEMS.length} preview items</span></div><p class="preview-intro">Previews are not open for bidding. Full descriptions and auction-specific terms will appear when each lot is published.</p><div class="grid preview-grid">${PREVIEW_ITEMS.map(previewCard).join("")}</div></div></section>${ended.length ? `<section class="section"><div class="container"><div class="section-head"><div><div class="label">Archive</div><h2>Completed auctions</h2></div></div><div class="grid">${ended.map(card).join("")}</div></div></section>` : ""}</main>${footer()}`;
}

function howItWorks() {
  return `${header()}<main><section class="page-hero"><div class="container"><span class="eyebrow">Simple, transparent bidding</span><h1>How Whacky Auctions works</h1><p>From first look to collection, every step is designed to be clear and fair.</p></div></section><section class="section"><div class="container process-grid"><article class="process-card"><span>01</span><h3>Browse properly</h3><p>Check the real photos, description, condition notes, opening bid and collection details.</p></article><article class="process-card"><span>02</span><h3>Activate bidding</h3><p>Create an Early Access account, then complete the separate bidder-verification step only if you want to bid.</p></article><article class="process-card"><span>03</span><h3>Bid fairly</h3><p>Place a binding bid. A valid bid in the final two minutes restores the full closing window.</p></article><article class="process-card"><span>04</span><h3>Pay securely</h3><p>Winning bidders follow the displayed payment instructions through secure Yoco processing.</p></article><article class="process-card"><span>05</span><h3>Collect your win</h3><p>Collection and delivery arrangements are shown on each lot before bidding closes.</p></article><article class="process-card"><span>06</span><h3>Ask when unsure</h3><p>Contact us before bidding if a condition note, rule or collection detail needs clarification.</p></article></div></section><section class="section"><div class="container detail-grid"><div class="panel"><div class="label">The soft close</div><h2>No sneaky sniping</h2><p>If a valid bid arrives during the final two minutes, the timer returns to two minutes. This repeats until everyone says “Ag, fine”.</p></div><div class="panel"><div class="label">Before you commit</div><h2>Read the lot and its rules</h2><p>A bid is binding. Review the item’s condition, buyer premium, payment deadline and collection requirements before placing it.</p><a class="text-link" href="/legal" data-link>Read the legal centre →</a></div></div></section><section class="section final-cta"><div class="container cta-panel"><div><h2>Ready to have a squiz?</h2><p>See what is live, upcoming and waiting in preview.</p></div><a class="btn btn-primary" href="/auctions" data-link>Browse auctions</a></div></section></main>${footer()}`;
}

function aboutPage() {
  return `${header()}<main><section class="page-hero"><div class="container"><span class="eyebrow">Proudly South African</span><h1>About Whacky Auctions</h1><p>A more human online auction room for useful finds, unusual treasures and the occasional “what even is that?”</p></div></section><section class="section"><div class="container story-grid"><div><div class="label">Why we exist</div><h2>Second-hand goods deserve a better auction experience.</h2><p>Whacky Auctions was built to make online auctions feel exciting without becoming confusing or dodgy. We use real item photographs, honest condition notes and clear rules so bidders know what they are looking at before committing.</p><p>We are based in Florida, Gauteng and built for South African buyers.</p></div><aside class="panel values-panel"><h3>What matters here</h3><div><b>Honesty over hype</b><span>We describe items as they stand.</span></div><div><b>Fairness over tricks</b><span>Our soft close gives bidders time to respond.</span></div><div><b>Personality without chaos</b><span>Whacky can still be professional.</span></div></aside></div></section><section class="section"><div class="container"><div class="section-head"><div><div class="label">Our standard</div><h2>What bidders can expect</h2></div></div><div class="process-grid compact"><article class="process-card"><span>✓</span><h3>Actual item photos</h3><p>No generic stock images pretending to be the goods.</p></article><article class="process-card"><span>✓</span><h3>Condition disclosed</h3><p>Working, untested, worn or incomplete is stated plainly.</p></article><article class="process-card"><span>✓</span><h3>Rules within reach</h3><p>Legal terms and lot-specific details stay easy to find.</p></article></div></div></section></main>${footer()}`;
}

function contactPage() {
  return `${header()}<main><section class="page-hero"><div class="container"><span class="eyebrow">We’re real char-o’s!</span><h1>Contact us</h1><p>Questions about an item, payment, collection or your account? Drop us a line.</p></div></section><section class="section"><div class="container contact-grid"><a class="contact-card" href="mailto:info@whackyauctions.co.za"><span class="contact-icon">✉</span><div><div class="label">Email</div><h2>info@whackyauctions.co.za</h2><p>Best for account, auction, payment and collection queries.</p><b>Write to us →</b></div></a><div class="panel contact-note"><div class="label">What to include</div><h3>Help us help you quickly</h3><ul><li>Your name and account email</li><li>The auction or item title</li><li>A short explanation of what you need</li></ul><p class="muted small">Never email card details, passwords or one-time security codes.</p></div></div></section><section class="section"><div class="container detail-grid"><div class="panel"><h3>Collection area</h3><p>Florida, Gauteng. Exact arrangements are confirmed for each completed sale.</p></div><div class="panel"><h3>Legal or privacy request?</h3><p>Use the same email address and clearly mark the subject as a privacy, POPIA or PAIA enquiry.</p><a class="text-link" href="/legal" data-link>Open legal centre →</a></div></div></section></main>${footer()}`;
}

function accountPage() {
  if (!state.me) return `${header()}<main><section class="page-hero"><div class="container"><span class="eyebrow">Your Whacky space</span><h1>My account</h1><p>Sign in to manage bidding, watched items, wins and bidder verification.</p></div></section><section class="section"><div class="container"><div class="panel account-gate"><h2>Sign in to continue</h2><p>Your Early Access account and verified-bidder status remain separate.</p><button class="btn btn-primary" id="loginHere">Sign in</button><a class="btn btn-secondary" href="/join" data-link>Join early access</a></div></div></section></main>${footer()}`;
  return `${header()}<main><section class="page-hero compact-hero"><div class="container"><span class="eyebrow">Welcome back</span><h1>${esc(state.me.firstName)}’s account</h1><p>${state.me.verified ? "Verified bidder · ready when bidding opens." : "Early Access member · bidder verification is optional."}</p></div></section><section class="section"><div class="container account-hub"><a class="hub-card" href="/my-bids" data-link><span>🔨</span><h3>My bids</h3><p>See the lots you have bid on.</p></a><a class="hub-card" href="/watchlist" data-link><span>★</span><h3>Watchlist</h3><p>Keep an eye on interesting lots.</p></a><a class="hub-card" href="/wins" data-link><span>🏆</span><h3>Wins</h3><p>Review your successful auctions.</p></a><a class="hub-card" href="/profile" data-link><span>👤</span><h3>Profile & bidder status</h3><p>Manage your details and verification.</p></a></div></section></main>${footer()}`;
}
async function joinPage() {
  // Compatibility marker for the former home-page section: id="early-access".
  let count = 0;
  try {
    count = (await api("early-access/count")).count || 0;
  } catch {}
  return `${header()}<main class="join-page"><section class="container join-grid"><div class="join-copy"><span class="eyebrow">Founding bidder early access</span><h1>Get in before the hammer drops.</h1><p>Join the Whacky Auctions launch list and be among the first to hear when bidding opens. It costs nothing and takes less than a minute.</p><div class="join-benefits"><div><span>01</span><b>First look at upcoming lots</b><small>See what is coming before launch day.</small></div><div><span>02</span><b>First 100 activate free</b><small>No R10 bidder-activation fee for the first 100 signups.</small></div><div><span>03</span><b>No spammy nonsense</b><small>Useful Whacky updates, with an easy opt-out.</small></div></div>${count ? `<div class="signup-count"><b>${count}</b> early signup${count === 1 ? "" : "s"} already in the room.</div>` : ""}</div><div class="panel join-panel"><div class="label">Reserve your spot</div><h2>Join early access</h2>${earlyAccessForm()}</div></section></main>${footer()}`;
}
function earlyAccessForm() {
  return `<p class="muted">Only the basics for now. Account creation and bidder verification are separate.</p><form id="earlyAccessForm" class="admin-form"><div class="field"><label>Name and surname</label><input class="input" name="fullName" autocomplete="name" required></div><div class="field"><label>Email address</label><input class="input" type="email" name="email" autocomplete="email" inputmode="email" required></div><div class="field"><label>Mobile number</label><input class="input" name="mobile" autocomplete="tel" inputmode="tel" placeholder="e.g. 082 123 4567" required></div><label class="switch consent"><input type="checkbox" name="marketingOptIn"><span>Send me launch news, auction alerts and special offers (optional).</span></label><button class="btn btn-primary join-submit">Join Early Access</button><p class="muted small">By joining, you acknowledge the <a href="/legal/privacy-policy.pdf" target="_blank">POPIA Privacy Notice</a>. No ID number, password or payment is required at this step.</p></form>`;
}
async function auctionPage(id) {
  let d;
  try {
    d = await api("auctions/" + id);
    setServerTime(d.serverTime);
  } catch (e) {
    return `${header()}<main class="section"><div class="container"><div class="notice bad">${esc(e.message)}</div></div></main>${footer()}`;
  }
  const a = d.auction;
  state.seoAuction = {
    title: `${a.title} | Whacky Auctions`,
    description: `${a.condition}. ${a.description || "View this South African online auction, photographs and bidding details."}`.replace(/\s+/g, " ").slice(0, 158),
    path: `/auction/${a.slug || a.id}`,
    image: a.images?.[0]?.url || "",
  };
  const imgs = a.images || [];
  const main = imgs[0]?.url;
  const high = a.currentBidCents ?? a.openingBidCents;
  const min =
    a.currentBidCents == null
      ? a.openingBidCents
      : a.currentBidCents + a.bidIncrementCents;
  const canBid =
    state.me &&
    state.me.verified &&
    !state.me.suspended &&
    state.settings.tradingEnabled &&
    ["live", "scheduled"].includes(a.status) &&
    now() >= new Date(a.startAt).getTime() &&
    now() < new Date(a.currentEndAt).getTime();
  const myHigh = state.me && a.highBidderId === state.me.id;
  return `${header()}<main class="detail"><div class="container detail-grid"><section class="gallery"><div class="main-photo">${main ? `<img id="mainPhoto" src="${esc(optimisedImage(main, 1200, 900, "contain"))}" alt="${esc(a.title)}">` : `<div class="empty">No image yet</div>`}</div>${imgs.length > 1 ? `<div class="thumbs">${imgs.map((im, i) => `<button class="thumb ${i === 0 ? "active" : ""}" data-photo="${esc(optimisedImage(im.url, 1200, 900, "contain"))}"><img src="${esc(optimisedImage(im.url, 180, 135))}" alt="${esc(im.alt || a.title)}"></button>`).join("")}</div>` : ""}</section><section><div class="label">${esc(a.category)}</div><h1>${esc(a.title)}</h1><div class="toolbar">${statusChip(a)}<button class="btn btn-secondary" id="watchBtn">${a.watched ? "★ Watching" : "☆ Watch"}</button><button class="btn btn-secondary" id="shareAuction">Share item</button></div>
<div class="bidbox"><div class="label">${a.currentBidCents == null ? "Opening bid" : "Current bid"}</div><div class="price" style="font-size:42px">${randMoney(high)}</div><div class="muted small">${a.bidCount} bid${a.bidCount === 1 ? "" : "s"} · increment ${randMoney(a.bidIncrementCents)}</div><div class="kv"><div><div class="label">${a.status === "scheduled" ? "Starts" : "Time left"}</div><b class="countdown" data-countdown="${esc(a.currentEndAt)}" data-status="${esc(a.status)}">${a.status === "scheduled" ? fmtDate(a.startAt) : countdown(a.currentEndAt, a.status)}</b></div><div><div class="label">Reserve</div><b>${a.reserveDisclosed ? (a.reserveMet ? "Met / not required" : "Not yet met") : "Not disclosed"}</b></div></div>
<div class="soft-badge"><span>⏱️</span><div><b>Soft close active</b><div class="muted small">Any valid bid in the final ${Math.round(a.softCloseSeconds / 60)} minute${a.softCloseSeconds === 60 ? "" : "s"} restores a full ${Math.round(a.softCloseSeconds / 60)}-minute window. Extensions can repeat.</div></div></div>
${myHigh ? '<div class="notice good" style="margin-top:12px">You currently hold the highest bid.</div>' : ""}
${a.order ? `<div class="notice ${a.order.status === "defaulted" ? "bad" : "good"}" style="margin-top:12px"><b>Winning order</b><br>Total payable: <b>${randMoney(a.order.totalCents)}</b> · ${esc(a.order.status)}${a.order.dueAt && ["unpaid","pending"].includes(a.order.status) ? `<div class="small" style="margin-top:6px">Payment deadline: <b>${fmtDate(a.order.dueAt)}</b></div>` : ""}${a.order.status === "defaulted" ? `<div class="small" style="margin-top:6px">Sale cancelled and relisted. Default charge: up to <b>${randMoney(a.order.defaultFeeCents)}</b>, subject to the statutory cap.</div>` : ""}${["unpaid","pending"].includes(a.order.status) ? `<div style="margin-top:10px"><button class="btn btn-primary" id="payNow" ${state.settings.paymentGatewayEnabled ? "" : "disabled"}>${state.settings.paymentGatewayEnabled ? "Pay securely with Yoco" : "Payment gateway coming at launch"}</button></div>` : ""}</div>` : ""}
${canBid ? `<div class="bidrow"><input class="input" id="bidAmount" type="number" inputmode="decimal" min="${min / 100}" step="${a.bidIncrementCents / 100}" value="${(min / 100).toFixed(2)}"><button class="btn btn-accent" id="placeBid">Place bid</button></div><div class="small muted" style="margin-top:8px">By placing a bid you accept the auction rules. A bid may be retracted before the sale is completed, subject to the rules.</div>` : bidGate(a)}
</div><div class="tabs"><button class="tab active" data-tab="details">Details</button><button class="tab" data-tab="bids">Bid history</button><button class="tab" data-tab="rules">Rules</button></div><div id="tabBody">${detailTab(a, "details")}</div></section></div></main>${footer()}`;
}
function bidGate(a) {
  if (!state.me)
    return '<div class="notice" style="margin-top:12px">Join Early Access, create your optional account and complete bidder activation before bidding.</div>';
  if (!state.me.verified)
    return '<div class="notice" style="margin-top:12px">Complete the once-off R10 bidder verification in your account before bidding.</div>';
  if (!state.settings.tradingEnabled)
    return '<div class="notice" style="margin-top:12px">Binding bids are locked during pre-launch mode.</div>';
  if (a.status === "scheduled")
    return `<div class="notice" style="margin-top:12px">Bidding opens ${fmtDate(a.startAt)}.</div>`;
  return '<div class="notice" style="margin-top:12px">This auction is not open for bidding.</div>';
}
function detailTab(a, tab) {
  if (tab === "bids")
    return a.bids?.length
      ? `<div class="table-wrap"><table><thead><tr><th>Bidder</th><th>Amount</th><th>Time</th><th>Status</th></tr></thead><tbody>${a.bids.map((b) => `<tr><td>${esc(b.bidder)}${b.isMine ? ' <span class="chip">You</span>' : ""}</td><td>${randMoney(b.amountCents)}</td><td>${fmtDate(b.createdAt)}</td><td>${b.retractedAt ? "Retracted" : b.isMine && ["scheduled", "live"].includes(a.status) ? `<button class="btn btn-secondary small" data-retract-bid="${b.id}">Retract bid</button>` : "Valid"}</td></tr>`).join("")}</tbody></table></div>`
      : '<div class="empty">No bids yet.</div>';
  if (tab === "rules")
    return `<div class="panel"><h3>Auction rules</h3><p>Opening bid: <b>${randMoney(a.openingBidCents)}</b> · minimum increment: <b>${randMoney(a.bidIncrementCents)}</b>.</p><p>Soft close: a valid bid in the final ${a.softCloseSeconds} seconds extends the lot so that a full ${a.softCloseSeconds} seconds remain. Extensions may repeat without a fixed maximum.</p><p>Buyer premium: <b>${a.buyerPremiumPercent}%</b>. ${esc(a.vatNote)}</p><p>Payment deadline: <b>${a.paymentDeadlineHours} hours</b> after the sale, subject to the auction-specific rules.</p><p>${esc(a.inspectionNote)}</p><p>${esc(a.collectionNote)}</p><p>${esc(a.storageFeeNote)}</p><p><a href="/legal/terms-auction-rules.pdf" target="_blank">Read the complete App Terms & Master Rules of Auction ↗</a></p><p><a href="/rules/${esc(a.id)}" data-link>Open the auction-specific rules / printable schedule →</a></p></div>`;
  return `<div class="panel"><h3>Condition & description</h3><p><b>Condition:</b> ${esc(a.condition)}</p><p>${esc(a.description).replace(/\n/g, "<br>")}</p><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><div class="form-grid"><div><div class="label">Auctioneer</div><b>${esc(a.auctioneerName || "To be confirmed before publication")}</b></div><div><div class="label">Closing</div><b>${fmtDate(a.currentEndAt)}</b></div></div></div>`;
}
async function accountList(which) {
  if (!state.me) return needLogin();
  let d;
  try {
    d = await api("me/" + which);
  } catch (e) {
    return errorPage(e.message);
  }
  const titles = { bids: "My bids", watchlist: "Watchlist", wins: "Wins" };
  return `${header()}<main class="section"><div class="container"><div class="section-head"><div><div class="label">Account</div><h2>${titles[which]}</h2></div></div>${d.auctions.length ? `<div class="grid">${d.auctions.map(card).join("")}</div>` : `<div class="empty">Nothing here yet.</div>`}</div></main>${footer()}`;
}
function needLogin() {
  return `${header()}<main class="section"><div class="container"><div class="empty"><h2>Sign in required</h2><button class="btn btn-primary" id="loginHere">Sign in</button></div></div></main>${footer()}`;
}
function errorPage(msg) {
  return `${header()}<main class="section"><div class="container"><div class="notice bad">${esc(msg)}</div></div></main>${footer()}`;
}
async function profile() {
  if (!state.me) return needLogin();
  let notes = [];
  try {
    notes = (await api("me/notifications")).notifications;
  } catch {}
  return `${header()}<main class="section"><div class="container"><div class="section-head"><div><div class="label">Early Access account</div><h2>${esc(state.me.firstName)} ${esc(state.me.lastName)}</h2></div><button class="btn btn-secondary" id="logoutBtn">Sign out</button></div><div class="detail-grid"><div class="panel"><h3>Bidder status</h3><div class="notice ${state.me.verified ? "good" : ""}">${state.me.verified ? '<span class="badge-dot"></span>Verified to bid' : "You have an Early Access account. Bidder registration is optional and completed on a separate page."}</div>${state.me.verified ? '<p class="muted small">Your bidder verification is active.</p>' : '<a class="btn btn-primary" href="/verify-bidder" data-link style="margin-top:12px">Register to become a verified bidder</a><p class="muted small">Founding members among the first 100 signups activate free; later members pay R10 once off.</p>'}<p><b>Email:</b> ${esc(state.me.email)}</p><p><b>Mobile:</b> ${esc(state.me.mobile || "")}</p><h3>Change password</h3><form id="passwordForm" class="admin-form"><input class="input" type="password" name="currentPassword" placeholder="Current password" required><input class="input" type="password" name="newPassword" minlength="10" placeholder="New password (10+ characters)" required><button class="btn btn-secondary">Change password</button></form></div><div class="panel"><div class="section-head"><h3>Notifications</h3><button class="btn btn-secondary" id="readNotes">Mark read</button></div>${notes.length ? notes.map((n) => `<div style="padding:12px 0;border-bottom:1px solid var(--line)"><b>${esc(n.message)}</b><div class="muted small">${fmtDate(n.created_at)}</div></div>`).join("") : '<div class="muted">No notifications.</div>'}</div></div></div></main>${footer()}`;
}
async function verifyBidderPage() {
  if (!state.me) return needLogin();
  let verification = { freeActivationEligible: false, amountCents: 1000 };
  try { verification = await api("me/verification"); } catch {}
  trackFunnel("verification_page_view");
  if (state.me.verified)
    return `${header()}<main class="section"><div class="container"><div class="panel"><div class="label">Verified bidder</div><h2>Your bidder status is active</h2><p>You are verified and will be able to bid when Whacky Auctions opens bidding.</p><a class="btn btn-primary" href="/profile" data-link>Back to my account</a></div></div></main>${footer()}`;
  return `${header()}<main class="section"><div class="container"><div class="section-head"><div><div class="label">Separate bidder registration</div><h2>Become a verified bidder</h2></div><a class="btn btn-secondary" href="/profile" data-link>Back to account</a></div><div class="panel" style="max-width:720px"><p>This is optional. Complete it only if you want to bid.</p><div class="kv"><div><div class="label">Name & surname</div><b>${esc(state.me.firstName)} ${esc(state.me.lastName)}</b></div><div><div class="label">Contact number</div><b>${esc(state.me.mobile || "")}</b></div></div><form id="verifyBidderForm" class="admin-form" style="margin-top:18px"><div class="field"><label>ID number</label><input class="input" name="idNumber" autocomplete="off" required></div>${verification.freeActivationEligible ? '<div class="notice good"><b>Founding-member activation: FREE</b><br>You are among the first 100 Early Access signups. Your normal R10 activation fee is waived.</div><button class="btn btn-primary">Activate my bidder status free</button>' : '<div class="notice"><b>Once-off activation: R10</b><br>Yoco securely processes the payment. Successful payment activates your verified bidder status automatically. Your card is not saved and automatic debits are not authorised.</div><button class="btn btn-primary">Continue to secure R10 payment</button>'}</form></div></div></main>${footer()}`;
}
function legal() {
  return `${header()}<main class="section"><div class="container"><div class="section-head"><div><div class="label">Compliance</div><h1>Legal centre</h1></div></div><div class="panel legal-list"><a class="legal-link" target="_blank" href="/legal/privacy-policy.pdf"><div><b>POPIA Privacy Notice & Privacy Policy</b><div class="muted small">Version 1.0 · Effective 12 September 2026</div></div><span>Open PDF ↗</span></a><a class="legal-link" target="_blank" href="/legal/terms-auction-rules.pdf"><div><b>App Terms & Master Rules of Auction</b><div class="muted small">Version 1.2 · first-100 activation waiver, R10 standard fee and payment rules</div></div><span>Open PDF ↗</span></a><a class="legal-link" target="_blank" href="/legal/standard-live-auction-rules-2026.pdf"><div><b>Standard Live Auction Rules - 2026</b><div class="muted small">Version 1.3 · founding-member activation and standard auction terms</div></div><span>Open PDF ↗</span></a><div class="legal-link"><div><b>PAIA Manual</b><div class="muted small">Available from the Information Officer at info@whackyauctions.co.za. A final web copy will be added when the submitted manual file is supplied to the app repository.</div></div><span>PAIA</span></div></div></div></main>${footer()}`;
}
function installPage() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return `${header()}<main class="section"><div class="container"><div class="section-head"><div><div class="label">Mobile app</div><h2>Install Whacky Auctions</h2></div></div><div class="detail-grid"><div class="panel"><h3>Android</h3><p>Once the site is live, Chrome can install Whacky Auctions as a full-screen app directly from the browser.</p><button class="btn btn-primary" id="installPageBtn" ${state.deferredInstall ? "" : "disabled"}>${state.deferredInstall ? "Install on this device" : "Open in Chrome and choose Install app"}</button><p class="muted small">An Android wrapper project is prepared for APK packaging; the hosted PWA can be installed directly from Chrome as soon as the site is live.</p></div><div class="panel"><h3>iPhone / iPad</h3><p>Open Whacky Auctions in Safari, tap <b>Share</b>, choose <b>Add to Home Screen</b>, then confirm <b>Add</b>. It opens in standalone app mode.</p><p class="muted small">${ios ? "You appear to be using an Apple mobile device." : "Apple does not allow a generally downloadable signed iPhone IPA without Apple Developer signing/provisioning; the installable web app works without App Store approval."}</p></div></div></div></main>${footer()}`;
}
async function rulesPage(id) {
  let d;
  try {
    d = await api("auctions/" + id);
  } catch (e) {
    return errorPage(e.message);
  }
  const a = d.auction;
  return `${header()}<main class="section"><div class="container"><div class="section-head"><div><div class="label">Auction-specific rules</div><h2>${esc(a.title)}</h2></div><button class="btn btn-secondary" id="printRules">Print / Save PDF</button></div><div class="panel rules-sheet"><p><b>Auction platform:</b> Whacky Auctions PTY LTD</p><p><b>Appointed auctioneer:</b> ${esc(a.auctioneerName || "To be completed before publication")}</p><p><b>Start:</b> ${fmtDate(a.startAt)}<br><b>Scheduled close:</b> ${fmtDate(a.scheduledEndAt)}<br><b>Current close:</b> ${fmtDate(a.currentEndAt)}</p><p><b>Opening bid:</b> ${randMoney(a.openingBidCents)}<br><b>Minimum increment:</b> ${randMoney(a.bidIncrementCents)}<br><b>Buyer premium:</b> ${a.buyerPremiumPercent}%</p><h3>Rolling soft close</h3><p>A valid bid received during the final ${a.softCloseSeconds} seconds resets the close so that a full ${a.softCloseSeconds} seconds remain. Every further valid bid inside the renewed final window repeats the extension. There is no fixed maximum number of extensions.</p><h3>Condition and inspection</h3><p><b>Condition:</b> ${esc(a.condition)}</p><p>${esc(a.inspectionNote)}</p><h3>Payment and collection</h3><p>Payment deadline: ${a.paymentDeadlineHours} hours after completion. ${esc(a.vatNote)}</p><p>${esc(a.collectionNote)}</p><p>${esc(a.storageFeeNote)}</p><h3>Master terms</h3><p>These auction-specific rules must be read with the <a href="/legal/terms-auction-rules.pdf" target="_blank">Whacky Auctions App Terms & Master Rules of Auction</a>. Where a mandatory legal rule applies, it prevails over any inconsistent contractual term.</p></div></div></main>${footer()}`;
}
function adminSetup() {
  return `${header()}<main class="section"><div class="container"><div class="panel" style="max-width:620px;margin:auto"><div class="label">One-time configuration</div><h2>Set up Whacky Auctions admin</h2><p class="muted">Use the setup code provided with this deployment. This page stops working after the first administrator is created.</p><form id="adminSetupForm" class="admin-form"><div class="field"><label>Setup code</label><input class="input code" name="code" required autocomplete="off"></div><div class="field"><label>Choose admin password</label><input class="input" type="password" minlength="10" name="password" required></div><button class="btn btn-primary">Create administrator</button></form></div></div></main>${footer()}`;
}
async function admin() {
  if (!state.me || state.me.role !== "admin")
    return errorPage("Administrator access required.");
  let dash;
  try {
    dash = await api("admin/dashboard");
  } catch (e) {
    return errorPage(e.message);
  }
  const side = `<aside class="side"><button data-admin-tab="overview" class="${state.adminTab === "overview" ? "active" : ""}">Overview</button><button data-admin-tab="auctions" class="${state.adminTab === "auctions" ? "active" : ""}">Quick List</button><button data-admin-tab="users" class="${state.adminTab === "users" ? "active" : ""}">Bidders</button><button data-admin-tab="records" class="${state.adminTab === "records" ? "active" : ""}">Records</button>${state.adminTab === "overview" ? `<div class="stat"><span class="label">Views today</span><b>${dash.stats.viewsToday}</b></div><div class="stat"><span class="label">Views · 30 days</span><b>${dash.stats.viewsThirtyDays}</b></div>` : ""}</aside>`;
  let body = "";
  if (state.adminTab === "overview") body = adminOverview(dash);
  if (state.adminTab === "auctions") body = await adminAuctions();
  if (state.adminTab === "users") body = await adminUsers();
  if (state.adminTab === "records") body = await adminRecords();
  return `${header()}<main class="section"><div class="container"><div class="section-head"><div><div class="label">Operations</div><h2>Admin dashboard</h2></div></div><div class="admin-layout">${side}<section>${body}</section></div></div></main>${footer()}`;
}
function adminOverview(d) {
  const reg = !!d.settings.dealer_registration_confirmed;
  const pay = !!d.settings.payment_gateway_enabled;
  const ready = reg && pay;
  return `<div class="label" style="margin-bottom:8px">Registrations</div><div class="admin-grid"><div class="stat"><span class="label">Total accounts</span><b>${d.stats.users}</b></div><div class="stat"><span class="label">Registered bidders</span><b>${d.stats.registeredBidders}</b></div><div class="stat"><span class="label">Verified bidders</span><b>${d.stats.verifiedBidders}</b></div><div class="stat"><span class="label">Sign-ups today</span><b>${d.stats.signupsToday}</b></div></div><div class="label" style="margin:20px 0 8px">Signup funnel · 30 days</div><div class="admin-grid"><div class="stat"><span class="label">Form starts</span><b>${d.stats.funnelStarts}</b></div><div class="stat"><span class="label">Early Access joined</span><b>${d.stats.funnelSignups}</b></div><div class="stat"><span class="label">Accounts created</span><b>${d.stats.funnelAccounts}</b></div><div class="stat"><span class="label">Activations started</span><b>${d.stats.funnelVerificationStarts}</b></div></div><div class="label" style="margin:20px 0 8px">Marketplace activity</div><div class="admin-grid"><div class="stat"><span class="label">Auctions</span><b>${d.stats.auctions}</b></div><div class="stat"><span class="label">Bids</span><b>${d.stats.bids}</b></div><div class="stat"><span class="label">To verify</span><b>${d.stats.pendingVerification}</b></div><div class="stat"><span class="label">Early-access list</span><b>${d.stats.earlyAccess}</b></div></div><div class="panel" style="margin-top:16px"><h3>Launch status</h3><div class="toolbar" style="margin-bottom:12px"><button class="btn btn-secondary" id="registerYocoWebhook">Register Yoco webhook</button></div><div class="notice ${d.settings.trading_enabled ? "good" : ""}"><b>${d.settings.trading_enabled ? "Trading enabled" : "Launch lock active"}</b><br>${d.settings.trading_enabled ? "Binding auctions can run." : "Binding bids and publication remain locked until both launch requirements are complete."}</div><div class="kv"><div><div class="label">SAPS second-hand-goods registration</div><b>${reg ? "Recorded" : "Pending"}</b>${reg && d.settings.dealer_registration_number ? `<div class="muted small">${esc(d.settings.dealer_registration_number)}${d.settings.dealer_registration_expiry ? ` · expires ${esc(d.settings.dealer_registration_expiry)}` : ""}</div>` : ""}</div><div><div class="label">Payment gateway</div><b>${pay ? "Connected" : "Pending"}</b></div></div><form id="dealerRegistrationForm" class="admin-form" style="margin-top:16px"><div class="form-grid"><div class="field"><label>SAPS registration number</label><input class="input" name="registrationNumber" value="${esc(d.settings.dealer_registration_number || "")}" placeholder="Enter after SAPS approval"></div><div class="field"><label>Expiry date (if shown)</label><input class="input" type="date" name="expiryDate" value="${esc(d.settings.dealer_registration_expiry || "")}"></div></div><label class="switch"><input type="checkbox" name="confirmed" ${reg ? "checked" : ""}> I confirm Whacky Auctions is covered by a current second-hand-goods dealer registration for its trading activities/premises.</label><button class="btn btn-secondary">Save registration status</button></form><div style="margin-top:16px"><div class="label">Soft close default</div><b>${Number(d.settings.soft_close_seconds || 120)} seconds</b></div>${ready ? `<button class="btn btn-${d.settings.trading_enabled ? "danger" : "primary"}" id="tradeToggle" style="margin-top:14px">${d.settings.trading_enabled ? "Disable trading" : "Enable trading"}</button>` : '<p class="muted small">The trading switch stays unavailable until the SAPS registration is recorded and the payment gateway is connected.</p>'}</div>`;
}
async function adminAuctions() {
  const d = await api("admin/auctions");
  const edit = state.editingAuction || {};
  const val = (k, def = "") => edit[k] ?? def;
  const condition = quickConditionParts(val("condition", ""));
  const softDefault = Number(
    val("softCloseSeconds", state.settings.softCloseSeconds || 120),
  );
  const defaultStart = toLocalInput(
    val("startAt", new Date(now() + 25 * 60 * 60 * 1000).toISOString()),
  );
  const closeValue = toLocalInput(val("scheduledEndAt"));
  ensureQuickPhotos(edit);
  const formOrConfirmation = state.quickSavedAuction
    ? quickConfirmation(state.quickSavedAuction)
    : `<div class="panel quick-list-panel" id="quickListPanel">
    <div class="section-head quick-list-head"><div><div class="label">Fast mobile listing</div><h3>${edit.id ? "Edit draft" : "Quick List"}</h3><p class="muted small">Photos → title → condition → price → closing time → save. Standard auction defaults stay in Advanced settings.</p></div>${edit.id ? '<button class="btn btn-secondary" id="cancelEdit">New listing</button>' : ""}</div>
    <form id="auctionForm" class="admin-form quick-list-form" novalidate>
      <input type="hidden" name="id" value="${esc(edit.id || "")}">
      <section class="quick-photo-section" id="quickPhotos">
        <div class="quick-field-head"><div><label>Photos</label><div class="muted small">First photo is the cover. Add now or save the draft and add later.</div></div><span class="photo-count" id="quickPhotoCount"></span></div>
        <div class="quick-photo-actions">
          <label class="btn btn-primary quick-photo-button">📷 Take photo<input id="quickCameraInput" type="file" accept="image/*" capture="environment" hidden></label>
          <label class="btn btn-secondary quick-photo-button">🖼️ Choose photos<input id="quickGalleryInput" type="file" accept="image/*" multiple hidden></label>
        </div>
        <div class="quick-photo-grid" id="quickPhotoTray" aria-live="polite"></div>
        <div class="muted small">JPEG, PNG, WebP or GIF · up to 8 MB each. Use arrows to change order.</div>
      </section>
      <div id="quickListError" class="notice bad quick-error" hidden></div>
      <div class="field"><label>Item title</label><input class="input quick-input" name="title" maxlength="150" required autocomplete="off" value="${esc(val("title"))}" placeholder="e.g. Defy Slimline Hob"></div>
      <div class="field"><label>Condition</label><select class="select quick-input" name="conditionChoice" required>${QUICK_CONDITIONS.map((x) => `<option value="${esc(x)}" ${condition.choice === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
      <div class="field"><label>Short condition note <span class="muted">(optional)</span></label><input class="input quick-input" name="conditionNote" maxlength="500" value="${esc(condition.note)}" placeholder="e.g. Light scratches; powers on"></div>
      <div class="field"><label>Description <span class="muted">(optional)</span></label><textarea class="textarea quick-description" name="description" maxlength="12000" placeholder="Anything useful the bidder should know">${esc(val("description"))}</textarea></div>
      <div class="form-grid quick-money-grid"><div class="field"><label>Opening bid (R)</label><input class="input quick-input" type="number" inputmode="decimal" step="0.01" min="0" name="openingBid" required value="${val("openingBidCents") != null ? Number(val("openingBidCents")) / 100 : "1.00"}"></div><div class="field"><label>Reserve price (R) <span class="muted">optional</span></label><input class="input quick-input" type="number" inputmode="decimal" step="0.01" min="0" name="reserve" value="${edit.reservePriceCents != null ? Number(edit.reservePriceCents) / 100 : ""}" placeholder="No reserve"></div></div>
      <div class="field"><label>Auction closing date/time</label><input class="input quick-input" type="datetime-local" name="endAt" required value="${closeValue}"></div>
      <details class="advanced-settings"><summary>Advanced settings <span>Optional / unusual lots</span></summary><div class="advanced-body">
        <div class="form-grid"><div class="field"><label>Category</label><input class="input" name="category" value="${esc(val("category", "General"))}"></div><div class="field"><label>Start date/time</label><input class="input" type="datetime-local" name="startAt" required value="${defaultStart}"></div></div>
        <div class="form-grid"><div class="field"><label>Bid increment (R)</label><input class="input" type="number" inputmode="decimal" step="0.01" min="0.01" name="increment" required value="${val("bidIncrementCents") != null ? Number(val("bidIncrementCents")) / 100 : "10.00"}"></div><div class="field"><label>Buyer premium %</label><input class="input" type="number" inputmode="decimal" step="0.01" min="0" name="premium" value="${esc(val("buyerPremiumPercent", 5))}"></div></div>
        <div class="form-grid"><div class="field"><label>Soft close seconds</label><input class="input" type="number" inputmode="numeric" min="30" max="900" name="softClose" value="${esc(softDefault)}"></div><div class="field"><label>Payment deadline hours</label><input class="input" type="number" inputmode="numeric" min="1" name="paymentHours" value="${esc(val("paymentDeadlineHours", 2))}"></div></div>
        <div class="field"><label>Appointed auctioneer</label><input class="input" name="auctioneerName" value="${esc(val("auctioneerName"))}" placeholder="Required before publication"></div>
        <div class="field"><label>VAT note</label><input class="input" name="vatNote" value="${esc(val("vatNote", "VAT treatment as displayed for this lot."))}"></div>
        <div class="field"><label>Inspection note</label><input class="input" name="inspectionNote" value="${esc(val("inspectionNote", "Inspection by arrangement before bidding closes."))}"></div>
        <div class="field"><label>Collection / delivery note</label><input class="input" name="collectionNote" value="${esc(val("collectionNote", "Collection in Florida, Gauteng within 30 days: Saturdays and Sundays 07:00-17:30, or weekdays before 06:30, by prior arrangement. Courier at the buyer's cost and arrangement."))}"></div>
        <div class="field"><label>Storage fee note</label><input class="input" name="storageFeeNote" value="${esc(val("storageFeeNote", "Storage charges may apply after the collection deadline where lawfully disclosed."))}"></div>
        <label class="switch"><input type="checkbox" name="reserveDisclosed" ${edit.reserveDisclosed === false ? "" : "checked"}> Reserve status disclosed to bidders</label>
        <div class="notice"><b>Standard rules remain active.</b><br>Quick List does not change the rolling soft close, payment period, auction rules, server-time handling or launch controls.</div>
      </div></details>
      <div class="sticky-save"><button class="btn btn-primary quick-save" id="saveDraftBtn" type="submit">${edit.id ? "Save Draft Changes" : "Save Draft"}</button></div>
    </form>
  </div>`;
  const inventory = d.auctions.length
    ? `<div class="inventory-list">${d.auctions.map((a) => `<article class="inventory-item" id="lot-${a.id}"><div class="inventory-thumb">${a.images[0] ? `<img src="${esc(a.images[0].url)}" alt="${esc(a.title)}">` : "<span>No photo</span>"}</div><div class="inventory-main"><div class="inventory-title-row"><div><b>${esc(a.title)}</b><div class="muted small">${esc(a.category)} · ${a.images.length} photo${a.images.length === 1 ? "" : "s"}</div></div>${statusChip(a)}</div><div class="inventory-meta"><span>Close ${fmtDate(a.currentEndAt)}</span><span>${randMoney(a.currentBidCents ?? a.openingBidCents)}</span></div><div class="toolbar inventory-actions"><button class="btn btn-secondary" data-edit-auction="${a.id}">Edit</button><button class="btn btn-secondary" data-images-auction="${a.id}">Photos</button><button class="btn btn-secondary" data-preview-auction="${a.id}">Preview</button>${a.status === "draft" ? `<button class="btn btn-secondary" data-duplicate-auction="${a.id}">Duplicate</button><button class="btn btn-secondary" data-test-yoco="${a.id}">Test Yoco</button><button class="btn btn-accent" data-publish-auction="${a.id}">Publish</button>` : ""}</div></div></article>`).join("")}</div>`
    : '<div class="empty">No auctions yet.</div>';
  return `${formOrConfirmation}<div class="panel inventory-panel" id="inventory" style="margin-top:16px"><div class="section-head"><div><div class="label">Stock</div><h3>Auction inventory</h3></div>${state.quickSavedAuction ? '<button class="btn btn-primary" id="newQuickListing">+ Quick List</button>' : ""}</div>${inventory}</div>`;
}
function toLocalInput(v) {
  if (!v) return "";
  const d = new Date(v);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const QUICK_CONDITIONS = [
  "New",
  "Like New",
  "Good",
  "Fair",
  "Poor",
  "Untested",
  "For parts",
  "Other",
];
function quickConditionParts(text = "") {
  const raw = String(text || "").trim();
  for (const choice of QUICK_CONDITIONS.filter((x) => x !== "Other")) {
    if (raw === choice) return { choice, note: "" };
    if (raw.startsWith(choice + " — "))
      return { choice, note: raw.slice(choice.length + 3) };
  }
  return raw ? { choice: "Other", note: raw } : { choice: "Good", note: "" };
}
function quickConditionText(choice, note) {
  const c = QUICK_CONDITIONS.includes(String(choice)) ? String(choice) : "Good";
  const n = String(note || "").trim();
  if (c === "Other") return n || "Other";
  return n ? `${c} — ${n}` : c;
}
function cleanupQuickObjectUrls() {
  for (const p of state.quickPhotos || [])
    if (p.kind === "new" && p.url) URL.revokeObjectURL(p.url);
}
function ensureQuickPhotos(edit = {}) {
  const key = edit?.id || "new";
  if (state.quickPhotoKey === key) return;
  cleanupQuickObjectUrls();
  state.quickPhotoKey = key;
  state.quickPhotos = (edit?.images || []).map((im) => ({
    kind: "existing",
    id: im.id,
    url: im.url,
    alt: im.alt || edit.title || "",
  }));
  state.quickOriginalImageIds = state.quickPhotos.map((x) => x.id);
}
function resetQuickPhotos(edit = {}) {
  state.quickPhotoKey = null;
  ensureQuickPhotos(edit);
}
function renderQuickPhotoTray() {
  const tray = $("#quickPhotoTray"),
    count = $("#quickPhotoCount");
  if (!tray) return;
  if (count)
    count.textContent = `${state.quickPhotos.length} photo${state.quickPhotos.length === 1 ? "" : "s"}`;
  if (!state.quickPhotos.length) {
    tray.innerHTML =
      '<div class="quick-photo-empty">No photos selected yet.</div>';
    return;
  }
  tray.innerHTML = state.quickPhotos
    .map(
      (p, i) =>
        `<div class="quick-photo-card"><div class="quick-photo-img"><img src="${esc(p.url)}" alt="${esc(p.alt || `Photo ${i + 1}`)}">${i === 0 ? '<span class="cover-badge">Cover</span>' : ""}</div><div class="quick-photo-controls"><button type="button" class="photo-move" data-photo-left="${i}" aria-label="Move photo left" ${i === 0 ? "disabled" : ""}>←</button><button type="button" class="photo-move" data-photo-right="${i}" aria-label="Move photo right" ${i === state.quickPhotos.length - 1 ? "disabled" : ""}>→</button><button type="button" class="photo-remove" data-photo-remove="${i}" aria-label="Remove photo">×</button></div></div>`,
    )
    .join("");
}
function addQuickFiles(fileList) {
  const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);
  let added = 0;
  for (const file of [...(fileList || [])]) {
    if (!allowed.has(file.type)) {
      toast(`${file.name}: use JPEG, PNG, WebP or GIF.`, true);
      continue;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast(`${file.name}: image must be 8 MB or smaller.`, true);
      continue;
    }
    state.quickPhotos.push({
      kind: "new",
      file,
      url: URL.createObjectURL(file),
      alt: "",
    });
    added++;
  }
  if (added) renderQuickPhotoTray();
}
function bindQuickPhotoControls() {
  const camera = $("#quickCameraInput"),
    gallery = $("#quickGalleryInput"),
    tray = $("#quickPhotoTray");
  if (camera)
    camera.onchange = (e) => {
      addQuickFiles(e.target.files);
      camera.value = "";
    };
  if (gallery)
    gallery.onchange = (e) => {
      addQuickFiles(e.target.files);
      gallery.value = "";
    };
  if (tray) {
    tray.onclick = (e) => {
      const remove = e.target.closest("[data-photo-remove]"),
        left = e.target.closest("[data-photo-left]"),
        right = e.target.closest("[data-photo-right]");
      let i;
      if (remove) {
        i = Number(remove.dataset.photoRemove);
        const [item] = state.quickPhotos.splice(i, 1);
        if (item?.kind === "new" && item.url) URL.revokeObjectURL(item.url);
        renderQuickPhotoTray();
        return;
      }
      if (left) {
        i = Number(left.dataset.photoLeft);
        if (i > 0)
          [state.quickPhotos[i - 1], state.quickPhotos[i]] = [
            state.quickPhotos[i],
            state.quickPhotos[i - 1],
          ];
        renderQuickPhotoTray();
        return;
      }
      if (right) {
        i = Number(right.dataset.photoRight);
        if (i < state.quickPhotos.length - 1)
          [state.quickPhotos[i], state.quickPhotos[i + 1]] = [
            state.quickPhotos[i + 1],
            state.quickPhotos[i],
          ];
        renderQuickPhotoTray();
      }
    };
  }
  renderQuickPhotoTray();
}
async function saveQuickPhotos(aid, title) {
  for (const item of state.quickPhotos) {
    if (item.kind !== "new") continue;
    const form = new FormData();
    form.append("file", item.file);
    form.append("alt", title || "Auction item");
    const d = await api(`admin/auctions/${aid}/image`, {
      method: "POST",
      body: form,
    });
    if (item.url) URL.revokeObjectURL(item.url);
    item.kind = "existing";
    item.id = d.image.id;
    item.url = d.image.url;
    item.alt = title || "";
    delete item.file;
  }
  const desiredIds = state.quickPhotos
    .filter((x) => x.kind === "existing")
    .map((x) => x.id);

  const desiredSet = new Set(desiredIds);
  for (const oldId of state.quickOriginalImageIds)
    if (!desiredSet.has(oldId)) {
      try {
        await api(`admin/images/${oldId}`, { method: "DELETE" });
      } catch (e) {
        if (e.status !== 404) throw e;
      }
    }
  await api(`admin/auctions/${aid}/images/reorder`, {
    method: "POST",
    body: { imageIds: desiredIds },
  });
  state.quickOriginalImageIds = [...desiredIds];
}
function setQuickError(message = "") {
  const box = $("#quickListError");
  if (!box) return;
  box.hidden = !message;
  box.textContent = message;
  if (message) box.scrollIntoView({ behavior: "smooth", block: "center" });
}
function quickConfirmation(a) {
  return `<div class="panel quick-confirm"><div class="quick-confirm-icon">✓</div><div class="label">Draft saved</div><h3>${esc(a.title)}</h3><p class="muted">${a.images?.length || 0} photo${a.images?.length === 1 ? "" : "s"} · closes ${fmtDate(a.scheduledEndAt)}</p><div class="quick-confirm-actions"><button class="btn btn-primary" data-confirm-edit="${a.id}">Edit</button><button class="btn btn-secondary" data-confirm-photos="${a.id}">Add / reorder photos</button><button class="btn btn-secondary" data-preview-auction="${a.id}">Preview listing</button><button class="btn btn-secondary" data-duplicate-auction="${a.id}">Duplicate listing</button><button class="btn btn-secondary" data-back-inventory>Back to inventory</button></div></div>`;
}
async function openQuickEdit(aid, focusPhotos = false) {
  const d = await api("auctions/" + aid);
  state.editingAuction = d.auction;
  state.quickSavedAuction = null;
  resetQuickPhotos(d.auction);
  await render();
  setTimeout(
    () =>
      $(focusPhotos ? "#quickPhotos" : "#quickListPanel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    50,
  );
}
async function duplicateAuction(aid) {
  try {
    const d = await api(`admin/auctions/${aid}/duplicate`, { method: "POST" });
    const auction = d.auction || (await api("auctions/" + d.auctionId)).auction;
    state.editingAuction = auction;
    state.quickSavedAuction = null;
    resetQuickPhotos(auction);
    toast("Draft duplicated. Change the title, photos or price and save.");
    await render();
    setTimeout(
      () =>
        $("#quickListPanel")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      50,
    );
  } catch (e) {
    toast(e.message, true);
  }
}
async function adminUsers() {
  const d = await api("admin/users");
  return `<div class="panel"><h3>Bidder verification</h3><p class="muted small"><b>Verification status</b> shows whether a bidder is Pending, Verified or Suspended. <b>Admin controls</b> are the buttons you use to verify, unverify, suspend or restore that bidder.</p><div class="table-wrap"><table><thead><tr><th>Name & surname</th><th>Contact number</th><th>Email</th><th>ID number</th><th>Verification status</th><th>Admin controls</th></tr></thead><tbody>${d.users
    .filter((u) => u.role === "bidder")
    .map(
      (u) =>
        `<tr><td><b>${esc(u.first_name)} ${esc(u.last_name)}</b></td><td>${esc(u.mobile)}</td><td>${esc(u.email)}</td><td>${esc(u.id_number)}</td><td>${u.suspended ? "Suspended" : u.verified ? "Verified" : "Pending review"}</td><td><div class="toolbar"><button class="btn btn-secondary small" data-verify-user="${u.id}" data-value="${u.verified ? "0" : "1"}">${u.verified ? "Mark pending" : "Mark verified"}</button><button class="btn btn-danger small" data-suspend-user="${u.id}" data-value="${u.suspended ? "0" : "1"}">${u.suspended ? "Restore" : "Suspend"}</button></div></td></tr>`,
    )
    .join("")}</tbody></table></div></div>`;
}
async function adminRecords() {
  const d = await api("admin/founder-email-preview");
  const recipients = d.recipients || [];
  const recipientRows = recipients
    .map(
      (r) =>
        `<tr><td><b>#${r.signupRank}</b></td><td>${esc(r.firstName)} ${esc(r.lastName)}</td><td>${esc(r.email)}</td><td>${r.hasAccount ? "Created" : "Not created"}</td><td>${r.hasIdNumber ? "Submitted" : "Not submitted"}</td><td>${r.suspended ? "Suspended" : r.verified ? "Verified" : "Pending"}</td><td>${r.emailsPlanned.map(esc).join(", ")}</td></tr>`,
    )
    .join("");
  return `<div class="panel"><h3>Records & launch list</h3><p>Export the early-access list, bidder record and vendor roll for launch planning and compliance administration.</p><div class="toolbar"><a class="btn btn-secondary" href="/api/admin/records/early-access.csv">Download early-access CSV</a><a class="btn btn-secondary" href="/api/admin/records/bidders.csv">Download bidders CSV</a><a class="btn btn-secondary" href="/api/admin/records/vendor-roll.csv">Download vendor roll CSV</a></div><p class="muted small">Access to these exports is restricted to administrator sessions.</p></div><div class="panel" style="margin-top:16px"><h3>Founder email recipients</h3><p class="muted small">Preview the first 100 Early Access signups and their current verification status.</p><div class="toolbar" style="margin-bottom:12px"><button class="btn btn-secondary" id="smtpTestBtn">Send SMTP test to info@</button><button class="btn btn-primary" id="founderEmailsBtn">Send outstanding founder emails</button></div><div class="table-wrap"><table><thead><tr><th>Signup</th><th>Name</th><th>Email</th><th>Account</th><th>ID number</th><th>Verification</th><th>Emails planned</th></tr></thead><tbody>${recipientRows || '<tr><td colspan="7">No Early Access signups yet.</td></tr>'}</tbody></table></div><p class="muted small">Delivery is idempotent: emails already recorded as sent are not sent twice.</p></div>`;
}
function modal(html) {
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-head"><div></div><button class="x" id="modalX">×</button></div>${html}</div></div>`,
  );
  $("#modalX").onclick = closeModal;
  $("#modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });
}
function closeModal() {
  $("#modal")?.remove();
}
function closeMobileMenu() {
  $("#mobileNav")?.remove();
}
function showMobileMenu() {
  closeMobileMenu();
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="mobile-nav-backdrop" id="mobileNav"><nav class="mobile-nav-panel" aria-label="Mobile navigation"><div class="mobile-nav-head"><b>Menu</b><button class="x" id="mobileNavX" aria-label="Close menu">×</button></div><a data-link href="/">Home</a><a data-link href="/auctions">Auctions</a><a data-link href="/how-it-works">How it works</a><a data-link href="/about">About</a><a data-link href="/contact">Contact</a>${state.me ? '<a data-link href="/account">My account</a>' : '<a data-link href="/join">Join early access</a><button id="mobileLogin">Sign in</button>'}${state.me?.role === "admin" ? '<a data-link href="/admin">Admin</a>' : ""}<a data-link href="/legal">Legal centre</a><a data-link href="/install">Install the app</a></nav></div>`,
  );
  $("#mobileNavX").onclick = closeMobileMenu;
  $("#mobileNav").onclick = (e) => {
    if (e.target.id === "mobileNav") closeMobileMenu();
  };
  $$("#mobileNav [data-link]").forEach((link) => link.addEventListener("click", closeMobileMenu));
  const mobileLogin = $("#mobileLogin");
  if (mobileLogin) mobileLogin.onclick = () => {
    closeMobileMenu();
    showLogin(false);
  };
}
function showLogin() {
  modal(`<h2>Sign in to your Early Access account</h2>${loginForm()}<p class="muted small">No account yet? Join on the dedicated Early Access page.</p>`);
  bindAuth();
}
function loginForm() {
  return `<form id="loginForm" class="admin-form"><div class="field"><label>Email</label><input class="input" name="email" type="email" required></div><div class="field"><label>Password</label><input class="input" name="password" type="password" required></div><button class="btn btn-primary">Sign in</button></form>`;
}
function bindAuth() {
  const lf = $("#loginForm");
  if (lf)
    lf.onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(lf);
      try {
        const d = await api("login", {
          method: "POST",
          body: { email: f.get("email"), password: f.get("password") },
        });
        state.me = d.me;
        closeModal();
        toast("Signed in.");
        render();
      } catch (x) {
        toast(x.message, true);
      }
    };
}
function bindEarlyAccess() {
  const form = $("#earlyAccessForm");
  if (!form) return;
  let started = false;
  form.addEventListener("focusin", () => {
    if (!started) {
      started = true;
      trackFunnel("early_access_form_start");
    }
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(form),
      button = form.querySelector("button");
    button.disabled = true;
    try {
      const d = await api("early-access", {
        method: "POST",
        body: {
          fullName: f.get("fullName"),
          email: f.get("email"),
          mobile: f.get("mobile"),
          marketingOptIn: f.get("marketingOptIn") === "on",
        },
      });
      trackFunnel("early_access_signup_success");
      form.outerHTML = `<div class="join-success" id="earlyAccessSuccess"><div>✓</div><h2>You’re on the list!</h2><p>${esc(d.message)}</p>${d.freeActivationEligible ? '<div class="notice good"><b>Free bidder activation secured</b><br>Your signup is within the first 100.</div>' : ""}<p>You can stop here, or create a login now so your private bidder-registration link is ready when you want it.</p><form id="earlyAccessAccountForm" class="admin-form"><div class="field"><label>Create a password</label><input class="input" type="password" minlength="10" name="password" autocomplete="new-password" required></div><label class="switch consent"><input type="checkbox" name="confirmAdult" required><span>I confirm that I am 18 years or older.</span></label><label class="switch consent"><input type="checkbox" name="acceptTerms" required><span>I accept the <a href="/legal/terms-auction-rules.pdf" target="_blank">Terms & Auction Rules</a>.</span></label><button class="btn btn-primary">Create my optional account</button></form><a class="btn btn-secondary" href="/" data-link>Browse previews instead</a></div>`;
      trackFunnel("early_access_account_step");
      bindEarlyAccessAccount(d.email, d.accountToken);
      toast(d.message);
    } catch (x) {
      trackFunnel("early_access_submit_error");
      toast(x.message, true);
      button.disabled = false;
    }
  };
}
function bindEarlyAccessAccount(email, accountToken) {
  const form = $("#earlyAccessAccountForm");
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      const d = await api("early-access/account", {
        method: "POST",
        body: {
          email,
          accountToken,
          password: data.get("password"),
          confirmAdult: data.get("confirmAdult") === "on",
          acceptTerms: data.get("acceptTerms") === "on",
        },
      });
      state.me = d.me;
      trackFunnel("early_access_account_success");
      toast(d.message);
      go("/profile");
    } catch (x) {
      toast(x.message, true);
      button.disabled = false;
    }
  };
}
async function imageModal(aid) {
  openQuickEdit(aid, true);
}
function installUI() {
  if (state.deferredInstall && !$("#installBanner"))
    (document.body.insertAdjacentHTML(
      "beforeend",
      `<div class="install-banner" id="installBanner"><p><b>Install Whacky Auctions</b><br>Add the app to your phone for a full-screen experience.</p><button class="btn btn-primary" id="installBtn">Install</button></div>`,
    ),
      ($("#installBtn").onclick = async () => {
        state.deferredInstall.prompt();
        await state.deferredInstall.userChoice;
        state.deferredInstall = null;
        $("#installBanner")?.remove();
      }));
}
async function bind() {
  bindEarlyAccess();
  const smtpTestBtn = $("#smtpTestBtn");
  if (smtpTestBtn)
    smtpTestBtn.onclick = async () => {
      smtpTestBtn.disabled = true;
      try {
        const d = await api("admin/smtp-test", { method: "POST" });
        toast(d.message || "SMTP test sent.");
      } catch (e) {
        toast(e.message, true);
        smtpTestBtn.disabled = false;
      }
    };
  const founderEmailsBtn = $("#founderEmailsBtn");
  if (founderEmailsBtn)
    founderEmailsBtn.onclick = async () => {
      founderEmailsBtn.disabled = true;
      try {
        const d = await api("admin/founder-email-send", { method: "POST" });
        toast(d.message || "Outstanding founder emails processed.");
        await render();
      } catch (e) {
        toast(e.message, true);
        founderEmailsBtn.disabled = false;
      }
    };
  const registerYoco = $("#registerYocoWebhook");
  if (registerYoco)
    registerYoco.onclick = async () => {
      registerYoco.disabled = true;
      try {
        const d = await api("admin/yoco/register-webhook", { method: "POST" });
        toast(`Yoco webhook registered in ${d.mode || "test"} mode.`);
        registerYoco.textContent = "Yoco webhook registered";
      } catch (e) {
        toast(e.message, true);
        registerYoco.disabled = false;
      }
    };
  const lb = $("#loginBtn"),
    hb = $("#heroRegister"),
    lh = $("#loginHere"),
    ab = $("#accountBtn");
  if (lb) lb.onclick = () => showLogin(false);
  if (hb) hb.onclick = () => showLogin(true);
  if (lh) lh.onclick = () => showLogin(false);
  if (ab) ab.onclick = () => go("/profile");
  const mb = $("#mobileBtn");
  if (mb) mb.onclick = showMobileMenu;
  $$("#modal [data-link]").forEach((x) =>
    x.addEventListener("click", closeModal),
  );
  $$("[data-photo]").forEach(
    (b, i) =>
      (b.onclick = () => {
        $("#mainPhoto").src = b.dataset.photo;
        $$("[data-photo]").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
      }),
  );
  const watch = $("#watchBtn");
  if (watch)
    watch.onclick = async () => {
      if (!state.me) return showLogin();
      const id = route().split("/")[1];
      try {
        const d = await api("watchlist/" + id, { method: "POST" });
        watch.textContent = d.watched ? "★ Watching" : "☆ Watch";
        toast(d.watched ? "Added to watchlist" : "Removed from watchlist");
      } catch (e) {
        toast(e.message, true);
      }
    };
  const shareAuction = $("#shareAuction");
  if (shareAuction)
    shareAuction.onclick = async () => {
      const share = { title: document.title, text: state.seoAuction?.description || "See this item on Whacky Auctions", url: location.href };
      try {
        if (navigator.share) await navigator.share(share);
        else {
          await navigator.clipboard.writeText(location.href);
          toast("Auction link copied. Share it on WhatsApp or Facebook.");
        }
      } catch (e) {
        if (e?.name !== "AbortError") toast("Could not share this item.", true);
      }
    };
  $$("[data-retract-bid]").forEach(
    (b) =>
      (b.onclick = async () => {
        const reason =
          prompt(
            "Reason for bid retraction (before sale completion):",
            "Bid entered in error",
          ) || "Bidder retraction before completion";
        if (
          !confirm(
            "Retract this bid? This action is recorded in the auction log.",
          )
        )
          return;
        try {
          await api(`bids/${b.dataset.retractBid}/retract`, {
            method: "POST",
            body: { reason },
          });
          toast("Bid retracted.");
          render();
        } catch (e) {
          toast(e.message, true);
        }
      }),
  );
  const payNow = $("#payNow");
  if (payNow)
    payNow.onclick = async () => {
      const id = route().split("/")[1];
      payNow.disabled = true;
      try {
        const d = await api(`checkout/${id}`, { method: "POST" });
        if (d.redirectUrl) location.href = d.redirectUrl;
        else toast(d.message || "Payment started.");
      } catch (e) {
        toast(e.message, true);
      } finally {
        payNow.disabled = false;
      }
    };
  const verifyBidderForm = $("#verifyBidderForm");
  if (verifyBidderForm)
    verifyBidderForm.onsubmit = async (e) => {
      e.preventDefault();
      const button = verifyBidderForm.querySelector("button");
      const form = new FormData(verifyBidderForm);
      button.disabled = true;
      try {
        const d = await api("me/verification/checkout", { method: "POST", body: { idNumber: form.get("idNumber") } });
        if (d.redirectUrl) {
          trackFunnel("verification_checkout_started");
          location.href = d.redirectUrl;
        } else if (d.freeActivation) {
          trackFunnel("verification_free_activation");
          state.me.verified = true;
          toast(d.message);
          go("/profile");
        } else toast(d.message || "Bidder verification is already complete.");
      } catch (e) {
        trackFunnel("verification_submit_error");
        toast(e.message, true);
        button.disabled = false;
      }
    };
  const pb = $("#placeBid");
  if (pb)
    pb.onclick = async () => {
      const id = route().split("/")[1],
        amount = Math.round(Number($("#bidAmount").value) * 100);
      if (!confirm(`Place a binding bid of ${randMoney(amount)}?`)) return;
      pb.disabled = true;
      try {
        const d = await api(`auctions/${id}/bid`, {
          method: "POST",
          body: { amountCents: amount },
        });
        toast(
          d.softCloseExtended
            ? "Bid placed — soft close extended."
            : "Bid placed.",
        );
        await render();
      } catch (e) {
        toast(e.message, true);
      } finally {
        pb.disabled = false;
      }
    };
  $$("[data-tab]").forEach(
    (t) =>
      (t.onclick = async () => {
        const id = route().split("/")[1],
          d = await api("auctions/" + id);
        $$("[data-tab]").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        $("#tabBody").innerHTML = detailTab(d.auction, t.dataset.tab);
      }),
  );
  const lo = $("#logoutBtn");
  if (lo)
    lo.onclick = async () => {
      await api("logout", { method: "POST" });
      state.me = null;
      go("/");
    };
  const pf = $("#passwordForm");
  if (pf)
    pf.onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(pf);
      try {
        await api("me/password", {
          method: "POST",
          body: {
            currentPassword: f.get("currentPassword"),
            newPassword: f.get("newPassword"),
          },
        });
        toast("Password changed.");
        pf.reset();
      } catch (x) {
        toast(x.message, true);
      }
    };
  const rn = $("#readNotes");
  if (rn)
    rn.onclick = async () => {
      await api("me/notifications/read", { method: "POST" });
      toast("Notifications marked read.");
      render();
    };
  $$("[data-admin-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        state.adminTab = b.dataset.adminTab;
        state.editingAuction = null;
        render();
      }),
  );
  const ipb = $("#installPageBtn");
  if (ipb && state.deferredInstall)
    ipb.onclick = async () => {
      state.deferredInstall.prompt();
      await state.deferredInstall.userChoice;
      state.deferredInstall = null;
      render();
    };
  const pr = $("#printRules");
  if (pr) pr.onclick = () => print();
  const drf = $("#dealerRegistrationForm");
  if (drf)
    drf.onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(drf);
      try {
        await api("admin/settings/dealer-registration", {
          method: "POST",
          body: {
            registrationNumber: f.get("registrationNumber"),
            expiryDate: f.get("expiryDate"),
            confirmed: f.get("confirmed") === "on",
          },
        });
        toast("Registration status saved.");
        await bootstrap();
      } catch (x) {
        toast(x.message, true);
      }
    };
  const tt = $("#tradeToggle");
  if (tt)
    tt.onclick = async () => {
      const desired = tt.textContent.includes("Enable");
      if (
        desired &&
        !confirm(
          "Only enable trading once Whacky Auctions is legally ready to trade and the payment gateway is active. Continue?",
        )
      )
        return;
      try {
        await api("admin/settings/trading", {
          method: "POST",
          body: { enabled: desired },
        });
        state.settings.tradingEnabled = desired;
        toast(desired ? "Trading enabled." : "Trading disabled.");
        render();
      } catch (e) {
        toast(e.message, true);
      }
    };
  const sf = $("#adminSetupForm");
  if (sf)
    sf.onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(sf);
      try {
        const d = await api("admin/setup", {
          method: "POST",
          body: { code: f.get("code"), password: f.get("password") },
        });
        state.me = d.me;
        toast(d.message);
        go("/admin");
      } catch (x) {
        toast(x.message, true);
      }
    };
  const af = $("#auctionForm");
  if (af) af.onsubmit = saveAuction;
  bindQuickPhotoControls();
  const ce = $("#cancelEdit");
  if (ce)
    ce.onclick = () => {
      state.editingAuction = null;
      state.quickSavedAuction = null;
      resetQuickPhotos({});
      render();
    };
  const nq = $("#newQuickListing");
  if (nq)
    nq.onclick = () => {
      state.editingAuction = null;
      state.quickSavedAuction = null;
      resetQuickPhotos({});
      render();
    };
  $$("[data-edit-auction]").forEach(
    (b) => (b.onclick = () => openQuickEdit(b.dataset.editAuction)),
  );
  $$("[data-images-auction]").forEach(
    (b) => (b.onclick = () => imageModal(b.dataset.imagesAuction)),
  );
  $$("[data-confirm-edit]").forEach(
    (b) => (b.onclick = () => openQuickEdit(b.dataset.confirmEdit)),
  );
  $$("[data-confirm-photos]").forEach(
    (b) => (b.onclick = () => openQuickEdit(b.dataset.confirmPhotos, true)),
  );
  $$("[data-preview-auction]").forEach(
    (b) => (b.onclick = () => go("/auction/" + b.dataset.previewAuction)),
  );
  $$("[data-duplicate-auction]").forEach(
    (b) => (b.onclick = () => duplicateAuction(b.dataset.duplicateAuction)),
  );
  $$("[data-back-inventory]").forEach(
    (b) =>
      (b.onclick = () => {
        state.quickSavedAuction = null;
        state.editingAuction = null;
        resetQuickPhotos({});
        render();
        setTimeout(
          () =>
            $("#inventory")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
          50,
        );
      }),
  );
  $$("[data-test-yoco]").forEach(
    (b) =>
      (b.onclick = async () => {
        b.disabled = true;
        try {
          const d = await api(
            `admin/auctions/${b.dataset.testYoco}/test-checkout`,
            { method: "POST" },
          );
          modal(
            `<div class="label">Yoco test mode</div><h2>Checkout ready</h2><p>Test amount: <b>${randMoney(d.amountCents)}</b></p><p class="muted small">This test will not publish the draft or create a genuine order.</p><a class="btn btn-primary" href="${esc(d.redirectUrl)}" target="_blank" rel="noopener">Open Yoco checkout ↗</a>`,
          );
          toast("Yoco test checkout created.");
        } catch (e) {
          if (e.status === 401) showLogin(false);
          else toast(e.message, true);
        } finally {
          b.disabled = false;
        }
      }),
  );
  $$("[data-publish-auction]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (
          !confirm(
            "Publish this auction? The auction-specific rules must remain available as required by law.",
          )
        )
          return;
        try {
          await api(`admin/auctions/${b.dataset.publishAuction}/publish`, {
            method: "POST",
          });
          toast("Auction published.");
          render();
        } catch (e) {
          toast(e.message, true);
        }
      }),
  );
  $$("[data-verify-user]").forEach(
    (b) =>
      (b.onclick = async () => {
        await api(`admin/users/${b.dataset.verifyUser}/verify`, {
          method: "POST",
          body: { verified: b.dataset.value === "1" },
        });
        toast("Bidder status updated.");
        render();
      }),
  );
  $$("[data-suspend-user]").forEach(
    (b) =>
      (b.onclick = async () => {
        await api(`admin/users/${b.dataset.suspendUser}/suspend`, {
          method: "POST",
          body: { suspended: b.dataset.value === "1" },
        });
        toast("Account status updated.");
        render();
      }),
  );
  installUI();
}
async function saveAuction(e) {
  e.preventDefault();
  setQuickError("");
  const form = e.target,
    f = new FormData(form),
    saveBtn = $("#saveDraftBtn");
  const title = String(f.get("title") || "").trim();
  const endRaw = String(f.get("endAt") || "");
  const startRaw = String(f.get("startAt") || "");
  const opening = Number(f.get("openingBid"));
  if (!title) return setQuickError("Enter an item title.");
  if (!f.get("conditionChoice"))
    return setQuickError("Choose the item condition.");
  if (!Number.isFinite(opening) || opening < 0)
    return setQuickError("Enter a valid opening bid.");
  if (!endRaw)
    return setQuickError("Choose the auction closing date and time.");
  const start = new Date(startRaw),
    end = new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    return setQuickError("Check the auction start and closing date/time.");
  if (!(start < end))
    return setQuickError(
      "The closing time must be after the start time. Open Advanced settings to adjust the start time.",
    );
  const reserveRaw = String(f.get("reserve") ?? "");
  const reserve = reserveRaw === "" ? null : Number(reserveRaw);
  if (reserve != null && (!Number.isFinite(reserve) || reserve < 0))
    return setQuickError("Enter a valid reserve price or leave it blank.");
  const payload = {
    title,
    category: f.get("category") || "General",
    description: String(f.get("description") || "").trim(),
    conditionText: quickConditionText(
      f.get("conditionChoice"),
      f.get("conditionNote"),
    ),
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    openingBidCents: Math.round(opening * 100),
    bidIncrementCents: Math.round(Number(f.get("increment") || 10) * 100),
    reservePriceCents: reserve == null ? null : Math.round(reserve * 100),
    buyerPremiumPercent: Number(f.get("premium") || 0),
    softCloseSeconds: Number(
      f.get("softClose") || state.settings.softCloseSeconds || 120,
    ),
    paymentDeadlineHours: Number(f.get("paymentHours") || 2),
    auctioneerName: f.get("auctioneerName"),
    vatNote: f.get("vatNote"),
    inspectionNote: f.get("inspectionNote"),
    collectionNote: f.get("collectionNote"),
    storageFeeNote: f.get("storageFeeNote"),
    reserveDisclosed: f.get("reserveDisclosed") === "on",
  };
  let aid = String(f.get("id") || "");
  if (saveBtn) saveBtn.disabled = true;
  try {
    if (aid)
      await api("admin/auctions/" + aid, { method: "PUT", body: payload });
    else {
      const d = await api("admin/auctions", { method: "POST", body: payload });
      aid = d.auctionId;
      const hidden = form.querySelector("[name=id]");
      if (hidden) hidden.value = aid;
    }
    await saveQuickPhotos(aid, title);
    const latest = await api("auctions/" + aid);
    state.quickSavedAuction = latest.auction;
    state.editingAuction = null;
    state.quickPhotoKey = null;
    state.quickPhotos = [];
    state.quickOriginalImageIds = [];
    toast("Draft saved.");
    await render();
    setTimeout(
      () =>
        $(".quick-confirm")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      50,
    );
  } catch (x) {
    setQuickError(x.message);
    toast(x.message, true);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}
async function render() {
  const app = $("#app");
  const r = route();
  app.innerHTML =
    '<div class="container" style="padding:80px 0"><div class="muted">Loading Whacky Auctions…</div></div>';
  let html;
  try {
    if (r === "home") html = await home();
    else if (r === "auctions") html = await auctionsPage();
    else if (r === "how-it-works") html = howItWorks();
    else if (r === "about") html = aboutPage();
    else if (r === "contact") html = contactPage();
    else if (r === "join") html = await joinPage();
    else if (r === "account") html = accountPage();
    else if (r.startsWith("auction/"))
      html = await auctionPage(r.split("/")[1]);
    else if (r === "my-bids") html = await accountList("bids");
    else if (r === "watchlist") html = await accountList("watchlist");
    else if (r === "wins") html = await accountList("wins");
    else if (r === "profile") html = await profile();
    else if (r === "verify-bidder") html = await verifyBidderPage();
    else if (r === "legal") html = legal();
    else if (r === "install") html = installPage();
    else if (r.startsWith("rules/")) html = await rulesPage(r.split("/")[1]);
    else if (r === "admin-setup") html = adminSetup();
    else if (r === "admin") html = await admin();
    else html = errorPage("Page not found.");
  } catch (e) {
    console.error(e);
    html = errorPage(e.message || "Something went wrong.");
  }
  app.innerHTML = html;
  applySeo(r);
  await bind();
  recordPageView();
  tick();
}
function tick() {
  $$("[data-countdown]").forEach((el) => {
    el.textContent = countdown(el.dataset.countdown, el.dataset.status);
  });
}
setInterval(tick, 1000);
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  state.deferredInstall = e;
  installUI();
});
if ("serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(console.error),
  );
bootstrap();
