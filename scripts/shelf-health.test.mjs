import test from "node:test";
import assert from "node:assert/strict";
import { shelfHealth } from "./shelf-health.mjs";
const now = Date.parse("2026-10-30T12:00:00Z");
test("a fresh film refresh cannot hide stale books", () => {
  const result = shelfHealth({ generatedAt: new Date(now).toISOString(), refreshedAt: {
    film: new Date(now).toISOString(), book: "2026-10-21T15:43:37Z",
  } }, now);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].source, "book");
});
test("recent successful feeds are healthy", () => {
  assert.equal(shelfHealth({ generatedAt: new Date(now).toISOString() }, now).ok, true);
});
test("recent feed failures and unknown timestamps are unhealthy", () => {
  assert.equal(shelfHealth({ generatedAt: new Date(now).toISOString(), errors: [{source: "book", message: "404"}] }, now).ok, false);
  assert.equal(shelfHealth({ generatedAt: null }, now).ok, false);
});
