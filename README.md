# Personal Site

A personal website built with Astro. Definitely overkill for a simple HTML but I plan on adding more stuff here that justifies the framework.

## Goodreads shelf sync

Book membership, titles, authors, covers, and ratings come from Goodreads' public
`custom_widget` for the `site` shelf. Reading dates come from
`scripts/goodreads-books.json`, keyed by Goodreads review ID. The widget does not
provide reading dates, so these are verified against the signed-in Goodreads
shelf's **Date Read** column. Activity dates and date-added values are never used
as substitutes. A blank Date Read is recorded as `null` and omitted from the
rendered shelf, matching the old RSS behavior.

The Codex chat's six-hour automation checks the signed-in shelf in Orion. It must
load every row, confirm the loaded count matches the shelf count, and record
`[{"title":"Book title","dateRead":"2026-06-21"}]` in a scratch JSON file (`null`
for an explicitly blank Date Read). Then run:

```sh
node scripts/sync-goodreads-dates.mjs /absolute/path/to/readings.json
```

The command checks the complete input against the live public widget, validates
calendar dates, and updates the date manifest and baked fallback only when data
changes. Commit those two files, run the tests/build, publish the image, update
the pinned digest in the homelab deployment, and verify `/health/shelf`.

The public widget can remove books without a browser sync. New books require an
exact date from the browser sync before replacing the previous book snapshot.
Missing dates, malformed markup, or a potentially truncated widget produce an
unhealthy book source without blocking films. The monitor should report browser
sign-in/access failures when exact-date syncing cannot run. Exact-date changes
require Codex to be running with access to the signed-in browser; no Goodreads
account credentials are stored on the website server.
