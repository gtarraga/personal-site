import { load } from "cheerio/slim";

export const GOODREADS_WIDGET = "https://www.goodreads.com/review/custom_widget/49366915.site?shelf=site&num_books=100&sort=date_read&order=d";

// Extract only the widget's string literal. Never evaluate remote JavaScript.
export function parseGoodreadsWidget(source) {
  const literal = /var\s+widget_code\s*=\s*'((?:\\[\s\S]|[^'\\])*)'/.exec(source);
  if (!literal) throw new Error("Goodreads widget did not contain book markup");
  const html = literal[1].replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (_, escaped) => {
    if (escaped.startsWith("u") || escaped.startsWith("x")) return String.fromCharCode(Number.parseInt(escaped.slice(1), 16));
    const escapes = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "\\": "\\", "'": "'", '"': '"', "/": "/" };
    if (!(escaped in escapes)) throw new Error("Unsupported escape in Goodreads widget");
    return escapes[escaped];
  });
  const $ = load(html);
  const shelfLink = $(".gr_custom_header_ a").attr("href");
  const shelfUrl = shelfLink ? new URL(shelfLink, "https://www.goodreads.com") : null;
  if ($(".gr_custom_container_").length !== 1 || shelfUrl?.hostname !== "www.goodreads.com" || shelfUrl.searchParams.get("shelf") !== "site") {
    throw new Error("Goodreads widget is not the site shelf");
  }
  const cards = $(".gr_custom_each_container_");
  if (cards.length >= 100) throw new Error("Goodreads widget may be truncated at 100 books");
  const seen = new Set();
  return cards.map((_, card) => {
    const titleLink = $(card).find(".gr_custom_title_ a");
    const reviewId = /\/review\/show\/(\d+)/.exec(titleLink.attr("href") ?? "")?.[1];
    const title = titleLink.text().trim();
    const imageUrl = $(card).find(".gr_custom_book_container_ img").attr("src");
    if (!reviewId || !title || !imageUrl || seen.has(reviewId)) throw new Error("Malformed or duplicate Goodreads widget book");
    const image = new URL(imageUrl);
    if (image.protocol !== "https:" || !["i.gr-assets.com", "images.gr-assets.com"].includes(image.hostname)) throw new Error("Unexpected Goodreads cover URL");
    seen.add(reviewId);
    const bookId = /\/(\d+)(?:\.[^/]*)?\.(?:jpg|png)$/.exec(image.pathname)?.[1];
    const stars = $(card).find('.gr_custom_rating_ img[src*="gr_flat_red_star_active"]').length;
    return {
      reviewId,
      title,
      type: "book",
      imageUrl: imageUrl.replace(/\._[^/]+_\.(jpg|png)$/, ".$1"),
      url: bookId ? `https://www.goodreads.com/book/show/${bookId}` : `https://www.goodreads.com/review/show/${reviewId}`,
      author: $(card).find(".gr_custom_author_ a").text().trim() || undefined,
      rating: stars || undefined,
    };
  }).get();
}

export function withExactReadingDates(books, savedBooks) {
  const dates = new Map(savedBooks.map((book) => [book.reviewId, book]));
  return books.flatMap((book) => {
    const saved = dates.get(book.reviewId);
    if (!saved || !("date" in saved)) throw new Error(`Exact Goodreads reading date needs syncing: ${book.title} (review ${book.reviewId})`);
    // A blank Date Read on Goodreads remains undated and is omitted, as with RSS.
    if (saved.date === null) return [];
    if (!/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(saved.date) || !Number.isFinite(Date.parse(saved.date)) || new Date(saved.date).toISOString() !== saved.date) throw new Error(`Invalid saved Goodreads reading date: ${book.reviewId}`);
    return [{ ...book, date: saved.date, year: saved.year }];
  });
}
