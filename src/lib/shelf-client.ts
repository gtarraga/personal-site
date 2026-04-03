import {
  parseShelfSnapshot,
  selectRecentMedia,
  type MediaItem,
} from "./shelf-contract";

const shelfUrl = "/shelf.json";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderHomeItem(item: MediaItem): string {
  return `
    <a href="${escapeHtml(item.url)}" target="_blank" class="media-item media-${escapeHtml(item.type)}">
      <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" />
    </a>
  `;
}

function renderShelfItem(item: MediaItem): string {
  const year = item.year ? `<span class="shelf-item-year">${item.year}</span>` : "";

  return `
    <a href="${escapeHtml(item.url)}" target="_blank" class="shelf-item media-${escapeHtml(item.type)}" data-type="${escapeHtml(item.type)}">
      <div class="shelf-item-cover">
        <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" />
      </div>
      <div class="shelf-item-info">
        <span class="shelf-item-title">${escapeHtml(item.title)}</span>
        ${year}
      </div>
    </a>
  `;
}

async function loadShelf() {
  const response = await fetch(shelfUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`shelf fetch failed: ${response.status}`);
  }

  return parseShelfSnapshot(await response.json());
}

function updateHome(items: MediaItem[]): void {
  const grid = document.querySelector("[data-shelf-home]");

  if (!(grid instanceof HTMLElement)) {
    return;
  }

  const filmCount = Number.parseInt(grid.dataset.filmCount || "2", 10);
  const bookCount = Number.parseInt(grid.dataset.bookCount || "2", 10);
  const recentItems = selectRecentMedia(items, filmCount, bookCount);

  grid.innerHTML = recentItems.map(renderHomeItem).join("");
}

function updateShelfPage(items: MediaItem[]): void {
  const grid = document.querySelector("[data-shelf-page]");

  if (!(grid instanceof HTMLElement)) {
    return;
  }

  grid.innerHTML = items.map(renderShelfItem).join("");
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
