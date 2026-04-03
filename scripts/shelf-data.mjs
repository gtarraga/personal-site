import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const LETTERBOXD_RSS = "https://letterboxd.com/miscerable/rss/";
const GOODREADS_RSS =
  "https://www.goodreads.com/review/list_rss/49366915?shelf=site";

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

async function fetchXml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "gtarraga.com shelf refresh",
    },
  });

  if (!response.ok) {
    throw new Error(`request failed: ${response.status} ${url}`);
  }

  return response.text();
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
  const xml = await fetchXml(GOODREADS_RSS);
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match = itemRegex.exec(xml);

  while (match !== null) {
    const itemXml = match[1];
    const title = getCDATA(itemXml, "title") || getTag(itemXml, "title");
    const authorName = getTag(itemXml, "author_name");
    const imageUrl = getCDATA(itemXml, "book_large_image_url");
    const bookId = getTag(itemXml, "book_id");
    const userReadAt = getCDATA(itemXml, "user_read_at");
    const userRating = getTag(itemXml, "user_rating");
    const bookPublished = getTag(itemXml, "book_published");

    if (title && userReadAt && bookId) {
      const date = new Date(userReadAt);

      if (!Number.isNaN(date.getTime())) {
        items.push({
          title,
          type: "book",
          imageUrl: imageUrl || "",
          url: `https://www.goodreads.com/book/show/${bookId}`,
          date: date.toISOString(),
          year: bookPublished ? Number.parseInt(bookPublished, 10) : undefined,
          rating:
            userRating && userRating !== "0"
              ? Number.parseInt(userRating, 10)
              : undefined,
          author: authorName || undefined,
        });
      }
    }

    match = itemRegex.exec(xml);
  }

  return items;
}

export async function fetchShelfSnapshot() {
  const [films, books] = await Promise.all([fetchLetterboxd(), fetchGoodreads()]);

  const items = [...films, ...books].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  );

  return {
    generatedAt: new Date().toISOString(),
    items,
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

export async function refreshShelfFile(filePath) {
  const snapshot = await fetchShelfSnapshot();
  await writeJsonFile(filePath, snapshot);
  return snapshot;
}

export async function refreshShelfFiles(filePaths) {
  const snapshot = await fetchShelfSnapshot();
  await Promise.all(filePaths.map((filePath) => writeJsonFile(filePath, snapshot)));
  return snapshot;
}
