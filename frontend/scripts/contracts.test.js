import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const apiSource = fs.readFileSync(new URL("../src/services/api.js", import.meta.url), "utf8");
const hookSource = fs.readFileSync(new URL("../src/hooks/useChat.js", import.meta.url), "utf8");
const legalSource = fs.readFileSync(new URL("../src/legal-page.js", import.meta.url), "utf8");
const viteSource = fs.readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");

test("document retry is exposed by documentAPI and consumed by useChat", () => {
  const conversationBlock = apiSource.slice(apiSource.indexOf("export const conversationAPI"), apiSource.indexOf("export const documentAPI"));
  const documentBlock = apiSource.slice(apiSource.indexOf("export const documentAPI"), apiSource.indexOf("export const chatAPI"));
  assert.doesNotMatch(conversationBlock, /async retry\(/);
  assert.match(documentBlock, /async retry\(id\)/);
  assert.match(hookSource, /documentAPI\.retry\(id\)/);
});

test("session restoration uses one shared refresh promise", () => {
  assert.match(apiSource, /let refreshPromise = null/);
  assert.match(apiSource, /if \(!refreshPromise\) refreshPromise = performRefresh\(\)/);
});

test("legal pages use the configured API base and are Vite build entries", () => {
  assert.match(legalSource, /import\.meta\.env\.VITE_API_BASE_URL/);
  assert.match(legalSource, /`\$\{apiBaseUrl\}\/legal`/);
  assert.match(viteSource, /privacy: resolve/);
  assert.match(viteSource, /terms: resolve/);
});
