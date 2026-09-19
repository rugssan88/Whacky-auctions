import nodemailer from "nodemailer";
import { db, id } from "./core.mts";

const SITE_URL = "https://www.whackyauctions.co.za";
const SUPPORT_EMAIL = "info@whackyauctions.co.za";

const esc = (value: unknown) => String(value ?? "").replace(/[&<>\"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;",
}[c] || c));

function layout(preheader: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6efe4;font-family:Arial,sans-serif;color:#251b16">
  <div style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6efe4;padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffaf2;border:1px solid #d9c5ae;border-radius:22px;overflow:hidden">
      <tr><td style="background:#203f39;padding:24px 30px;color:#fff9ef;font-size:22px;font-weight:800"><span style="display:inline-block;background:#bc3f2f;border-radius:10px;padding:7px 11px;margin-right:9px">W</span> Whacky Auctions</td></tr>
      <tr><td style="padding:34px 30px;line-height:1.65;font-size:16px">${body}</td></tr>
      <tr><td style="padding:20px 30px;background:#efe1d2;color:#6f5d50;font-size:12px;line-height:1.5">Whacky Auctions PTY LTD · Florida, Gauteng<br><a href="mailto:${SUPPORT_EMAIL}" style="color:#7e3228">${SUPPORT_EMAIL}</a></td></tr>
    </table>
  </td></tr></table></body></html>`;
}

const button = (label: string, href: string) => `<p style="margin:26px 0"><a href="${href}" style="display:inline-block;background:#bc3f2f;color:#fff;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:12px">${esc(label)}</a></p>`;

export function signupEmail(input: { firstName: string; freeActivationEligible: boolean; signupRank: number }) {
  const free = input.freeActivationEligible
    ? `<div style="margin:22px 0;padding:18px;border-radius:14px;background:#e1f1e8;border:1px solid #9ccbb3"><strong>Your free bidder activation is reserved.</strong><br>You are signup number ${input.signupRank} and fall within our first 100. Create your account and submit the separate bidder-verification form when you are ready to bid. The usual R10 activation fee will be waived.</div>`
    : "";
  const subject = "Welcome to the Whacky family";
  const text = `Hi ${input.firstName},\n\nYou are officially on the Whacky Auctions Early Access list. ${input.freeActivationEligible ? `As signup number ${input.signupRank}, your free bidder activation is reserved. Complete the separate bidder-verification form when you are ready to bid.` : "We will keep you posted as launch day gets closer."}\n\nHave a look at the upcoming goods: ${SITE_URL}/auctions\n\nWhacky Auctions\n${SUPPORT_EMAIL}`;
  const html = layout(subject, `<p style="margin-top:0">Hi ${esc(input.firstName)},</p><h1 style="font-size:30px;line-height:1.15;margin:8px 0 16px">You’re officially part of the Whacky family!</h1><p>Your Early Access spot is saved. We’ll keep you in the loop as launch day gets closer and new lots start arriving.</p>${free}<p>In the meantime, have a squiz at what’s coming—and if you know someone who loves a good find, send them our way. The more bidders in the room, the more lekker the auction.</p>${button("See what’s coming", `${SITE_URL}/auctions`)}<p>See you when the hammer drops,<br><strong>The Whacky Auctions team</strong></p>`);
  return { subject, text, html };
}

export function bidderVerifiedEmail(input: { firstName: string; freeActivation: boolean }) {
  const subject = input.freeActivation ? "You’re verified—your free bidder activation is confirmed" : "You’re verified and ready to bid";
  const activation = input.freeActivation
    ? "Your once-off bidder verification is completely free as one of our first 100 signups. There is nothing to pay."
    : "Your bidder verification is complete and your account is ready for bidding.";
  const text = `Hi ${input.firstName},\n\nCongratulations—your Whacky Auctions bidder status is verified. ${activation}\n\nWe are getting the auction room ready. Tell your friends and keep an eye on ${SITE_URL}/auctions.\n\nWelcome to the Whacky family!\nThe Whacky Auctions team\n${SUPPORT_EMAIL}`;
  const html = layout(subject, `<p style="margin-top:0">Hi ${esc(input.firstName)},</p><h1 style="font-size:30px;line-height:1.15;margin:8px 0 16px">Congratulations—you’re a verified bidder!</h1><div style="margin:22px 0;padding:18px;border-radius:14px;background:#e1f1e8;border:1px solid #9ccbb3"><strong>${esc(activation)}</strong></div><p>We’re getting the auction room ready, polishing the virtual gavel and lining up the goods. Keep an eye on the site so you’re ready when bidding opens.</p><p>And don’t keep the lekker finds to yourself—tell your friends to join the Whacky family too. A lively auction room is a better auction room.</p>${button("Browse upcoming auctions", `${SITE_URL}/auctions`)}<p>Welcome to the Whacky family!<br><strong>The Whacky Auctions team</strong></p>`);
  return { subject, text, html };
}

export function smtpTestEmail() {
  const subject = "Whacky Auctions automated email test";
  const text = `Good news — automated email from ${SUPPORT_EMAIL} is configured correctly.`;
  const html = layout(subject, `<h1 style="font-size:28px;margin-top:0">Lekker—it works!</h1><p>Automated email from <strong>${SUPPORT_EMAIL}</strong> is configured correctly.</p><p>No customer received this test.</p>`);
  return { subject, text, html };
}

function smtpConfig() {
  const host = (Netlify.env.get("SMTP_HOST") || "").trim();
  const port = Number(Netlify.env.get("SMTP_PORT") || 465);
  const user = (Netlify.env.get("SMTP_USER") || "").trim();
  const pass = Netlify.env.get("SMTP_PASSWORD") || "";
  if (!host || !user || !pass) throw new Error("SMTP is not configured.");
  return { host, port, secure: port === 465, auth: { user, pass } };
}

export async function sendTransactionalEmail(input: {
  to: string;
  template: "early_access_welcome" | "bidder_verified";
  eventKey: string;
  message: { subject: string; text: string; html: string };
}) {
  const existing = (await db.sql`SELECT status FROM transactional_emails WHERE template=${input.template} AND event_key=${input.eventKey} LIMIT 1`)[0];
  if (existing?.status === "sent") return { sent: false, duplicate: true };
  const emailId = id();
  await db.sql`INSERT INTO transactional_emails(id,recipient,template,event_key,subject,status)
    VALUES(${emailId},${input.to.toLowerCase()},${input.template},${input.eventKey},${input.message.subject},'pending')
    ON CONFLICT(template,event_key) DO UPDATE SET recipient=EXCLUDED.recipient,subject=EXCLUDED.subject,status='pending',last_error=NULL`;
  try {
    const transport = nodemailer.createTransport(smtpConfig());
    const result = await transport.sendMail({
      from: `Whacky Auctions <${Netlify.env.get("SMTP_FROM_EMAIL") || SUPPORT_EMAIL}>`,
      replyTo: SUPPORT_EMAIL,
      to: input.to,
      subject: input.message.subject,
      text: input.message.text,
      html: input.message.html,
    });
    await db.sql`UPDATE transactional_emails SET status='sent',provider_message_id=${String(result.messageId || "")},sent_at=NOW(),last_error=NULL WHERE template=${input.template} AND event_key=${input.eventKey}`;
    return { sent: true, duplicate: false };
  } catch (error: any) {
    await db.sql`UPDATE transactional_emails SET status='failed',last_error=${String(error?.message || error).slice(0,1000)} WHERE template=${input.template} AND event_key=${input.eventKey}`;
    throw error;
  }
}

export async function safeSend(input: Parameters<typeof sendTransactionalEmail>[0]) {
  try { return await sendTransactionalEmail(input); }
  catch (error) { console.error("Transactional email failed", input.template, input.eventKey, error); return { sent: false, duplicate: false }; }
}
