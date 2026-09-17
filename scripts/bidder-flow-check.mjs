import fs from "node:fs";
import assert from "node:assert/strict";

const app = fs.readFileSync("public/app.js", "utf8");
const api = fs.readFileSync("netlify/functions/api.mts", "utf8");

for (const required of [
  'id="early-access"',
  'function earlyAccessForm()',
  'Create my Early Access account',
  'Sign in to your Early Access account',
  'href="/verify-bidder"',
  'function verifyBidderPage()',
  'else if (r === "verify-bidder") html = verifyBidderPage()',
  'id="verifyBidderForm"',
  'Continue to secure R10 payment',
]) assert.ok(app.includes(required), `Missing bidder-flow requirement: ${required}`);

assert.ok(!app.includes('id="registerTab"'), "The sign-in modal must not contain a Register tab.");
assert.ok(!app.includes('id="registerForm"'), "Bidder registration must not appear beside sign in.");
assert.ok(!app.includes('href="/register"'), "Public navigation must not link directly to bidder registration.");

const earlyFormStart = app.indexOf("function earlyAccessForm()");
const earlyFormEnd = app.indexOf("async function auctionPage", earlyFormStart);
const earlyForm = app.slice(earlyFormStart, earlyFormEnd);
for (const field of ['name="firstName"', 'name="lastName"', 'name="email"', 'name="mobile"', 'name="password"', 'name="confirmAdult"'])
  assert.ok(earlyForm.includes(field), `Early Access account form is missing ${field}.`);
assert.ok(!earlyForm.includes('name="idNumber"'), "Early Access must not collect the bidder ID number.");

const verificationPageStart = app.indexOf("function verifyBidderPage()");
const verificationPageEnd = app.indexOf("function legal()", verificationPageStart);
const verificationPage = app.slice(verificationPageStart, verificationPageEnd);
assert.ok(verificationPage.includes('name="idNumber"'), "The separate bidder page must collect the ID number.");
assert.ok(verificationPage.includes("R10"), "The separate bidder page must disclose the R10 activation fee.");

const earlyApiStart = api.indexOf('parts[0] === "early-access"');
const loginApiStart = api.indexOf('parts[0] === "login"', earlyApiStart);
const earlyApi = api.slice(earlyApiStart, loginApiStart);
assert.ok(earlyApi.includes("hashPassword(password)"), "Early Access signup must create login credentials.");
assert.ok(earlyApi.includes("createSession(uid)"), "Early Access signup must sign the new account in.");
assert.ok(earlyApi.includes("NULL,NULL,NULL"), "Early Access account must not collect bidder identity details.");
assert.ok(!api.includes('parts[0] === "register"'), "The obsolete public registration API must be removed.");

const checkoutStart = api.indexOf('parts[2] === "checkout"');
const checkoutEnd = api.indexOf('parts[0] === "auctions"', checkoutStart);
const checkout = api.slice(checkoutStart, checkoutEnd);
assert.ok(checkout.includes("idNumber"), "Verification checkout must require the ID number.");
assert.ok(checkout.includes("amountCents:1000"), "Verification checkout amount must remain R10.");
assert.ok(checkout.includes("/verify-bidder?verification=return"), "Yoco must return to the separate bidder page.");

console.log("Whacky Auctions bidder-flow checks passed.");
