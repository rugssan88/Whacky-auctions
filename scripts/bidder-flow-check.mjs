import fs from "node:fs";
import assert from "node:assert/strict";

const app = fs.readFileSync("public/app.js", "utf8");
const api = fs.readFileSync("netlify/functions/api.mts", "utf8");
const migration = fs.readFileSync("netlify/database/migrations/007_early_access_account_claims/migration.sql", "utf8");

for (const required of [
  'id="early-access"',
  'function earlyAccessForm()',
  'Join Early Access',
  'function bindEarlyAccessAccount(',
  'Sign in to your Early Access account',
  'href="/verify-bidder"',
  'async function verifyBidderPage()',
  'else if (r === "verify-bidder") html = await verifyBidderPage()',
  'id="verifyBidderForm"',
  'Activate my bidder status free',
  'Continue to secure R10 payment',
  'function trackFunnel(event)',
]) assert.ok(app.includes(required), `Missing bidder-flow requirement: ${required}`);

assert.ok(!app.includes('id="registerTab"'), "The sign-in modal must not contain a Register tab.");
assert.ok(!app.includes('id="registerForm"'), "Bidder registration must not appear beside sign in.");
assert.ok(!app.includes('href="/register"'), "Public navigation must not link directly to bidder registration.");

const earlyFormStart = app.indexOf("function earlyAccessForm()");
const earlyFormEnd = app.indexOf("async function auctionPage", earlyFormStart);
const earlyForm = app.slice(earlyFormStart, earlyFormEnd);
for (const field of ['name="fullName"', 'name="email"', 'name="mobile"'])
  assert.ok(earlyForm.includes(field), `Early Access form is missing ${field}.`);
for (const forbidden of ['name="idNumber"', 'name="password"', 'name="confirmAdult"', 'name="acceptTerms"'])
  assert.ok(!earlyForm.includes(forbidden), `Initial Early Access form must not contain ${forbidden}.`);

const verificationPageStart = app.indexOf("async function verifyBidderPage()");
const verificationPageEnd = app.indexOf("function legal()", verificationPageStart);
const verificationPage = app.slice(verificationPageStart, verificationPageEnd);
assert.ok(verificationPage.includes('name="idNumber"'), "The separate bidder page must collect the ID number.");
assert.ok(verificationPage.includes("freeActivationEligible"), "The bidder page must show first-100 free eligibility.");

for (const required of [
  'parts[0] === "funnel-event"',
  'parts[0] === "early-access" && parts.length === 1',
  'parts[0] === "early-access" && parts[1] === "account"',
  'randomToken(24)',
  'hashPassword(password)',
  'createSession(uid)',
  'signupRank <= 100',
  'bidder_verification_waived',
  'amountCents:1000',
  '/verify-bidder?verification=return',
]) assert.ok(api.includes(required), `API is missing bidder-flow requirement: ${required}`);

assert.ok(!api.includes('parts[0] === "register"'), "The obsolete public registration API must remain removed.");
assert.ok(migration.includes("account_token_hash"), "Account-claim token migration is missing.");
assert.ok(migration.includes("claimed_user_id"), "Account claim must be linked to a user.");

console.log("Whacky Auctions bidder-flow checks passed.");
