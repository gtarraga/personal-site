import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const shelfPagePath = path.join(rootDir, "src", "pages", "shelf.astro");

test("shelf page styles are global so hydrated items keep sizing", async () => {
  const source = await readFile(shelfPagePath, "utf8");

  assert.match(source, /<style\s+is:global>/);
});
