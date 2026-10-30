import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLetterboxdUrl } from "./shelf-data.mjs";

test("normalizeLetterboxdUrl strips member path and trailing page segment", () => {
  assert.equal(
    normalizeLetterboxdUrl("https://letterboxd.com/miscerable/film/bugonia/2/"),
    "https://letterboxd.com/film/bugonia/"
  );
});

test("normalizeLetterboxdUrl leaves canonical film url alone", () => {
  assert.equal(
    normalizeLetterboxdUrl("https://letterboxd.com/film/bugonia/"),
    "https://letterboxd.com/film/bugonia/"
  );
});

import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { refreshShelfFile } from "./shelf-data.mjs";

const filmFeed = `<rss><channel><item><letterboxd:filmTitle>The Master</letterboxd:filmTitle><letterboxd:watchedDate>2026-10-22</letterboxd:watchedDate><link>https://letterboxd.com/miscerable/film/the-master-2012/</link></item></channel></rss>`;
function widget(html) {
  return "var widget_code = '" + html.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "';";
}
const emptyBookFeed = widget('<div class="gr_custom_container_"><h2 class="gr_custom_header_"><a href="https://www.goodreads.com/review/list/49366915?shelf=site">site</a></h2></div>');
const bookFeed = emptyBookFeed.replace('</div>', '<div class="gr_custom_each_container_"><div class="gr_custom_title_"><a href="https://www.goodreads.com/review/show/8704336991">New book</a></div><div class="gr_custom_book_container_"><img src="https://i.gr-assets.com/images/books/123.jpg"></div></div></div>');

const oldBook = { title: "Previous book", type: "book", date: "2026-01-01T00:00:00.000Z" };
const oldFilm = { title: "Previous film", type: "film", date: "2026-01-02T00:00:00.000Z" };

for (const failedSource of ["book", "film", "both"]) {
  test(`refresh preserves only failed sources (${failedSource})`, async (t) => {
    const dir = await mkdtemp(path.join(tmpdir(), "shelf-test-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const file = path.join(dir, "shelf.json");
    const previous = { generatedAt: "2026-10-21T00:00:00.000Z", items: [oldBook, oldFilm] };
    await writeFile(file, JSON.stringify(previous));
    t.mock.method(globalThis, "fetch", async (url) => {
      const source = url.includes("goodreads") ? "book" : "film";
      return new Response(source === "book" ? bookFeed : filmFeed, {
        status: failedSource === source || failedSource === "both" ? 404 : 200,
      });
    });
    const snapshot = await refreshShelfFile(file);
    const saved = JSON.parse(await readFile(file, "utf8"));
    assert.deepEqual(saved, JSON.parse(JSON.stringify(snapshot)));
    assert.equal(saved.items.find((item) => item.type === "book").title,
      failedSource === "book" || failedSource === "both" ? oldBook.title : "New book");
    assert.equal(saved.items.find((item) => item.type === "film").title,
      failedSource === "film" || failedSource === "both" ? oldFilm.title : "The Master");
    if (failedSource === "both") assert.equal(saved.generatedAt, previous.generatedAt);
  });
}

test("a successful empty feed removes previous items for that source", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "shelf-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "shelf.json");
  await writeFile(file, JSON.stringify({ items: [oldBook, oldFilm] }));
  t.mock.method(globalThis, "fetch", async (url) => new Response(
    url.includes("goodreads") ? emptyBookFeed : filmFeed));
  const snapshot = await refreshShelfFile(file);
  assert.equal(snapshot.items.some((item) => item.type === "book"), false);
});

test("HTML with status 200 cannot erase the previous shelf", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "shelf-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "shelf.json");
  await writeFile(file, JSON.stringify({ items: [oldBook, oldFilm] }));
  t.mock.method(globalThis, "fetch", async (url) => new Response(
    url.includes("goodreads") ? "<html>Sign in</html>" : filmFeed));
  const snapshot = await refreshShelfFile(file);
  assert.equal(snapshot.items.find((item) => item.type === "book").title, oldBook.title);
});

test("a clean build retains baked books when Goodreads is down", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "shelf-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  t.mock.method(globalThis, "fetch", async (url) => new Response(
    url.includes("goodreads") ? "Not found" : filmFeed,
    {status: url.includes("goodreads") ? 404 : 200}));
  const snapshot = await refreshShelfFile(path.join(dir, "shelf.json"));
  assert.equal(snapshot.items.filter((item) => item.type === "book").length, 9);
  assert.equal(snapshot.items.find((item) => item.type === "film").title, "The Master");
  assert.equal(snapshot.errors[0].source, "book");
  assert.equal(snapshot.refreshedAt.book, "2026-10-21T15:43:37.856Z");
});
