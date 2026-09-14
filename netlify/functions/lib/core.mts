import { getDatabase } from '@netlify/database';
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);
export const db = getDatabase();
export const imageStore = getStore('whacky-auction-images', { consistency: 'strong' });

export const json = (data: any, status = 200, headers: Record<string,string> = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
});

export const fail = (message: string, status = 400, extra: any = {}) => json({ ok: false, error: message, ...extra }, status);
export const ok = (data: any = {}, status = 200, headers: Record<string,string> = {}) => json({ ok: true, ...data }, status, headers);

export const id = () => crypto.randomUUID();
export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70) || 'auction';
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export async function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = await scryptAsync(password, salt, 64) as Buffer;
  return { salt, hash: derived.toString('hex') };
}
export async function verifyPassword(password: string, salt: string, expected: string) {
  const { hash } = await hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a,b);
}

export function getClientIp(req: Request) {
  return req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}

function parseCookies(req: Request) {
  const raw = req.headers.get('cookie') || '';
  const out: Record<string,string> = {};
  raw.split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0,i).trim()] = decodeURIComponent(part.slice(i+1).trim());
  });
  return out;
}

export async function getUser(req: Request) {
  const token = parseCookies(req).wa_session;
  if (!token) return null;
  const tokenHash = sha256(token);
  const result = await db.sql`
    SELECT u.id,u.email,u.first_name,u.last_name,u.mobile,u.id_number,u.date_of_birth,u.physical_address,
           u.role,u.verified,u.suspended,u.marketing_opt_in,u.created_at
      FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=${tokenHash} AND s.expires_at > NOW()
     LIMIT 1`;
  return result[0] || null;
}

export async function requireUser(req: Request) {
  const user = await getUser(req);
  if (!user) throw Object.assign(new Error('Please sign in.'), { status: 401 });
  if (user.suspended) throw Object.assign(new Error('This account is suspended.'), { status: 403 });
  return user;
}
export async function requireAdmin(req: Request) {
  const user = await requireUser(req);
  if (user.role !== 'admin') throw Object.assign(new Error('Administrator access required.'), { status: 403 });
  return user;
}

export async function createSession(userId: string) {
  const token = randomToken();
  const tokenHash = sha256(token);
  await db.sql`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(${tokenHash},${userId},NOW()+INTERVAL '14 days')`;
  const secure = '; Secure';
  const cookie = `wa_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${14*24*3600}${secure}`;
  return cookie;
}
export async function deleteSession(req: Request) {
  const token = parseCookies(req).wa_session;
  if (token) await db.sql`DELETE FROM sessions WHERE token_hash=${sha256(token)}`;
}
export const clearSessionCookie = 'wa_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure';

export async function getSettings() {
  const rows = await db.sql`SELECT key,value FROM app_settings`;
  const out: Record<string,any> = {};
  for (const r of rows) out[r.key] = r.value;
  const envPayment = Netlify.env.get('PAYMENT_GATEWAY_ENABLED');
  if (envPayment != null) out.payment_gateway_enabled = envPayment === 'true';
  return out;
}

export async function setSetting(key: string, value: any) {
  await db.sql`INSERT INTO app_settings(key,value,updated_at) VALUES(${key},${JSON.stringify(value)}::jsonb,NOW())
               ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`;
}

export async function audit(actorId: string | null, action: string, entityType: string, entityId: string | null, detail: any, req?: Request) {
  await db.sql`INSERT INTO audit_log(id,actor_user_id,action,entity_type,entity_id,detail,ip_address)
               VALUES(${id()},${actorId},${action},${entityType},${entityId},${JSON.stringify(detail ?? {})}::jsonb,${req ? getClientIp(req) : null})`;
}

export async function ensureBootstrapAdmin() {
  const adminEmail = (Netlify.env.get('ADMIN_EMAIL') || '').trim().toLowerCase();
  const adminPassword = Netlify.env.get('ADMIN_INITIAL_PASSWORD') || '';
  if (!adminEmail || !adminPassword) return;
  const existing = await db.sql`SELECT id FROM users WHERE role='admin' LIMIT 1`;
  if (existing.length) return;
  const { salt, hash } = await hashPassword(adminPassword);
  const now = new Date().toISOString();
  await db.sql`INSERT INTO users(id,email,password_hash,password_salt,first_name,last_name,mobile,id_number,date_of_birth,physical_address,role,verified,suspended,marketing_opt_in,accepted_terms_at,accepted_privacy_at)
               VALUES(${id()},${adminEmail},${hash},${salt},'Sandeep','Rugbee',NULL,NULL,NULL,'497 Ontdekkers Road, Florida Hills, Gauteng','admin',TRUE,FALSE,FALSE,${now},${now})
               ON CONFLICT(email) DO NOTHING`;
}

export async function closeExpiredAuctions() {
  await db.sql`UPDATE auctions SET status='live',updated_at=NOW() WHERE status='scheduled' AND start_at <= NOW() AND current_end_at > NOW()`;
  const expired = await db.sql`SELECT id FROM auctions WHERE status IN ('scheduled','live') AND current_end_at <= NOW()`;
  for (const row of expired) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const lock = await client.query("SELECT * FROM auctions WHERE id=$1 FOR UPDATE", [row.id]);
      if (!lock.rows.length || !['scheduled','live'].includes(lock.rows[0].status) || new Date(lock.rows[0].current_end_at).getTime() > Date.now()) {
        await client.query('ROLLBACK'); continue;
      }
      const bidRes = await client.query("SELECT b.*,u.first_name,u.last_name FROM bids b JOIN users u ON u.id=b.user_id WHERE b.auction_id=$1 AND b.retracted_at IS NULL ORDER BY b.amount_cents DESC,b.created_at ASC LIMIT 1", [row.id]);
      const high = bidRes.rows[0];
      const reserve = lock.rows[0].reserve_price_cents == null ? null : Number(lock.rows[0].reserve_price_cents);
      const sold = !!high && (reserve == null || Number(high.amount_cents) >= reserve);
      const newStatus = sold ? 'closed' : 'unsold';
      await client.query("UPDATE auctions SET status=$2,updated_at=NOW() WHERE id=$1", [row.id,newStatus]);
      if (sold) {
        const hammer = Number(high.amount_cents);
        const premium = Math.round(hammer * Number(lock.rows[0].buyer_premium_percent || 0) / 100);
        const total = hammer + premium;
        await client.query(
          "INSERT INTO orders(id,auction_id,user_id,hammer_price_cents,buyer_premium_cents,total_cents,status,due_at) VALUES($1,$2,$3,$4,$5,$6,'unpaid',NOW()+($7::text||' hours')::interval) ON CONFLICT(auction_id) DO NOTHING",
          [id(),row.id,high.user_id,hammer,premium,total,Number(lock.rows[0].payment_deadline_hours||2)]
        );
        await client.query("INSERT INTO notifications(id,user_id,type,message,auction_id) VALUES($1,$2,'won',$3,$4)", [id(),high.user_id,`You won ${lock.rows[0].title}. Pay the full R${(total/100).toFixed(2)} within ${Number(lock.rows[0].payment_deadline_hours||2)} hours to keep the sale.`,row.id]);
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }

  const overdue = await db.sql`SELECT id FROM orders WHERE status IN ('unpaid','pending') AND due_at IS NOT NULL AND due_at<=NOW()`;
  for (const row of overdue) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const orderRes = await client.query("SELECT o.id AS order_id,o.status AS order_status,o.user_id,o.auction_id,o.hammer_price_cents,o.due_at,a.* FROM orders o JOIN auctions a ON a.id=o.auction_id WHERE o.id=$1 FOR UPDATE OF o",[row.id]);
      const order = orderRes.rows[0];
      if (!order || !['unpaid','pending'].includes(order.order_status) || !order.due_at || new Date(order.due_at).getTime()>Date.now()) { await client.query('ROLLBACK'); continue; }
      const relistId=id();
      const start=new Date(Date.now()+24*60*60*1000);
      const originalDuration=Math.max(60*60*1000,new Date(order.scheduled_end_at).getTime()-new Date(order.start_at).getTime());
      const end=new Date(start.getTime()+originalDuration);
      const relistSlug=`${order.slug}-relisted-${Date.now().toString(36)}`.slice(0,90);
      await client.query(`INSERT INTO auctions(id,slug,title,category,description,condition_text,status,start_at,scheduled_end_at,current_end_at,soft_close_seconds,opening_bid_cents,bid_increment_cents,reserve_price_cents,reserve_disclosed,buyer_premium_percent,vat_note,payment_deadline_hours,inspection_note,collection_note,storage_fee_note,auctioneer_name,rules_published_at,created_by)
        VALUES($1,$2,$3,$4,$5,$6,'scheduled',$7,$8,$8,$9,$10,$11,$12,$13,$14,$15,2,$16,$17,$18,$19,NOW(),$20)`,[
        relistId,relistSlug,order.title,order.category,order.description,order.condition_text,start.toISOString(),end.toISOString(),order.soft_close_seconds,order.opening_bid_cents,order.bid_increment_cents,order.reserve_price_cents,order.reserve_disclosed,order.buyer_premium_percent,order.vat_note,order.inspection_note,order.collection_note,order.storage_fee_note,order.auctioneer_name,order.created_by
      ]);
      const images=await client.query("SELECT * FROM auction_images WHERE auction_id=$1 ORDER BY sort_order",[order.auction_id]);
      for(const image of images.rows) await client.query("INSERT INTO auction_images(id,auction_id,blob_key,content_type,alt_text,sort_order) VALUES($1,$2,$3,$4,$5,$6)",[id(),relistId,image.blob_key,image.content_type,image.alt_text,image.sort_order]);
      const defaultFee=Math.round(Number(order.hammer_price_cents)*0.10);
      await client.query("UPDATE orders SET status='defaulted',defaulted_at=NOW(),default_fee_cents=$2,relisted_auction_id=$3,updated_at=NOW() WHERE id=$1",[order.order_id,defaultFee,relistId]);
      await client.query("UPDATE users SET verified=FALSE WHERE id=$1",[order.user_id]);
      await client.query("INSERT INTO notifications(id,user_id,type,message,auction_id) VALUES($1,$2,'payment_default',$3,$4)",[id(),order.user_id,`Payment was not received within 2 hours. The sale was cancelled, the lot was relisted and a default charge of up to R${(defaultFee/100).toFixed(2)} applies, subject to the statutory cap.`,order.auction_id]);
      await client.query('COMMIT');
    } catch(e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
}

export function safeUser(user: any) {
  if (!user) return null;
  return { id:user.id,email:user.email,firstName:user.first_name,lastName:user.last_name,mobile:user.mobile,role:user.role,verified:user.verified,suspended:user.suspended,marketingOptIn:user.marketing_opt_in,createdAt:user.created_at };
}

export function asCents(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) throw Object.assign(new Error('Invalid amount.'),{status:400});
  return n;
}

export function isAdult(dob: string) {
  const d = new Date(dob+'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  let age = now.getUTCFullYear()-d.getUTCFullYear();
  const m = now.getUTCMonth()-d.getUTCMonth();
  if (m < 0 || (m===0 && now.getUTCDate()<d.getUTCDate())) age--;
  return age >= 18;
}
