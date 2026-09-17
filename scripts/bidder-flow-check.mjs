import fs from "node:fs";
import assert from "node:assert/strict";

const app = fs.readFileSync("public/app.js", "utf8");
const api = fs.readFileSync("netlify/functions/api.mts", "utf8");

for (const required of [
  'id="early-access"',
  'function earlyAccessForm()',
  'href="/join"',
  'go("/profile")',
  'name="firstName"',
  'name="lastName"',
  'name="mobile"',
  'name="idNumber"',
  'name="confirmAdult"',
  "Verification status",
  "Admin controls",
]) assert.ok(app.includes(required), `Missing bidder-flow requirement: ${required}`);

assert.ok(!app.includes('href="/register"'), "Public navigation must not link directly to bidder verification.");
assert.ok(!app.includes('function bidderSignupPage()'), "Standalone verified-bidder signup page must be removed.");
assert.ok(app.includes('id="verifyBidder"'), "R10 verification action must remain on the account page.");
assert.ok(app.includes('Activate verified bidder status — R10'), "The account page must clearly display the R10 activation price.");

const formStart = app.indexOf("function registerForm()");
const formEnd = app.indexOf("function bindAuth()", formStart);
const form = app.slice(formStart, formEnd);
assert.ok(formStart >= 0 && formEnd > formStart, "Could not isolate bidder registration form.");
assert.ok(!form.includes('name="physicalAddress"'), "Physical address must not appear in bidder registration.");
assert.ok(!form.includes('name="dateOfBirth"'), "Date of birth must not appear in bidder registration.");

const registrationStart = api.indexOf('parts[0] === "register"');
const registrationEnd = api.indexOf('parts[0] === "login"', registrationStart);
const registration = api.slice(registrationStart, registrationEnd);
assert.ok(registration.includes("!b.confirmAdult"), "Adult confirmation must be checked server-side.");
assert.ok(!registration.includes("b.physicalAddress"), "API must not require a physical address.");
assert.ok(!registration.includes("b.dateOfBirth"), "API must not require a date of birth.");
assert.ok(registration.includes("NULL,NULL"), "Removed fields must be stored as NULL for schema compatibility.");

console.log("Whacky Auctions bidder-flow checks passed.");
