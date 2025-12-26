export type MediaType = "film" | "book";

export interface MediaItem {
  title: string;
  type: MediaType;
  imageUrl: string;
  url: string;
  date: Date;
  year?: number;
  rating?: number;
  author?: string; // for books
}

const LETTERBOXD_RSS = "https://letterboxd.com/miscerable/rss/";
const GOODREADS_RSS =
  "https://www.goodreads.com/review/list_rss/49366915?shelf=site";

function extractImageFromCDATA(description: string): string | null {
  const match = /src="([^"]+)"/.exec(description);
  return match ? match[1] : null;
}

function getTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}(?:\\s+[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

function getCDATA(xml: string, tag: string): string | null {
  const regex = new RegExp(
    `<${tag}(?:\\s+[^>]*)?>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`,
    "i"
  );
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

async function fetchLetterboxd(): Promise<MediaItem[]> {
  const response = await fetch(LETTERBOXD_RSS);
  const xml = await response.text();

  const items: MediaItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const filmTitle = getTag(itemXml, "letterboxd:filmTitle");
    const filmYear = getTag(itemXml, "letterboxd:filmYear");
    const rating = getTag(itemXml, "letterboxd:memberRating");
    const watchedDate = getTag(itemXml, "letterboxd:watchedDate");
    const link = getTag(itemXml, "link");
    const description = getCDATA(itemXml, "description");

    if (filmTitle && watchedDate) {
      const date = new Date(watchedDate);
      if (Number.isNaN(date.getTime())) continue;

      const imageUrl = description ? extractImageFromCDATA(description) : null;

      // Convert user review URL to film page URL
      // From: https://letterboxd.com/miscerable/film/bugonia/
      // To: https://letterboxd.com/film/bugonia/
      const filmUrl = link
        ? link.replace(/letterboxd\.com\/[^/]+\/film/, "letterboxd.com/film")
        : "";

      items.push({
        title: filmTitle,
        type: "film",
        imageUrl: imageUrl || "",
        url: filmUrl,
        date: date,
        year: filmYear ? Number.parseInt(filmYear) : undefined,
        rating: rating ? Number.parseFloat(rating) : undefined,
      });
    }
  }

  return items;
}

async function fetchGoodreads(): Promise<MediaItem[]> {
  const response = await fetch(GOODREADS_RSS);
  const xml = await response.text();

  const items: MediaItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
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
      if (Number.isNaN(date.getTime())) continue;

      // Link directly to the book page, not the review
      const bookUrl = `https://www.goodreads.com/book/show/${bookId}`;

      items.push({
        title,
        type: "book",
        imageUrl: imageUrl || "",
        url: bookUrl,
        date: date,
        year: bookPublished ? Number.parseInt(bookPublished) : undefined,
        rating:
          userRating && userRating !== "0"
            ? Number.parseInt(userRating)
            : undefined,
        author: authorName || undefined,
      });
    }
  }

  return items;
}

export async function getShelfItems(limit?: number): Promise<MediaItem[]> {
  const [films, books] = await Promise.all([
    fetchLetterboxd(),
    fetchGoodreads(),
  ]);

  const allItems = [...films, ...books].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  return limit ? allItems.slice(0, limit) : allItems;
}

export async function getRecentMedia(
  filmCount: number,
  bookCount: number
): Promise<MediaItem[]> {
  const [films, books] = await Promise.all([
    fetchLetterboxd(),
    fetchGoodreads(),
  ]);

  const sortedFilms = [...films].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
  const sortedBooks = [...books].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  const topFilms = sortedFilms.slice(0, filmCount);
  const topBooks = sortedBooks.slice(0, bookCount);

  return [...topFilms, ...topBooks].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
}
