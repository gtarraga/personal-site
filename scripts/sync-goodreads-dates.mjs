import { readFile, writeFile, rename } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { GOODREADS_WIDGET, parseGoodreadsWidget, withExactReadingDates } from "./goodreads-widget.mjs";
import { fetchShelfText } from "./shelf-data.mjs";

function titleKey(title) {
  return title.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function syncReadingDates(widgetBooks, savedBooks, readings) {
  if (!Array.isArray(readings) || readings.length !== widgetBooks.length) {
    throw new Error("Provide the exact Date Read for every book on the complete site shelf");
  }
  const rows = new Map();
  for (const reading of readings) {
    if (typeof reading.title !== "string") throw new Error("Every reading needs a title");
    const key = titleKey(reading.title);
    if (rows.has(key)) throw new Error(`Duplicate shelf title: ${reading.title}`);
    let date = null;
    if (reading.dateRead !== null) {
      if (typeof reading.dateRead !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(reading.dateRead)) throw new Error(`Date Read must be YYYY-MM-DD or null: ${reading.title}`);
      const parsed = new Date(`${reading.dateRead}T00:00:00.000Z`);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== reading.dateRead) throw new Error(`Invalid calendar date: ${reading.title}`);
      date = parsed.toISOString();
    }
    rows.set(key, date);
  }
  const old = new Map(savedBooks.map((book) => [book.reviewId, book]));
  return widgetBooks.map((book) => {
    const key = titleKey(book.title);
    if (!rows.has(key)) throw new Error(`Date Read missing for widget book: ${book.title}`);
    const date = rows.get(key);
    rows.delete(key);
    return { reviewId: book.reviewId, title: book.title, date, year: old.get(book.reviewId)?.year };
  }).sort((a, b) => a.reviewId.localeCompare(b.reviewId));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("Usage: node scripts/sync-goodreads-dates.mjs readings.json");
  const manifestPath = new URL("./goodreads-books.json", import.meta.url);
  const [readings, saved, source] = await Promise.all([
    readFile(inputPath, "utf8").then(JSON.parse),
    readFile(manifestPath, "utf8").then(JSON.parse),
    fetchShelfText(GOODREADS_WIDGET),
  ]);
  const widgetBooks = parseGoodreadsWidget(source);
  const books = syncReadingDates(widgetBooks, saved.books, readings);
  const previous = [...saved.books].sort((a, b) => a.reviewId.localeCompare(b.reviewId));
  if (JSON.stringify(previous) === JSON.stringify(books)) {
    console.log(`Goodreads verified: ${books.length} exact reading dates unchanged`);
  } else {
    const temporaryPath = new URL("./goodreads-books.json.tmp", import.meta.url);
    await writeFile(temporaryPath, `${JSON.stringify({ books }, null, 2)}\n`);
    await rename(temporaryPath, manifestPath);
    const fallbackPath = new URL("./shelf-fallback.json", import.meta.url);
    const fallback = JSON.parse(await readFile(fallbackPath, "utf8"));
    const previousTimestamp = fallback.generatedAt;
    fallback.items = [
      ...fallback.items.filter((item) => item.type !== "book"),
      ...withExactReadingDates(widgetBooks, books),
    ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    fallback.generatedAt = new Date().toISOString();
    fallback.refreshedAt = { film: fallback.refreshedAt?.film ?? previousTimestamp, book: fallback.generatedAt };
    const fallbackTemporaryPath = new URL("./shelf-fallback.json.tmp", import.meta.url);
    await writeFile(fallbackTemporaryPath, `${JSON.stringify(fallback, null, 2)}\n`);
    await rename(fallbackTemporaryPath, fallbackPath);
    console.log(`Goodreads synced: ${books.length} exact reading dates`);
  }
}
