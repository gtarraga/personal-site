# Personal Site

A personal website built with Astro. Definitely overkill for a simple HTML but I plan on adding more stuff here that justifies the framework.

## Goodreads shelf sync

Book membership, titles, authors, covers, and ratings come from Goodreads' public
`custom_widget` for the `site` shelf. The Node server refreshes the shelf on
startup and every 24 hours, including Letterboxd. No login, browser automation,
Codex, Orion, or additional service is needed. Pages keep using the small local
`/shelf.json` snapshot; visitors never request Goodreads directly.

The widget does not expose reading dates. Existing dates and publication years
are preserved, with `scripts/goodreads-books.json` retained only as a historical
seed. New books use the UTC day they are first observed, not an exact Date Read.
That date stays fixed on subsequent refreshes, even if the title or rating changes.
Books first observed on the same day keep the widget's relative order. Adding an
older book to the `site` shelf will therefore make it appear recent. Books without
a Goodreads Date Read are now included too.

The last snapshot is saved atomically to `data/shelf.json` (override with
`SHELF_DATA_PATH`) and copied to `dist/shelf.json` for serving. **Mount a named
volume or persistent directory at `/app/data` in Docker** so first-seen dates
survive container replacement, not just process restarts. For example, add this
to the existing Compose service and top-level volumes:

```yaml copy Copy Volume Configuration
services:
  website:
    # Keep the existing image, ports, and other settings.
    volumes:
      - shelf-data:/app/data

volumes:
  shelf-data:
```

On the first run, the server seeds its state from the built snapshot or baked
fallback. Removed books disappear on the next successful refresh. Failed fetches,
malformed markup, or a potentially truncated widget retain the previous books
without blocking film updates; `/health/shelf` reports errors and stale sources.
The old Codex/Orion automation can be disabled; no manual date-sync step remains.
