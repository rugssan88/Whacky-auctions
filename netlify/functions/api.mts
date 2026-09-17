import type { Config } from "@netlify/functions";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  db,
  imageStore,
  json,
  ok,
  fail,
  id,
  slugify,
  hashPassword,
  verifyPassword,
  getUser,
  requireUser,
  requireAdmin,
  createSession,
  deleteSession,
  clearSessionCookie,
  getSettings,
  setSetting,
  audit,
  ensureBootstrapAdmin,
  closeExpiredAuctions,
  safeUser,
  asCents,
  isAdult,
  getClientIp,
  sha256,
} from "./lib/core.mts";
import { createCheckout } from "./lib/payment-gateway.mts";

const clean = (s: any, max = 5000) =>
  String(s ?? "")
    .trim()
    .slice(0, max);
const money = (v: any) => Number(v ?? 0);

async function verifyYocoWebhook(rawBody: string, req: Request) {
  const settings = await getSettings();
  const secret = (
    Netlify.env.get("YOCO_WEBHOOK_SECRET") ||
    settings.yoco_webhook_secret ||
    ""
  ).trim();
  if (!secret)
    throw Object.assign(new Error("Yoco webhook secret is not configured."), {
      status: 503,
      code: "YOCO_WEBHOOK_NOT_CONFIGURED",
    });
  const webhookId = req.headers.get("webhook-id") || "";
  const timestamp = req.headers.get("webhook-timestamp") || "";
  const signatureHeader = req.headers.get("webhook-signature") || "";
  const timestampNumber = Number(timestamp);
  if (
    !webhookId ||
    !timestamp ||
    !signatureHeader ||
    !Number.isFinite(timestampNumber) ||
    Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > 180
  ) {
    throw Object.assign(new Error("Invalid Yoco webhook headers."), {
      status: 403,
      code: "YOCO_WEBHOOK_INVALID",
    });
  }
  const secretPart = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(secretPart, "base64");
  } catch {
    throw Object.assign(new Error("Invalid Yoco webhook secret."), {
      status: 503,
      code: "YOCO_WEBHOOK_SECRET_INVALID",
    });
  }
  const expected = createHmac("sha256", secretBytes)
    .update(`${webhookId}.${timestamp}.${rawBody}`)
    .digest("base64");
  const valid = signatureHeader.split(" ").some((entry) => {
    const provided = entry.split(",")[1] || "";
    const a = Buffer.from(expected),
      b = Buffer.from(provided);
    return a.length === b.length && timingSafeEqual(a, b);
  });
  if (!valid)
    throw Object.assign(new Error("Invalid Yoco webhook signature."), {
      status: 403,
      code: "YOCO_WEBHOOK_INVALID",
    });
}

async function auctionDto(
  a: any,
  userId?: string | null,
  includeBids = false,
  adminView = false,
) {
  const images =
    await db.sql`SELECT id,blob_key,alt_text,sort_order FROM auction_images WHERE auction_id=${a.id} ORDER BY sort_order,id`;
  const highRows =
    await db.sql`SELECT b.id,b.amount_cents,b.user_id,b.created_at,u.first_name,u.last_name
                                FROM bids b JOIN users u ON u.id=b.user_id
                                WHERE b.auction_id=${a.id} AND b.retracted_at IS NULL
                                ORDER BY b.amount_cents DESC,b.created_at ASC LIMIT 1`;
  const high = highRows[0] || null;
  const bidCount =
    await db.sql`SELECT COUNT(*)::int AS c FROM bids WHERE auction_id=${a.id} AND retracted_at IS NULL`;
  const watched = userId
    ? (
        await db.sql`SELECT 1 FROM watchlist WHERE user_id=${userId} AND auction_id=${a.id} LIMIT 1`
      ).length > 0
    : false;
  const payload: any = {
    id: a.id,
    slug: a.slug,
    title: a.title,
    category: a.category,
    description: a.description,
    condition: a.condition_text,
    status: a.status,
    startAt: a.start_at,
    scheduledEndAt: a.scheduled_end_at,
    currentEndAt: a.current_end_at,
    softCloseSeconds: a.soft_close_seconds,
    openingBidCents: Number(a.opening_bid_cents),
    bidIncrementCents: Number(a.bid_increment_cents),
    reserveDisclosed: a.reserve_disclosed,
    reserveMet:
      a.reserve_price_cents == null
        ? true
        : !!high && Number(high.amount_cents) >= Number(a.reserve_price_cents),
    buyerPremiumPercent: Number(a.buyer_premium_percent),
    vatNote: a.vat_note,
    paymentDeadlineHours: a.payment_deadline_hours,
    inspectionNote: a.inspection_note,
    collectionNote: a.collection_note,
    storageFeeNote: a.storage_fee_note,
    auctioneerName: a.auctioneer_name,
    rulesPublishedAt: a.rules_published_at,
    currentBidCents: high ? Number(high.amount_cents) : null,
    highBidderId: high?.user_id || null,
    bidCount: bidCount[0]?.c || 0,
    watched,
    images: images.map((x: any) => ({
      id: x.id,
      url: `/api/images/${encodeURIComponent(x.blob_key)}`,
      alt: x.alt_text,
      sortOrder: Number(x.sort_order),
    })),
  };
  if (adminView)
    payload.reservePriceCents =
      a.reserve_price_cents == null ? null : Number(a.reserve_price_cents);
  if (userId && high?.user_id === userId && a.status === "closed") {
    const orders =
      await db.sql`SELECT status,total_cents,hammer_price_cents,buyer_premium_cents,payment_reference,paid_at,due_at,default_fee_cents,relisted_auction_id
                                FROM orders WHERE auction_id=${a.id} AND user_id=${userId} LIMIT 1`;
    if (orders[0])
      payload.order = {
        status: orders[0].status,
        totalCents: Number(orders[0].total_cents),
        hammerPriceCents: Number(orders[0].hammer_price_cents),
        buyerPremiumCents: Number(orders[0].buyer_premium_cents),
        paymentReference: orders[0].payment_reference,
        paidAt: orders[0].paid_at,
        dueAt: orders[0].due_at,
        defaultFeeCents: orders[0].default_fee_cents == null ? null : Number(orders[0].default_fee_cents),
        relistedAuctionId: orders[0].relisted_auction_id,
      };
  }
  if (includeBids) {
    const bids =
      await db.sql`SELECT b.id,b.amount_cents,b.user_id,b.created_at,b.retracted_at,u.first_name,u.last_name
                              FROM bids b JOIN users u ON u.id=b.user_id WHERE b.auction_id=${a.id}
                              ORDER BY b.created_at DESC LIMIT 100`;
    payload.bids = bids.map((b: any) => ({
      id: b.id,
      amountCents: Number(b.amount_cents),
      createdAt: b.created_at,
      retractedAt: b.retracted_at,
      bidder: `${b.first_name} ${b.last_name.slice(0, 1)}.`,
      isMine: !!userId && b.user_id === userId,
    }));
  }
  return payload;
}

async function publicAuctions(userId?: string | null) {
  await closeExpiredAuctions();
  const rows =
    await db.sql`SELECT * FROM auctions WHERE status IN ('scheduled','live','closed','unsold') ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,current_end_at ASC,created_at DESC`;
  const out = [];
  for (const a of rows) out.push(await auctionDto(a, userId, false));
  return out;
}

async function handle(req: Request) {
  await ensureBootstrapAdmin();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const method = req.method.toUpperCase();
  const user = await getUser(req);

  if (method === "GET" && parts[0] === "health")
    return ok({ service: "Whacky Auctions", time: new Date().toISOString() });
  if (method === "POST" && parts[0] === "page-view") {
    const body = await req.json().catch(() => ({}));
    const rawPath = clean(body.path, 300).split(/[?#]/)[0] || "/";
    const viewPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    if (viewPath.startsWith("/admin") || viewPath.startsWith("/api/"))
      return ok({ recorded: false });
    await db.sql`INSERT INTO page_views(view_date,path,view_count)
                 VALUES((NOW() AT TIME ZONE 'Africa/Johannesburg')::date,${viewPath},1)
                 ON CONFLICT(view_date,path) DO UPDATE SET view_count=page_views.view_count+1`;
    return ok({ recorded: true }, 201);
  }
  if (method === "POST" && parts[0] === "admin" && parts[1] === "setup") {
    const existing =
      await db.sql`SELECT 1 FROM users WHERE role='admin' LIMIT 1`;
    if (existing.length)
      return fail("Administrator has already been configured.", 409);
    const b = await req.json();
    const expected = Netlify.env.get("ADMIN_SETUP_HASH") || "";
    if (!expected || sha256(String(b.code || "")) !== expected)
      return fail("Invalid setup code.", 403);
    const password = String(b.password || "");
    if (password.length < 10)
      return fail("Administrator password must be at least 10 characters.");
    const email = (
      Netlify.env.get("ADMIN_EMAIL") || "rugs.san88@gmail.com"
    ).toLowerCase();
    const hp = await hashPassword(password);
    const uid = id();
    const accepted = new Date().toISOString();
    await db.sql`INSERT INTO users(id,email,password_hash,password_salt,first_name,last_name,physical_address,role,verified,suspended,marketing_opt_in,accepted_terms_at,accepted_privacy_at)
                 VALUES(${uid},${email},${hp.hash},${hp.salt},'Sandeep','Rugbee','497 Ontdekkers Road, Florida Hills, Gauteng','admin',TRUE,FALSE,FALSE,${accepted},${accepted})`;
    const cookie = await createSession(uid);
    await audit(uid, "admin_setup", "user", uid, {}, req);
    const admin = (await db.sql`SELECT * FROM users WHERE id=${uid}`)[0];
    return ok(
      { me: safeUser(admin), message: "Administrator configured." },
      201,
      { "set-cookie": cookie },
    );
  }
  if (method === "GET" && parts[0] === "bootstrap") {
    await closeExpiredAuctions();
    const settings = await getSettings();
    return ok({
      me: safeUser(user),
      settings: {
        tradingEnabled: !!settings.trading_enabled,
        paymentGatewayEnabled: !!settings.payment_gateway_enabled,
        dealerRegistrationConfirmed: !!settings.dealer_registration_confirmed,
        softCloseSeconds: Number(settings.soft_close_seconds || 120),
      },
      serverTime: new Date().toISOString(),
    });
  }

  if (method === "GET" && parts[0] === "early-access" && parts[1] === "count") {
    const rows = await db.sql`SELECT COUNT(*)::int AS count FROM early_access_signups`;
    return ok({ count: Number(rows[0]?.count || 0) });
  }

  if (method === "POST" && parts[0] === "early-access") {
    const b = await req.json();
    const firstName = clean(b.firstName, 80);
    const lastName = clean(b.lastName, 80);
    const email = clean(b.email, 320).toLowerCase();
    const mobile = clean(b.mobile, 40);
    if (!firstName || !lastName || !email.includes("@") || mobile.length < 8)
      return fail("Please complete your name, email address and mobile number.");
    if (!b.acceptPrivacy)
      return fail("Please read and accept the Privacy Notice to join early access.");
    const existing = await db.sql`SELECT 1 FROM early_access_signups WHERE email=${email} LIMIT 1`;
    if (existing.length)
      return ok({ message: "You are already on the early-access list. We’ll let you know when bidding opens." });
    const signupId = id();
    const acceptedAt = new Date().toISOString();
    await db.sql`INSERT INTO early_access_signups(id,first_name,last_name,email,mobile,marketing_opt_in,accepted_privacy_at,ip_address)
                 VALUES(${signupId},${firstName},${lastName},${email},${mobile},${!!b.marketingOptIn},${acceptedAt},${getClientIp(req)})`;
    await audit(null, "early_access_signup", "early_access", signupId, { email, marketingOptIn: !!b.marketingOptIn }, req);
    return ok({ message: "Your spot is saved. We’ll let you know as soon as Whacky Auctions is ready to open." }, 201);
  }

  if (method === "POST" && parts[0] === "register") {
    const b = await req.json();
    const email = clean(b.email, 320).toLowerCase();
    const password = String(b.password || "");
    if (!email.includes("@") || password.length < 10)
      return fail(
        "Use a valid email and a password of at least 10 characters.",
      );
    if (
      !clean(b.firstName, 80) ||
      !clean(b.lastName, 80) ||
      !clean(b.mobile, 40) ||
      !clean(b.idNumber, 80) ||
      !clean(b.physicalAddress, 500)
    )
      return fail("Complete all bidder registration details.");
    if (!isAdult(clean(b.dateOfBirth, 20)))
      return fail("Bidders must be 18 or older.");
    if (!b.acceptTerms || !b.acceptPrivacy)
      return fail("You must accept the Terms and Privacy Notice.");
    const exists = await db.sql`SELECT 1 FROM users WHERE email=${email}`;
    if (exists.length)
      return fail("An account already exists for this email.", 409);
    const hp = await hashPassword(password);
    const uid = id();
    const now = new Date().toISOString();
    await db.sql`INSERT INTO users(id,email,password_hash,password_salt,first_name,last_name,mobile,id_number,date_of_birth,physical_address,marketing_opt_in,accepted_terms_at,accepted_privacy_at)
                 VALUES(${uid},${email},${hp.hash},${hp.salt},${clean(b.firstName, 80)},${clean(b.lastName, 80)},${clean(b.mobile, 40)},${clean(b.idNumber, 80)},${clean(b.dateOfBirth, 20)},${clean(b.physicalAddress, 500)},${!!b.marketingOptIn},${now},${now})`;
    await audit(uid, "register", "user", uid, { email }, req);
    const cookie = await createSession(uid);
    const u = (await db.sql`SELECT * FROM users WHERE id=${uid}`)[0];
    return ok(
      {
        me: safeUser(u),
        message:
          "Account created. Complete the once-off R10 Yoco bidder verification to activate bidding.",
      },
      201,
      { "set-cookie": cookie },
    );
  }

  if (method === "POST" && parts[0] === "login") {
    const b = await req.json();
    const email = clean(b.email, 320).toLowerCase();
    const rows = await db.sql`SELECT * FROM users WHERE email=${email} LIMIT 1`;
    const u = rows[0];
    if (
      !u ||
      !(await verifyPassword(
        String(b.password || ""),
        u.password_salt,
        u.password_hash,
      ))
    )
      return fail("Incorrect email or password.", 401);
    if (u.suspended) return fail("This account is suspended.", 403);
    await db.sql`UPDATE users SET last_login_at=NOW() WHERE id=${u.id}`;
    const cookie = await createSession(u.id);
    await audit(u.id, "login", "user", u.id, {}, req);
    return ok({ me: safeUser(u) }, 200, { "set-cookie": cookie });
  }
  if (method === "POST" && parts[0] === "logout") {
    await deleteSession(req);
    return ok({}, 200, { "set-cookie": clearSessionCookie });
  }
  if (method === "GET" && parts[0] === "me" && parts.length === 1)
    return ok({ me: safeUser(await requireUser(req)) });
  if (method === "POST" && parts[0] === "me" && parts[1] === "password") {
    const u = await requireUser(req);
    const b = await req.json();
    const rows = await db.sql`SELECT * FROM users WHERE id=${u.id}`;
    const full = rows[0];
    if (
      !(await verifyPassword(
        String(b.currentPassword || ""),
        full.password_salt,
        full.password_hash,
      ))
    )
      return fail("Current password is incorrect.", 403);
    if (String(b.newPassword || "").length < 10)
      return fail("New password must be at least 10 characters.");
    const hp = await hashPassword(String(b.newPassword));
    await db.sql`UPDATE users SET password_hash=${hp.hash},password_salt=${hp.salt} WHERE id=${u.id}`;
    await db.sql`DELETE FROM sessions WHERE user_id=${u.id}`;
    const cookie = await createSession(u.id);
    await audit(u.id, "change_password", "user", u.id, {}, req);
    return ok({ message: "Password changed." }, 200, { "set-cookie": cookie });
  }

  if (method === "GET" && parts[0] === "me" && parts[1] === "verification") {
    const u = await requireUser(req);
    const latest = (await db.sql`SELECT status,amount_cents,paid_at,created_at FROM bidder_verification_payments WHERE user_id=${u.id} ORDER BY created_at DESC LIMIT 1`)[0] || null;
    return ok({ verified: !!u.verified, amountCents: 1000, latest });
  }

  if (method === "POST" && parts[0] === "me" && parts[1] === "verification" && parts[2] === "checkout") {
    const u = await requireUser(req);
    if (u.verified) return ok({ verified: true, message: "Your bidder account is already verified." });
    const settings = await getSettings();
    if (!settings.payment_gateway_enabled) return fail("Yoco bidder verification is not available yet.",503);
    const outstanding = await db.sql`SELECT 1 FROM orders WHERE user_id=${u.id} AND status='defaulted' AND COALESCE(default_fee_cents,0)>0 LIMIT 1`;
    if (outstanding.length) return fail("Your bidder account has an outstanding default charge. Please contact Whacky Auctions before re-verification.",403);
    const verificationId=id();
    await db.sql`INSERT INTO bidder_verification_payments(id,user_id,amount_cents,status) VALUES(${verificationId},${u.id},1000,'pending')`;
    const base=new URL(req.url).origin;
    try {
      const checkout=await createCheckout({orderId:verificationId,auctionId:"bidder-verification",userId:u.id,email:u.email,amountCents:1000,description:"Whacky Auctions bidder verification",returnUrl:`${base}/profile?verification=return`,cancelUrl:`${base}/profile?verification=cancelled`,notifyUrl:`${base}/api/payments/webhook`,purpose:"bidder-verification",verificationId});
      await db.sql`UPDATE bidder_verification_payments SET payment_reference=${checkout.providerReference||null},updated_at=NOW() WHERE id=${verificationId}`;
      await audit(u.id,"bidder_verification_checkout_started","verification",verificationId,{amountCents:1000},req);
      return ok({redirectUrl:checkout.redirectUrl,amountCents:1000});
    } catch(e:any) {
      await db.sql`UPDATE bidder_verification_payments SET status='failed',updated_at=NOW() WHERE id=${verificationId}`;
      return fail(e?.message||"Bidder verification payment could not be started.",e?.status||503);
    }
  }

  if (method === "GET" && parts[0] === "auctions" && parts.length === 1)
    return ok({
      auctions: await publicAuctions(user?.id),
      serverTime: new Date().toISOString(),
    });
  if (method === "GET" && parts[0] === "auctions" && parts[1]) {
    await closeExpiredAuctions();
    const rows =
      await db.sql`SELECT * FROM auctions WHERE id=${parts[1]} OR slug=${parts[1]} LIMIT 1`;
    if (!rows.length) return fail("Auction not found.", 404);
    if (rows[0].status === "draft" && user?.role !== "admin")
      return fail("Auction not found.", 404);
    return ok({
      auction: await auctionDto(
        rows[0],
        user?.id,
        true,
        user?.role === "admin",
      ),
      serverTime: new Date().toISOString(),
    });
  }

  if (method === "GET" && parts[0] === "images" && parts[1]) {
    const key = parts.slice(1).join("/");
    const meta = await imageStore.getWithMetadata(key, { type: "arrayBuffer" });
    if (!meta) return new Response("Not found", { status: 404 });
    return new Response(meta.data, {
      headers: {
        "content-type": String(
          meta.metadata?.contentType || "application/octet-stream",
        ),
        "cache-control": "public,max-age=31536000,immutable",
      },
    });
  }

  if (method === "POST" && parts[0] === "watchlist" && parts[1]) {
    const u = await requireUser(req);
    const aid = parts[1];
    const has =
      (
        await db.sql`SELECT 1 FROM watchlist WHERE user_id=${u.id} AND auction_id=${aid}`
      ).length > 0;
    if (has)
      await db.sql`DELETE FROM watchlist WHERE user_id=${u.id} AND auction_id=${aid}`;
    else
      await db.sql`INSERT INTO watchlist(user_id,auction_id) VALUES(${u.id},${aid})`;
    return ok({ watched: !has });
  }
  if (method === "GET" && parts[0] === "me" && parts[1] === "watchlist") {
    const u = await requireUser(req);
    await closeExpiredAuctions();
    const rows =
      await db.sql`SELECT a.* FROM watchlist w JOIN auctions a ON a.id=w.auction_id WHERE w.user_id=${u.id} ORDER BY a.current_end_at`;
    const out = [];
    for (const a of rows) out.push(await auctionDto(a, u.id, false));
    return ok({ auctions: out });
  }
  if (method === "GET" && parts[0] === "me" && parts[1] === "bids") {
    const u = await requireUser(req);
    await closeExpiredAuctions();
    const rows =
      await db.sql`SELECT DISTINCT a.* FROM bids b JOIN auctions a ON a.id=b.auction_id WHERE b.user_id=${u.id} ORDER BY a.current_end_at DESC`;
    const out = [];
    for (const a of rows) out.push(await auctionDto(a, u.id, false));
    return ok({ auctions: out });
  }
  if (method === "GET" && parts[0] === "me" && parts[1] === "wins") {
    const u = await requireUser(req);
    await closeExpiredAuctions();
    const rows =
      await db.sql`SELECT a.* FROM auctions a WHERE a.status='closed' AND (SELECT b.user_id FROM bids b WHERE b.auction_id=a.id AND b.retracted_at IS NULL ORDER BY b.amount_cents DESC,b.created_at ASC LIMIT 1)=${u.id} ORDER BY a.current_end_at DESC`;
    const out = [];
    for (const a of rows) out.push(await auctionDto(a, u.id, false));
    return ok({ auctions: out });
  }
  if (method === "GET" && parts[0] === "me" && parts[1] === "notifications") {
    const u = await requireUser(req);
    const rows =
      await db.sql`SELECT * FROM notifications WHERE user_id=${u.id} ORDER BY created_at DESC LIMIT 100`;
    return ok({ notifications: rows });
  }
  if (
    method === "POST" &&
    parts[0] === "me" &&
    parts[1] === "notifications" &&
    parts[2] === "read"
  ) {
    const u = await requireUser(req);
    await db.sql`UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=${u.id}`;
    return ok();
  }

  if (method === "POST" && parts[0] === "auctions" && parts[2] === "bid") {
    const u = await requireUser(req);
    if (!u.verified)
      return fail("Your bidder account is awaiting verification.", 403);
    const settings = await getSettings();
    if (!settings.trading_enabled)
      return fail(
        "Bidding is not open yet. Whacky Auctions is in pre-launch mode.",
        403,
      );
    const b = await req.json();
    const amount = asCents(b.amountCents);
    const aid = parts[1];
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      const ar = await client.query(
        "SELECT * FROM auctions WHERE id=$1 FOR UPDATE",
        [aid],
      );
      if (!ar.rows.length) {
        await client.query("ROLLBACK");
        return fail("Auction not found.", 404);
      }
      const a = ar.rows[0];
      const now = Date.now();
      const start = new Date(a.start_at).getTime();
      const end = new Date(a.current_end_at).getTime();
      if (
        !["scheduled", "live"].includes(a.status) ||
        now < start ||
        now >= end
      ) {
        await client.query("ROLLBACK");
        return fail("This auction is not open for bidding.", 409);
      }
      const hr = await client.query(
        "SELECT * FROM bids WHERE auction_id=$1 AND retracted_at IS NULL ORDER BY amount_cents DESC,created_at ASC LIMIT 1",
        [aid],
      );
      const prev = hr.rows[0];
      const minimum = prev
        ? Number(prev.amount_cents) + Number(a.bid_increment_cents)
        : Number(a.opening_bid_cents);
      if (amount < minimum) {
        await client.query("ROLLBACK");
        return fail(
          `Minimum next bid is R${(minimum / 100).toFixed(2)}.`,
          409,
          { minimumCents: minimum },
        );
      }
      const bidId = id();
      await client.query(
        "INSERT INTO bids(id,auction_id,user_id,amount_cents,ip_address,user_agent) VALUES($1,$2,$3,$4,$5,$6)",
        [
          bidId,
          aid,
          u.id,
          amount,
          getClientIp(req),
          req.headers.get("user-agent"),
        ],
      );
      let newEnd = a.current_end_at;
      const remaining = end - now;
      if (remaining <= Number(a.soft_close_seconds) * 1000) {
        newEnd = new Date(
          now + Number(a.soft_close_seconds) * 1000,
        ).toISOString();
        await client.query(
          "UPDATE auctions SET current_end_at=$2,status='live',updated_at=NOW() WHERE id=$1",
          [aid, newEnd],
        );
      } else if (a.status === "scheduled") {
        await client.query(
          "UPDATE auctions SET status='live',updated_at=NOW() WHERE id=$1",
          [aid],
        );
      }
      if (prev && prev.user_id !== u.id)
        await client.query(
          "INSERT INTO notifications(id,user_id,type,message,auction_id) VALUES($1,$2,'outbid',$3,$4)",
          [id(), prev.user_id, `You have been outbid on ${a.title}.`, aid],
        );
      await client.query("COMMIT");
      await audit(
        u.id,
        "place_bid",
        "auction",
        aid,
        { amountCents: amount, bidId },
        req,
      );
      return ok({
        bidId,
        currentBidCents: amount,
        currentEndAt: newEnd,
        softCloseExtended: new Date(newEnd).getTime() > end,
      });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw e;
    } finally {
      client.release();
    }
  }

  if (method === "POST" && parts[0] === "bids" && parts[2] === "retract") {
    const u = await requireUser(req);
    const bidId = parts[1];
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      const br = await client.query(
        "SELECT b.*,a.status,a.current_end_at FROM bids b JOIN auctions a ON a.id=b.auction_id WHERE b.id=$1 FOR UPDATE",
        [bidId],
      );
      if (!br.rows.length) {
        await client.query("ROLLBACK");
        return fail("Bid not found.", 404);
      }
      const b = br.rows[0];
      if (b.user_id !== u.id) {
        await client.query("ROLLBACK");
        return fail("You may only retract your own bid.", 403);
      }
      if (b.retracted_at) {
        await client.query("ROLLBACK");
        return fail("Bid already retracted.", 409);
      }
      if (
        !["scheduled", "live"].includes(b.status) ||
        new Date(b.current_end_at).getTime() <= Date.now()
      ) {
        await client.query("ROLLBACK");
        return fail(
          "This sale has already completed; the bid can no longer be retracted.",
          409,
        );
      }
      const body = await req.json().catch(() => ({}));
      await client.query(
        "UPDATE bids SET retracted_at=NOW(),retraction_reason=$2 WHERE id=$1",
        [
          bidId,
          clean(body.reason || "Bidder retraction before completion", 300),
        ],
      );
      await client.query("COMMIT");
      await audit(
        u.id,
        "retract_bid",
        "bid",
        bidId,
        { auctionId: b.auction_id },
        req,
      );
      return ok({ message: "Bid retracted before completion." });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw e;
    } finally {
      client.release();
    }
  }

  if (method === "POST" && parts[0] === "checkout" && parts[1]) {
    const u = await requireUser(req);
    const order = (
      await db.sql`SELECT * FROM orders WHERE auction_id=${parts[1]} AND user_id=${u.id} LIMIT 1`
    )[0];
    if (!order)
      return fail("No payable winning order was found for this auction.", 404);
    if (order.status === "paid")
      return ok({ status: "paid", message: "This order is already paid." });
    const settings = await getSettings();
    if (!settings.payment_gateway_enabled)
      return fail("Payment gateway is not connected yet.", 503, {
        code: "PAYMENT_GATEWAY_PENDING",
        totalCents: Number(order.total_cents),
      });
    const base = new URL(req.url).origin;
    try {
      const checkout = await createCheckout({
        orderId: order.id,
        auctionId: order.auction_id,
        userId: u.id,
        email: u.email,
        amountCents: Number(order.total_cents),
        description: `Whacky Auctions - ${order.auction_id}`,
        returnUrl: `${base}/wins?payment=return`,
        cancelUrl: `${base}/wins?payment=cancelled`,
        notifyUrl: `${base}/api/payments/webhook`,
      });
      await db.sql`UPDATE orders SET status='pending',payment_reference=${checkout.providerReference || null},updated_at=NOW() WHERE id=${order.id}`;
      await audit(
        u.id,
        "checkout_started",
        "order",
        order.id,
        { auctionId: order.auction_id, totalCents: Number(order.total_cents) },
        req,
      );
      return ok({
        redirectUrl: checkout.redirectUrl,
        totalCents: Number(order.total_cents),
      });
    } catch (e: any) {
      return fail(
        e?.message || "Payment could not be started.",
        e?.status || 503,
        {
          code: e?.code || "PAYMENT_ERROR",
          totalCents: Number(order.total_cents),
        },
      );
    }
  }

  if (method === "POST" && parts[0] === "payments" && parts[1] === "webhook") {
    const rawBody = await req.text();
    await verifyYocoWebhook(rawBody, req);
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return fail("Invalid webhook JSON.", 400, {
        code: "YOCO_WEBHOOK_INVALID_JSON",
      });
    }
    if (event?.type === "payment.succeeded") {
      const checkoutId = event?.payload?.metadata?.checkoutId;
      const amountCents = Number(event?.payload?.amount);
      if (!checkoutId || !Number.isFinite(amountCents))
        return fail("Yoco payment event is missing checkout metadata.", 400, {
          code: "YOCO_WEBHOOK_MISSING_METADATA",
        });
      const order = (
        await db.sql`SELECT * FROM orders WHERE payment_reference=${String(checkoutId)} LIMIT 1`
      )[0];
      if (order) {
        if (Number(order.total_cents) !== amountCents)
          return fail("Yoco payment amount does not match the order.", 400, {
            code: "YOCO_WEBHOOK_AMOUNT_MISMATCH",
          });
        if (order.status !== "paid") {
          await db.sql`UPDATE orders SET status='paid',paid_at=COALESCE(paid_at,NOW()),updated_at=NOW() WHERE id=${order.id}`;
          await audit(
            order.user_id,
            "payment_succeeded",
            "order",
            order.id,
            { provider: "yoco", eventId: event.id, checkoutId },
            req,
          );
        }
      } else {
        const verification = (
          await db.sql`SELECT * FROM bidder_verification_payments WHERE payment_reference=${String(checkoutId)} LIMIT 1`
        )[0];
        if (verification) {
          if (Number(verification.amount_cents) !== amountCents || amountCents !== 1000)
            return fail("Yoco payment amount does not match the R10 bidder-verification fee.",400,{code:"YOCO_VERIFICATION_AMOUNT_MISMATCH"});
          if (verification.status !== "paid") {
            await db.sql`UPDATE bidder_verification_payments SET status='paid',paid_at=COALESCE(paid_at,NOW()),updated_at=NOW() WHERE id=${verification.id}`;
            await db.sql`UPDATE users SET verified=TRUE WHERE id=${verification.user_id} AND suspended=FALSE`;
            await db.sql`INSERT INTO notifications(id,user_id,type,message) VALUES(${id()},${verification.user_id},'bidder_verified','Your R10 bidder verification is complete. You may bid when auctions open.')`;
            await audit(verification.user_id,"bidder_verification_paid","verification",verification.id,{provider:"yoco",eventId:event.id,checkoutId,amountCents},req);
          }
        }
      }
    }
    return ok({ received: true });
  }

  if (
    method === "POST" &&
    parts[0] === "admin" &&
    parts[1] === "yoco" &&
    parts[2] === "register-webhook"
  ) {
    const admin = await requireAdmin(req);
    const secretKey = (Netlify.env.get("YOCO_SECRET_KEY") || "").trim();
    if (!secretKey)
      return fail("Yoco secret key is not configured.", 503, {
        code: "YOCO_NOT_CONFIGURED",
      });
    const base = new URL(req.url).origin;
    const response = await fetch("https://payments.yoco.com/api/webhooks", {
      method: "POST",
      headers: {
        authorization: `Bearer ${secretKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Whacky Auctions checkout payments",
        url: `${base}/api/payments/webhook`,
      }),
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok || !data.secret)
      return fail(
        data?.message || data?.error || "Yoco webhook registration failed.",
        response.status >= 400 ? response.status : 502,
        { code: "YOCO_WEBHOOK_REGISTRATION_FAILED" },
      );
    await setSetting("yoco_webhook_secret", String(data.secret));
    await audit(
      admin.id,
      "yoco_webhook_registered",
      "settings",
      "yoco_webhook",
      { subscriptionId: data.id || null, mode: data.mode || null },
      req,
    );
    return ok({
      registered: true,
      mode: data.mode || null,
      subscriptionId: data.id || null,
    });
  }

  if (
    method === "POST" &&
    parts[0] === "admin" &&
    parts[1] === "auctions" &&
    parts[2] &&
    parts[3] === "test-checkout"
  ) {
    const admin = await requireAdmin(req);
    const auction = (
      await db.sql`SELECT * FROM auctions WHERE id=${parts[2]} LIMIT 1`
    )[0];
    if (!auction) return fail("Auction not found.", 404);
    if (auction.status !== "draft")
      return fail(
        "Yoco test checkout is only available for draft auctions.",
        409,
      );
    const amountCents = Math.max(100, Number(auction.opening_bid_cents || 0));
    const base = new URL(req.url).origin;
    const existingTest = (
      await db.sql`SELECT id FROM orders WHERE auction_id=${auction.id} LIMIT 1`
    )[0];
    const testOrderId = existingTest?.id || id();
    if (existingTest)
      await db.sql`UPDATE orders SET user_id=${admin.id},hammer_price_cents=${amountCents},buyer_premium_cents=0,total_cents=${amountCents},status='pending',payment_gateway='yoco',payment_reference=NULL,paid_at=NULL,updated_at=NOW() WHERE id=${testOrderId}`;
    else
      await db.sql`INSERT INTO orders(id,auction_id,user_id,hammer_price_cents,buyer_premium_cents,total_cents,status,payment_gateway) VALUES(${testOrderId},${auction.id},${admin.id},${amountCents},0,${amountCents},'pending','yoco')`;
    const checkout = await createCheckout({
      orderId: testOrderId,
      auctionId: auction.id,
      userId: admin.id,
      email: admin.email,
      amountCents,
      description: `TEST - Whacky Auctions - ${auction.title}`,
      returnUrl: `${base}/admin?yoco=test-success`,
      cancelUrl: `${base}/admin?yoco=test-cancelled`,
      notifyUrl: `${base}/api/payments/webhook`,
    });
    await db.sql`UPDATE orders SET payment_reference=${checkout.providerReference || null},updated_at=NOW() WHERE id=${testOrderId}`;
    await audit(
      admin.id,
      "yoco_test_checkout",
      "auction",
      auction.id,
      {
        amountCents,
        providerReference: checkout.providerReference || null,
        testOrderId,
      },
      req,
    );
    return ok({
      redirectUrl: checkout.redirectUrl,
      amountCents,
      testMode: true,
    });
  }

  // ADMIN
  if (parts[0] === "admin") {
    const admin = await requireAdmin(req);
    if (method === "GET" && parts[1] === "dashboard") {
      await closeExpiredAuctions();
      const [
        users,
        registeredBidders,
        verifiedBidders,
        signupsToday,
        auctions,
        bids,
        pending,
        earlyAccess,
        viewsToday,
        viewsThirtyDays,
      ] = await Promise.all([
        db.sql`SELECT COUNT(*)::int c FROM users`,
        db.sql`SELECT COUNT(*)::int c FROM users WHERE role='bidder'`,
        db.sql`SELECT COUNT(*)::int c FROM users WHERE role='bidder' AND verified=TRUE AND suspended=FALSE`,
        db.sql`SELECT COUNT(*)::int c FROM users WHERE role='bidder' AND created_at >= (date_trunc('day', NOW() AT TIME ZONE 'Africa/Johannesburg') AT TIME ZONE 'Africa/Johannesburg')`,
        db.sql`SELECT COUNT(*)::int c FROM auctions`,
        db.sql`SELECT COUNT(*)::int c FROM bids WHERE retracted_at IS NULL`,
        db.sql`SELECT COUNT(*)::int c FROM users WHERE role='bidder' AND verified=FALSE AND suspended=FALSE`,
        db.sql`SELECT COUNT(*)::int c FROM early_access_signups`,
        db.sql`SELECT COALESCE(SUM(view_count),0)::int c FROM page_views WHERE view_date=(NOW() AT TIME ZONE 'Africa/Johannesburg')::date`,
        db.sql`SELECT COALESCE(SUM(view_count),0)::int c FROM page_views WHERE view_date >= ((NOW() AT TIME ZONE 'Africa/Johannesburg')::date - 29)`,
      ]);
      return ok({
        stats: {
          users: users[0].c,
          registeredBidders: registeredBidders[0].c,
          verifiedBidders: verifiedBidders[0].c,
          signupsToday: signupsToday[0].c,
          auctions: auctions[0].c,
          bids: bids[0].c,
          pendingVerification: pending[0].c,
          earlyAccess: earlyAccess[0].c,
          viewsToday: viewsToday[0].c,
          viewsThirtyDays: viewsThirtyDays[0].c,
        },
        settings: await getSettings(),
      });
    }
    if (method === "GET" && parts[1] === "users") {
      const rows =
        await db.sql`SELECT id,email,first_name,last_name,mobile,id_number,date_of_birth,physical_address,role,verified,suspended,created_at,last_login_at FROM users ORDER BY created_at DESC`;
      return ok({ users: rows });
    }
    if (
      method === "POST" &&
      parts[1] === "users" &&
      parts[2] &&
      parts[3] === "verify"
    ) {
      const body = await req.json();
      await db.sql`UPDATE users SET verified=${!!body.verified} WHERE id=${parts[2]} AND role='bidder'`;
      await audit(
        admin.id,
        "verify_user",
        "user",
        parts[2],
        { verified: !!body.verified },
        req,
      );
      return ok();
    }
    if (
      method === "POST" &&
      parts[1] === "users" &&
      parts[2] &&
      parts[3] === "suspend"
    ) {
      const body = await req.json();
      await db.sql`UPDATE users SET suspended=${!!body.suspended} WHERE id=${parts[2]} AND role='bidder'`;
      await audit(
        admin.id,
        "suspend_user",
        "user",
        parts[2],
        { suspended: !!body.suspended },
        req,
      );
      return ok();
    }
    if (method === "GET" && parts[1] === "auctions") {
      await closeExpiredAuctions();
      const rows =
        await db.sql`SELECT * FROM auctions ORDER BY created_at DESC`;
      const out = [];
      for (const a of rows)
        out.push(await auctionDto(a, admin.id, false, true));
      return ok({ auctions: out });
    }
    if (method === "POST" && parts[1] === "auctions" && parts.length === 2) {
      const b = await req.json();
      const aid = id();
      const base = slugify(clean(b.title, 150));
      let slug = `${base}-${aid.slice(0, 8)}`;
      const start = new Date(b.startAt);
      const end = new Date(b.endAt);
      if (!(start < end))
        return fail("Auction end time must be after the start time.");
      const soft = Math.max(
        30,
        Math.min(900, Number(b.softCloseSeconds || 120)),
      );
      const opening = asCents(b.openingBidCents);
      const inc = asCents(b.bidIncrementCents);
      if (inc < 1) return fail("Bid increment must be greater than zero.");
      const reserve =
        b.reservePriceCents == null || b.reservePriceCents === ""
          ? null
          : asCents(b.reservePriceCents);
      await db.sql`INSERT INTO auctions(id,slug,title,category,description,condition_text,start_at,scheduled_end_at,current_end_at,soft_close_seconds,opening_bid_cents,bid_increment_cents,reserve_price_cents,reserve_disclosed,buyer_premium_percent,vat_note,payment_deadline_hours,inspection_note,collection_note,storage_fee_note,auctioneer_name,created_by)
                   VALUES(${aid},${slug},${clean(b.title, 150)},${clean(b.category, 80) || "General"},${clean(b.description, 12000)},${clean(b.conditionText, 5000)},${start.toISOString()},${end.toISOString()},${end.toISOString()},${soft},${opening},${inc},${reserve},${b.reserveDisclosed !== false},${Number(b.buyerPremiumPercent ?? 5)},${clean(b.vatNote, 500) || "VAT treatment as displayed for this lot."},${Math.max(1, Number(b.paymentDeadlineHours || 2))},${clean(b.inspectionNote, 1000)},${clean(b.collectionNote, 1000)},${clean(b.storageFeeNote, 1000)},${clean(b.auctioneerName, 160) || null},${admin.id})`;
      await audit(
        admin.id,
        "create_auction",
        "auction",
        aid,
        { title: b.title },
        req,
      );
      return ok({ auctionId: aid, slug }, 201);
    }
    if (method === "PUT" && parts[1] === "auctions" && parts[2]) {
      const b = await req.json();
      const aid = parts[2];
      const ex = (await db.sql`SELECT * FROM auctions WHERE id=${aid}`)[0];
      if (!ex) return fail("Auction not found.", 404);
      if (ex.status !== "draft")
        return fail(
          "Published or completed auctions cannot be edited through the draft editor. Create an amended auction/rules record instead.",
        );
      const start = new Date(b.startAt);
      const end = new Date(b.endAt);
      if (!(start < end))
        return fail("Auction end time must be after start time.");
      const reserve =
        b.reservePriceCents == null || b.reservePriceCents === ""
          ? null
          : asCents(b.reservePriceCents);
      await db.sql`UPDATE auctions SET title=${clean(b.title, 150)},category=${clean(b.category, 80) || "General"},description=${clean(b.description, 12000)},condition_text=${clean(b.conditionText, 5000)},start_at=${start.toISOString()},scheduled_end_at=${end.toISOString()},current_end_at=CASE WHEN status='draft' THEN ${end.toISOString()} ELSE current_end_at END,soft_close_seconds=${Math.max(30, Math.min(900, Number(b.softCloseSeconds || 120)))},opening_bid_cents=${asCents(b.openingBidCents)},bid_increment_cents=${asCents(b.bidIncrementCents)},reserve_price_cents=${reserve},reserve_disclosed=${b.reserveDisclosed !== false},buyer_premium_percent=${Number(b.buyerPremiumPercent ?? 5)},vat_note=${clean(b.vatNote, 500)},payment_deadline_hours=${Math.max(1, Number(b.paymentDeadlineHours || 2))},inspection_note=${clean(b.inspectionNote, 1000)},collection_note=${clean(b.collectionNote, 1000)},storage_fee_note=${clean(b.storageFeeNote, 1000)},auctioneer_name=${clean(b.auctioneerName, 160) || null},updated_at=NOW() WHERE id=${aid}`;
      await audit(admin.id, "update_auction", "auction", aid, {}, req);
      return ok();
    }
    if (
      method === "POST" &&
      parts[1] === "auctions" &&
      parts[2] &&
      parts[3] === "duplicate"
    ) {
      const sourceId = parts[2];
      const source = (
        await db.sql`SELECT * FROM auctions WHERE id=${sourceId} LIMIT 1`
      )[0];
      if (!source) return fail("Auction not found.", 404);
      if (source.status !== "draft")
        return fail("Only draft auctions can be duplicated.");
      const aid = id();
      const title = clean(`${source.title} (copy)`, 150);
      const slug = `${slugify(title)}-${aid.slice(0, 8)}`;
      await db.sql`INSERT INTO auctions(id,slug,title,category,description,condition_text,status,start_at,scheduled_end_at,current_end_at,soft_close_seconds,opening_bid_cents,bid_increment_cents,reserve_price_cents,reserve_disclosed,buyer_premium_percent,vat_note,payment_deadline_hours,inspection_note,collection_note,storage_fee_note,auctioneer_name,rules_published_at,created_by)
                   VALUES(${aid},${slug},${title},${source.category},${source.description},${source.condition_text},'draft',${source.start_at},${source.scheduled_end_at},${source.scheduled_end_at},${source.soft_close_seconds},${source.opening_bid_cents},${source.bid_increment_cents},${source.reserve_price_cents},${source.reserve_disclosed},${source.buyer_premium_percent},${source.vat_note},${source.payment_deadline_hours},${source.inspection_note},${source.collection_note},${source.storage_fee_note},${source.auctioneer_name},NULL,${admin.id})`;
      const sourceImages =
        await db.sql`SELECT * FROM auction_images WHERE auction_id=${sourceId} ORDER BY sort_order,id`;
      const copiedKeys: string[] = [];
      try {
        for (const image of sourceImages) {
          const data = await imageStore.get(image.blob_key, {
            type: "arrayBuffer",
          });
          if (!data) continue;
          const imageId = id();
          const ext = (String(image.blob_key).split(".").pop() || "img")
            .replace(/[^a-z0-9]/gi, "")
            .toLowerCase();
          const key = `${aid}/${imageId}.${ext}`;
          await imageStore.set(key, data, {
            metadata: { contentType: image.content_type },
          });
          copiedKeys.push(key);
          await db.sql`INSERT INTO auction_images(id,auction_id,blob_key,content_type,alt_text,sort_order) VALUES(${imageId},${aid},${key},${image.content_type},${image.alt_text},${image.sort_order})`;
        }
      } catch (error) {
        for (const key of copiedKeys)
          await imageStore.delete(key).catch(() => {});
        await db.sql`DELETE FROM auctions WHERE id=${aid}`;
        throw error;
      }
      await audit(
        admin.id,
        "duplicate_auction",
        "auction",
        aid,
        { sourceAuctionId: sourceId, copiedImages: copiedKeys.length },
        req,
      );
      const created = (await db.sql`SELECT * FROM auctions WHERE id=${aid}`)[0];
      return ok(
        {
          auctionId: aid,
          auction: await auctionDto(created, admin.id, false, true),
        },
        201,
      );
    }
    if (
      method === "POST" &&
      parts[1] === "auctions" &&
      parts[2] &&
      parts[3] === "images" &&
      parts[4] === "reorder"
    ) {
      const aid = parts[2];
      const auction = (
        await db.sql`SELECT id FROM auctions WHERE id=${aid} LIMIT 1`
      )[0];
      if (!auction) return fail("Auction not found.", 404);
      const body = await req.json();
      const imageIds = Array.isArray(body.imageIds)
        ? body.imageIds.map((x: any) => String(x))
        : [];
      if (new Set(imageIds).size !== imageIds.length)
        return fail("Photo order contains duplicate image IDs.");
      const existing =
        await db.sql`SELECT id FROM auction_images WHERE auction_id=${aid} ORDER BY sort_order,id`;
      const existingIds = existing.map((x: any) => String(x.id));
      if (
        imageIds.length !== existingIds.length ||
        imageIds.some((x: string) => !existingIds.includes(x))
      )
        return fail(
          "Photo order must include every current auction image exactly once.",
        );
      const client = await db.pool.connect();
      try {
        await client.query("BEGIN");
        for (let i = 0; i < imageIds.length; i++)
          await client.query(
            "UPDATE auction_images SET sort_order=$1 WHERE id=$2 AND auction_id=$3",
            [i, imageIds[i], aid],
          );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      await audit(
        admin.id,
        "reorder_images",
        "auction",
        aid,
        { imageIds },
        req,
      );
      return ok();
    }
    if (
      method === "POST" &&
      parts[1] === "auctions" &&
      parts[2] &&
      parts[3] === "publish"
    ) {
      const settings = await getSettings();
      if (!settings.dealer_registration_confirmed)
        return fail(
          "Second-hand-goods dealer registration must be recorded before publishing live auctions.",
          403,
        );
      if (!settings.trading_enabled)
        return fail(
          "Launch lock is active. Enable trading only after the required second-hand-goods registration and payment setup are complete.",
          403,
        );
      if (!settings.payment_gateway_enabled)
        return fail(
          "Connect the payment gateway before publishing live auctions.",
          403,
        );
      const aid = parts[2];
      const rows = await db.sql`SELECT * FROM auctions WHERE id=${aid}`;
      if (!rows.length) return fail("Auction not found.", 404);
      const a = rows[0];
      if (!a.auctioneer_name)
        return fail("Add the appointed auctioneer before publishing.");
      if (new Date(a.start_at).getTime() < Date.now() + 24 * 3600 * 1000)
        return fail(
          "Rules must be available at least 24 hours before the auction start; move the start time later.",
        );
      const img = (
        await db.sql`SELECT 1 FROM auction_images WHERE auction_id=${aid} LIMIT 1`
      ).length;
      if (!img) return fail("Add at least one item photo before publishing.");
      await db.sql`UPDATE auctions SET status='scheduled',rules_published_at=NOW(),updated_at=NOW() WHERE id=${aid}`;
      await audit(admin.id, "publish_auction", "auction", aid, {}, req);
      return ok();
    }
    if (
      method === "POST" &&
      parts[1] === "auctions" &&
      parts[2] &&
      parts[3] === "image"
    ) {
      const aid = parts[2];
      const exists = (await db.sql`SELECT 1 FROM auctions WHERE id=${aid}`)
        .length;
      if (!exists) return fail("Auction not found.", 404);
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return fail("Choose an image.");
      const allowedImages = new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ]);
      if (!allowedImages.has(file.type))
        return fail("Use JPEG, PNG, WebP or GIF images only.");
      if (file.size > 8 * 1024 * 1024)
        return fail("Image must be 8 MB or smaller.");
      const imageId = id();
      const ext = (file.name.split(".").pop() || "img")
        .replace(/[^a-z0-9]/gi, "")
        .toLowerCase();
      const key = `${aid}/${imageId}.${ext}`;
      await imageStore.set(key, await file.arrayBuffer(), {
        metadata: { contentType: file.type },
      });
      const count = (
        await db.sql`SELECT COUNT(*)::int c FROM auction_images WHERE auction_id=${aid}`
      )[0].c;
      await db.sql`INSERT INTO auction_images(id,auction_id,blob_key,content_type,alt_text,sort_order) VALUES(${imageId},${aid},${key},${file.type},${clean(form.get("alt") || "", 200)},${count})`;
      await audit(admin.id, "add_image", "auction", aid, { imageId }, req);
      return ok(
        {
          image: { id: imageId, url: `/api/images/${encodeURIComponent(key)}` },
        },
        201,
      );
    }
    if (method === "DELETE" && parts[1] === "images" && parts[2]) {
      const rows =
        await db.sql`SELECT * FROM auction_images WHERE id=${parts[2]}`;
      if (!rows.length) return fail("Image not found.", 404);
      await imageStore.delete(rows[0].blob_key);
      await db.sql`DELETE FROM auction_images WHERE id=${parts[2]}`;
      await audit(
        admin.id,
        "delete_image",
        "auction",
        rows[0].auction_id,
        { imageId: parts[2] },
        req,
      );
      return ok();
    }
    if (
      method === "POST" &&
      parts[1] === "settings" &&
      parts[2] === "dealer-registration"
    ) {
      const body = await req.json();
      const registrationNumber = clean(body.registrationNumber, 120);
      const expiryDate = clean(body.expiryDate, 30);
      const confirmed = !!body.confirmed;
      if (confirmed && !registrationNumber)
        return fail(
          "Enter the SAPS second-hand-goods registration number before confirming.",
        );
      await setSetting("dealer_registration_confirmed", confirmed);
      await setSetting("dealer_registration_number", registrationNumber);
      await setSetting("dealer_registration_expiry", expiryDate);
      if (!confirmed) await setSetting("trading_enabled", false);
      await audit(
        admin.id,
        "set_dealer_registration",
        "settings",
        "dealer_registration",
        { confirmed, registrationNumber, expiryDate },
        req,
      );
      return ok({ dealerRegistrationConfirmed: confirmed });
    }
    if (
      method === "POST" &&
      parts[1] === "settings" &&
      parts[2] === "trading"
    ) {
      const body = await req.json();
      const enabled = !!body.enabled;
      const settings = await getSettings();
      if (enabled && !settings.dealer_registration_confirmed)
        return fail(
          "Record the valid second-hand-goods dealer registration before enabling trading.",
          403,
        );
      if (enabled && !settings.payment_gateway_enabled)
        return fail(
          "Payment gateway must be connected before the launch switch can be enabled.",
          403,
        );
      await setSetting("trading_enabled", enabled);
      await audit(
        admin.id,
        "set_trading",
        "settings",
        "trading_enabled",
        { enabled },
        req,
      );
      return ok({ tradingEnabled: enabled });
    }
    if (
      method === "GET" &&
      parts[1] === "records" &&
      parts[2] === "bidders.csv"
    ) {
      const rows =
        await db.sql`SELECT id,first_name,last_name,email,mobile,id_number,date_of_birth,physical_address,verified,suspended,created_at FROM users WHERE role='bidder' ORDER BY created_at`;
      const esc = (x: any) => `"${String(x ?? "").replaceAll('"', '""')}"`;
      const lines = [
        "Bidder ID,First name,Last name,Email,Mobile,ID/Passport,Date of birth,Physical address,Verified,Suspended,Created at",
        ...rows.map((r: any) =>
          [
            r.id,
            r.first_name,
            r.last_name,
            r.email,
            r.mobile,
            r.id_number,
            r.date_of_birth,
            r.physical_address,
            r.verified,
            r.suspended,
            r.created_at,
          ]
            .map(esc)
            .join(","),
        ),
      ];
      return new Response(lines.join("\n"), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="whacky-bidders.csv"',
        },
      });
    }
    if (
      method === "GET" &&
      parts[1] === "records" &&
      parts[2] === "early-access.csv"
    ) {
      const rows =
        await db.sql`SELECT first_name,last_name,email,mobile,marketing_opt_in,accepted_privacy_at,created_at FROM early_access_signups ORDER BY created_at`;
      const csvEsc = (x: any) => `"${String(x ?? "").replaceAll('"', '""')}"`;
      const lines = [
        "First name,Last name,Email,Mobile,Marketing opt-in,Privacy accepted at,Joined at",
        ...rows.map((r: any) =>
          [r.first_name,r.last_name,r.email,r.mobile,r.marketing_opt_in,r.accepted_privacy_at,r.created_at]
            .map(csvEsc)
            .join(","),
        ),
      ];
      return new Response(lines.join("\n"), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="whacky-early-access.csv"',
        },
      });
    }
    if (
      method === "GET" &&
      parts[1] === "records" &&
      parts[2] === "vendor-roll.csv"
    ) {
      const rows =
        await db.sql`SELECT a.id,a.title,a.status,a.start_at,a.current_end_at,b.id bid_id,b.amount_cents,b.created_at,u.first_name,u.last_name,u.email FROM auctions a LEFT JOIN bids b ON b.auction_id=a.id LEFT JOIN users u ON u.id=b.user_id ORDER BY a.created_at,b.created_at`;
      const esc = (x: any) => `"${String(x ?? "").replaceAll('"', '""')}"`;
      const lines = [
        "Auction ID,Lot,Bid ID,Bidder,Email,Amount (R),Bid time,Auction status,Start,Close",
        ...rows.map((r: any) =>
          [
            r.id,
            r.title,
            r.bid_id,
            r.bid_id ? `${r.first_name} ${r.last_name}` : "",
            r.email,
            r.amount_cents == null
              ? ""
              : (Number(r.amount_cents) / 100).toFixed(2),
            r.created_at,
            r.status,
            r.start_at,
            r.current_end_at,
          ]
            .map(esc)
            .join(","),
        ),
      ];
      return new Response(lines.join("\n"), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition":
            'attachment; filename="whacky-vendor-roll.csv"',
        },
      });
    }
  }

  return fail("Endpoint not found.", 404);
}

export default async (req: Request) => {
  try {
    return await handle(req);
  } catch (e: any) {
    console.error(e);
    return fail(e?.message || "Unexpected server error.", e?.status || 500);
  }
};

export const config: Config = { path: "/api/*" };
