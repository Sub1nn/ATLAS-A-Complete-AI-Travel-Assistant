import test from "node:test";
import assert from "node:assert/strict";
import { checkEmailDomain } from "../services/emailDomainService.js";

test("email domain validation accepts a domain with a usable MX record", async () => {
  const result = await checkEmailDomain("traveller@mail-capable.example.org", {
    resolveMxFn: async () => [{ priority: 10, exchange: "mail.example.org" }],
  });
  assert.equal(result.acceptsMail, true);
  assert.equal(result.reason, "mx_found");
});

test("email domain validation rejects a domain without MX records", async () => {
  const error = Object.assign(new Error("No data"), { code: "ENODATA" });
  const result = await checkEmailDomain("traveller@no-mail.example.org", {
    resolveMxFn: async () => { throw error; },
  });
  assert.equal(result.acceptsMail, false);
  assert.equal(result.transient, false);
  assert.equal(result.reason, "mx_missing");
});

test("email domain validation rejects reserved preview addresses without DNS", async () => {
  let lookupCalled = false;
  const result = await checkEmailDomain("traveller@portfolio.test", {
    resolveMxFn: async () => {
      lookupCalled = true;
      return [{ priority: 10, exchange: "mail.portfolio.test" }];
    },
  });
  assert.equal(result.acceptsMail, false);
  assert.equal(lookupCalled, false);
});

test("email domain validation reports temporary resolver failures separately", async () => {
  const error = Object.assign(new Error("Resolver unavailable"), { code: "ESERVFAIL" });
  const result = await checkEmailDomain("traveller@temporary-failure.example.org", {
    resolveMxFn: async () => { throw error; },
  });
  assert.equal(result.acceptsMail, false);
  assert.equal(result.transient, true);
  assert.equal(result.reason, "lookup_unavailable");
});
