import fs from "node:fs";
import assert from "node:assert/strict";

const api = fs.readFileSync("netlify/functions/api.mts", "utf8");
const email = fs.readFileSync("netlify/functions/lib/email.mts", "utf8");
const migration = fs.readFileSync("netlify/database/migrations/008_transactional_email/migration.sql", "utf8");

for (const required of [
  'template: "early_access_welcome"',
  'template: "bidder_verified"',
  'message: signupEmail({ firstName, signupRank: offer.signupRank',
  'message: bidderVerifiedEmail({ firstName: u.first_name, freeActivation: true })',
  'message: bidderVerifiedEmail({ firstName: verifiedUser.first_name, freeActivation: false })',
]) assert.ok(api.includes(required), `Missing email-flow requirement: ${required}`);

for (const required of [
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD',
  'Welcome to the Whacky family',
  'first 100 signups', 'CLOUD9 promo applied',
  'tell your friends',
  'ON CONFLICT(template,event_key)',
  'Whacky Auctions automated email test',
]) assert.ok(email.includes(required), `Missing transactional-email requirement: ${required}`);

assert.ok(email.includes('const benefit = input.freeActivationEligible'), "Free-verification copy must remain conditional.");
assert.ok(migration.includes('UNIQUE(template,event_key)'), "Email delivery must be idempotent.");
console.log("Whacky Auctions transactional-email checks passed.");
