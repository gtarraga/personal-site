import shelfSnapshot from "../generated/shelf.json";
import {
  parseShelfSnapshot,
  selectRecentMedia,
  type MediaItem,
} from "./shelf-contract";

const snapshot = parseShelfSnapshot(shelfSnapshot);

export function getShelfItems(limit?: number): MediaItem[] {
  return limit ? snapshot.items.slice(0, limit) : snapshot.items;
}

export function getRecentMedia(
  filmCount: number,
  bookCount: number
): MediaItem[] {
  return selectRecentMedia(snapshot.items, filmCount, bookCount);
}
