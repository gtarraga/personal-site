import test from "node:test";
import assert from "node:assert/strict";
import { parseGoodreadsWidget, withExactReadingDates } from "./goodreads-widget.mjs";
import { syncReadingDates } from "./sync-goodreads-dates.mjs";

function widget(titles = ["Breakneck: China's &amp; Future"], prefix = "") {
  const cards = titles.map((title, i) => `<div class="gr_custom_each_container_"><div class="gr_custom_title_"><a href="https://www.goodreads.com/review/show/${100 + i}">${title}</a></div><div class="gr_custom_book_container_"><img src="https://i.gr-assets.com/images/books/${200 + i}._SX50_.jpg"></div><div class="gr_custom_author_"><a>Dan Wang</a></div><div class="gr_custom_rating_"><img src="https://s.gr-assets.com/images/layout/gr_flat_red_star_active.png"></div></div>`).join("");
  const html = `<div class="gr_custom_container_"><h2 class="gr_custom_header_"><a href="https://www.goodreads.com/review/list/49366915?shelf=site">site</a></h2>${cards}</div>`;
  return prefix + "var widget_code = '" + html.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\//g, "\\/") + "';";
}

test("public widget yields exact membership, decoded titles, authors, ratings and full covers", () => {
  const [book] = parseGoodreadsWidget(widget());
  assert.equal(book.title, "Breakneck: China's & Future");
  assert.equal(book.url, "https://www.goodreads.com/book/show/200");
  assert.equal(book.imageUrl, "https://i.gr-assets.com/images/books/200.jpg");
  assert.equal(book.author, "Dan Wang");
  assert.equal(book.rating, 1);
});
test("remote JavaScript is parsed as data, never executed", () => {
  parseGoodreadsWidget(widget(undefined, 'throw new Error("must not run");'));
  assert.throws(() => parseGoodreadsWidget('<html>Sign in</html>'), /markup/);
});
test("new books cannot receive invented reading dates", () => {
  const books = parseGoodreadsWidget(widget());
  assert.throws(() => withExactReadingDates(books, []), /Exact Goodreads reading date needs syncing/);
  const saved = [{ reviewId: "100", date: "2020-01-03T00:00:00.000Z", year: 2019 }];
  assert.equal(withExactReadingDates(books, saved)[0].date, saved[0].date);
  assert.equal(withExactReadingDates(books, [{reviewId: "100", date: null}]).length, 0);
});
test("signed-in shelf dates can add books and correct historical dates without activity timestamps", () => {
  const books = parseGoodreadsWidget(widget(["Old book", "New book"]));
  const saved = syncReadingDates(books, [], [{title: "Old book", dateRead: "2020-01-02"}, {title: "New book", dateRead: "2018-03-04"}]);
  assert.deepEqual(withExactReadingDates(books, saved).map(book => book.date), ["2020-01-02T00:00:00.000Z", "2018-03-04T00:00:00.000Z"]);
  assert.throws(() => syncReadingDates(books, saved, [{title: "Old book", dateRead: "2020-01-02"}]), /complete site shelf/);
  assert.throws(() => syncReadingDates(books, saved, [{title: "Old book", dateRead: "2026-02-30"}, {title: "New book", dateRead: null}]), /Invalid calendar date/);
});
test("truncated widget cannot silently delete books", () => {
  assert.throws(() => parseGoodreadsWidget(widget(Array.from({length:100},(_,i)=>`Book ${i}`))), /truncated/);
});
