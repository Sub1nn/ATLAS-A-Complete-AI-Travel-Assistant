// Fast local smoke checks for validation, context extraction, and document chunking

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import assert from "node:assert/strict";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const { cleanText } = await import("../utils/validation.js");
const { contextService } = await import("../services/contextService.js");
const { documentService } = await import("../services/documentService.js");

assert.equal(cleanText(" hello\nworld "), "hello world");

assert.equal(
  contextService.extractLocations("suggest me some hotels there").length,
  0,
);

assert.equal(
  contextService.extractLocations("weather in Riihimaki")[0].toLowerCase(),
  "riihimäki",
);

const chunks = documentService.chunkText(
  "This is a robotics thesis about force sensing and imitation learning. ".repeat(
    40,
  ),
);

assert.ok(chunks.length > 0);
assert.ok(chunks[0].text.length > 0);
assert.ok(Array.isArray(chunks[0].keywords));
assert.ok(documentService.embeddingFor(chunks[0].text).length > 0);

console.log("✅ ATLAS smoke checks passed");
