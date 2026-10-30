import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GOODREADS_WIDGET, parseGoodreadsWidget, withExactReadingDates } from "./goodreads-widget.mjs";

const fallbackPath = fileURLToPath(new URL("./shelf-fallback.json", import.meta.url));

const LETTERBOXD_RSS = "https://letterboxd.com/miscerable/rss/";
const goodreadsBooksPath = new URL("./goodreads-books.json", import.meta.url);

function extractImageFromCDATA(description) {
  const match = /src="([^"]+)"/.exec(description);
  return match ? match[1] : null;
}

function getTag(xml, tag) {
  const regex = new RegExp(`<${tag}(?:\\s+[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

function getCDATA(xml, tag) {
  const regex = new RegExp(
    `<${tag}(?:\\s+[^>]*)?>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`,
    "i"
  );
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

export function normalizeLetterboxdUrl(url) {
  if (!url) {
    return "";
  }

  const normalized = url.replace(
    /https?:\/\/letterboxd\.com\/[^/]+\/film\//,
    "https://letterboxd.com/film/"
  );

  return normalized.replace(/\/\d+\/?$/, "/");
}

const FETCH_TIMEOUT_MS = 8000;

export async function fetchShelfText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "gtarraga.com shelf refresh",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`request failed: ${response.status} ${url}`);
  }

  return response.text();
}

async function fetchXml(url) {
  const xml = await fetchShelfText(url);
  if (!/<rss(?:\s|>)/i.test(xml) || !/<channel(?:\s|>)/i.test(xml)) {
    throw new Error(`invalid RSS response: ${new URL(url).hostname}`);
  }
  return xml;
}

async function fetchLetterboxd() {
  const xml = await fetchXml(LETTERBOXD_RSS);
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match = itemRegex.exec(xml);

  while (match !== null) {
    const itemXml = match[1];
    const filmTitle = getTag(itemXml, "letterboxd:filmTitle");
    const filmYear = getTag(itemXml, "letterboxd:filmYear");
    const rating = getTag(itemXml, "letterboxd:memberRating");
    const watchedDate = getTag(itemXml, "letterboxd:watchedDate");
    const link = getTag(itemXml, "link");
    const description = getCDATA(itemXml, "description");

    if (filmTitle && watchedDate) {
      const date = new Date(watchedDate);

      if (!Number.isNaN(date.getTime())) {
        const imageUrl = description ? extractImageFromCDATA(description) : null;

        items.push({
          title: filmTitle,
          type: "film",
          imageUrl: imageUrl || "",
          url: normalizeLetterboxdUrl(link || ""),
          date: date.toISOString(),
          year: filmYear ? Number.parseInt(filmYear, 10) : undefined,
          rating: rating ? Number.parseFloat(rating) : undefined,
        });
      }
    }

    match = itemRegex.exec(xml);
  }

  return items;
}

async function fetchGoodreads() {
  const [source, saved] = await Promise.all([
    fetchShelfText(GOODREADS_WIDGET),
    readFile(goodreadsBooksPath, "utf8").then(JSON.parse),
  ]);
  return withExactReadingDates(parseGoodreadsWidget(source), saved.books);
}

export async function fetchShelfSnapshot(previous = { items: [] }) {
  const results = await Promise.allSettled([fetchLetterboxd(), fetchGoodreads()]);
  const types = ["film", "book"];
  const errors = [];
  const items = results.flatMap((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const source = types[index];
    const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
    console.error(`shelf ${source} refresh failed; retaining previous items`, message);
    errors.push({ source, message });
    return previous.items.filter((item) => item.type === source);
  }).sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  );

  return {
    generatedAt: results.every((result) => result.status === "rejected")
      ? previous.generatedAt ?? null
      : new Date().toISOString(),
    items,
    refreshedAt: Object.fromEntries(results.map((result, index) => [
      types[index],
      result.status === "fulfilled" ? new Date().toISOString()
        : previous.refreshedAt?.[types[index]] ?? previous.generatedAt ?? null,
    ])),
    errors,
  };
}

async function writeJsonFile(filePath, data) {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  const tempPath = `${filePath}.tmp`;
  const content = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, filePath);
}

async function readSnapshot(filePaths) {
  for (const filePath of [...filePaths, fallbackPath]) {
    try {
      const snapshot = JSON.parse(await readFile(filePath, "utf8"));
      if (Array.isArray(snapshot.items)) return snapshot;
    } catch (error) {
      if (error.code !== "ENOENT") console.warn(`cannot read shelf fallback: ${filePath}`, error.message);
    }
  }
  return { items: [] };
}

export async function refreshShelfFile(filePath) {
  return refreshShelfFiles([filePath]);
}

export async function refreshShelfFiles(filePaths) {
  const snapshot = await fetchShelfSnapshot(await readSnapshot(filePaths));
  await Promise.all(filePaths.map((filePath) => writeJsonFile(filePath, snapshot)));
  return snapshot;
}
