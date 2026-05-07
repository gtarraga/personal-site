import {
  parseShelfSnapshot,
  selectRecentMedia,
  type MediaItem,
} from "./shelf-contract";

const shelfUrl = "/shelf.json";

function createMediaItem(item: MediaItem): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = item.url;
  link.target = "_blank";
  link.className = `media-item media-${item.type}`;

  const img = document.createElement("img");
  img.src = item.imageUrl;
  img.alt = item.title;
  link.appendChild(img);

  return link;
}

function createShelfItem(item: MediaItem): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = item.url;
  link.target = "_blank";
  link.className = `shelf-item media-${item.type}`;
  link.dataset.type = item.type;

  const cover = document.createElement("div");
  cover.className = "shelf-item-cover";
  const img = document.createElement("img");
  img.src = item.imageUrl;
  img.alt = item.title;
  cover.appendChild(img);

  const info = document.createElement("div");
  info.className = "shelf-item-info";
  const title = document.createElement("span");
  title.className = "shelf-item-title";
  title.textContent = item.title;
  info.appendChild(title);

  if (item.year) {
    const year = document.createElement("span");
    year.className = "shelf-item-year";
    year.textContent = String(item.year);
    info.appendChild(year);
  }

  link.appendChild(cover);
  link.appendChild(info);

  return link;
}

async function loadShelf() {
  const response = await fetch(shelfUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`shelf fetch failed: ${response.status}`);
  }

  return parseShelfSnapshot(await response.json());
}

function replaceChildren(grid: HTMLElement, children: HTMLElement[]): void {
  grid.replaceChildren(...children);
}

function updateHome(items: MediaItem[]): void {
  const grid = document.querySelector("[data-shelf-home]");

  if (!(grid instanceof HTMLElement)) {
    return;
  }

  const filmCount = Number.parseInt(grid.dataset.filmCount || "2", 10);
  const bookCount = Number.parseInt(grid.dataset.bookCount || "2", 10);
  const recentItems = selectRecentMedia(items, filmCount, bookCount);

  replaceChildren(grid, recentItems.map(createMediaItem));
}

function updateShelfPage(items: MediaItem[]): void {
  const grid = document.querySelector("[data-shelf-page]");

  if (!(grid instanceof HTMLElement)) {
    return;
  }

  replaceChildren(grid, items.map(createShelfItem));
  document.dispatchEvent(new Event("shelf:updated"));
}

export function hydrateShelf(): void {
  loadShelf()
    .then((snapshot) => {
      updateHome(snapshot.items);
      updateShelfPage(snapshot.items);
    })
    .catch((error: unknown) => {
      console.warn("shelf refresh skipped", error);
    });
}
