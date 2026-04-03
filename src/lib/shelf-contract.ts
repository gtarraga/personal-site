export type MediaType = "film" | "book";

export interface MediaItem {
  title: string;
  type: MediaType;
  imageUrl: string;
  url: string;
  date: string;
  year?: number;
  rating?: number;
  author?: string;
}

export interface ShelfSnapshot {
  generatedAt: string;
  items: MediaItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMediaType(value: unknown): value is MediaType {
  return value === "film" || value === "book";
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseMediaItem(value: unknown): MediaItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const { title, type, imageUrl, url, date, year, rating, author } = value;

  if (
    typeof title !== "string" ||
    !isMediaType(type) ||
    typeof imageUrl !== "string" ||
    typeof url !== "string" ||
    typeof date !== "string"
  ) {
    return null;
  }

  return {
    title,
    type,
    imageUrl,
    url,
    date,
    year: optionalNumber(year),
    rating: optionalNumber(rating),
    author: optionalString(author),
  };
}

export function parseShelfSnapshot(value: unknown): ShelfSnapshot {
  if (!isRecord(value)) {
    return { generatedAt: new Date(0).toISOString(), items: [] };
  }

  const generatedAt =
    typeof value.generatedAt === "string"
      ? value.generatedAt
      : new Date(0).toISOString();
  const rawItems = Array.isArray(value.items) ? value.items : [];
  const items = rawItems
    .map((item) => parseMediaItem(item))
    .filter((item): item is MediaItem => item !== null)
    .sort(compareMediaItemsByDateDesc);

  return { generatedAt, items };
}

export function compareMediaItemsByDateDesc(
  left: MediaItem,
  right: MediaItem
): number {
  return new Date(right.date).getTime() - new Date(left.date).getTime();
}

export function selectRecentMedia(
  items: MediaItem[],
  filmCount: number,
  bookCount: number
): MediaItem[] {
  const films = items.filter((item) => item.type === "film").slice(0, filmCount);
  const books = items.filter((item) => item.type === "book").slice(0, bookCount);

  return [...films, ...books].sort(compareMediaItemsByDateDesc);
}
