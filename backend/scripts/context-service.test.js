// Tests for destination extraction and canonical location handling

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import test from "node:test";
import assert from "node:assert/strict";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const { contextService } = await import("../services/contextService.js");

test("does not extract conversational filler as a location", () => {
  assert.deepEqual(
    contextService.extractLocations("suggest me some hotels there"),
    [],
  );

  assert.deepEqual(contextService.extractLocations("yes I want to know"), []);
});

test("keeps real city names with accent variants", () => {
  assert.equal(contextService.canonicalDestination("Riihimaki"), "Riihimäki");

  assert.equal(
    contextService
      .extractLocations("hourly forecast for Riihimaki")[0]
      .toLowerCase(),
    "riihimäki",
  );
});
