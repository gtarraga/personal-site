import http from "node:http";
import { readFile } from "node:fs/promises";
import { shelfHealth } from "./scripts/shelf-health.mjs";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import handler from "serve-handler";
import { refreshShelfFiles } from "./scripts/shelf-data.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(rootDir, "dist");
const port = Number.parseInt(process.env.PORT || "8080", 10);
const shelfDataPath = process.env.SHELF_DATA_PATH || path.join(rootDir, "data", "shelf.json");
const SHELF_REFRESH_MS = 24 * 60 * 60 * 1000;

const POSTHOG_ASSETS_HOST = "https://eu-assets.i.posthog.com";
const POSTHOG_API_HOST = "https://eu.i.posthog.com";
const PROXY_TIMEOUT_MS = 8000;
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

async function refreshShelf() {
  try {
    const snapshot = await refreshShelfFiles([shelfDataPath, path.join(distDir, "shelf.json")]);
    console.log(`shelf refreshed: ${snapshot.items.length} items`);
  } catch (error) {
    console.warn("shelf refresh failed, using previous snapshot", error);
  }
}

await refreshShelf();
setInterval(refreshShelf, SHELF_REFRESH_MS).unref();

async function proxyRelay(request, response) {
  const url = request.url ?? "/";
  const target = url.startsWith("/relay/static/")
    ? `${POSTHOG_ASSETS_HOST}/static/${url.slice("/relay/static/".length)}`
    : `${POSTHOG_API_HOST}/${url.slice("/relay/".length)}`;

  const upstreamHeaders = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) continue;
    if (Array.isArray(value)) {
      for (const v of value) upstreamHeaders.append(name, v);
    } else {
      upstreamHeaders.set(name, value);
    }
  }

  const init = {
    method: request.method,
    headers: upstreamHeaders,
    signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await readRequestBody(request);
    if (body.length > 0) init.body = body;
  }

  try {
    const upstream = await fetch(target, init);
    const responseHeaders = [];
    upstream.headers.forEach((value, name) => {
      if (name === "content-encoding" || name === "content-length" || name === "transfer-encoding") return;
      responseHeaders.push([name, value]);
    });
    response.writeHead(upstream.status, responseHeaders);

    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(response);
    } else {
      response.end();
    }
  } catch (error) {
    console.error("PostHog relay proxy error:", error);
    if (!response.headersSent) {
      response.writeHead(502, { "content-type": "text/plain" });
    }
    response.end("Proxy error");
  }
}

http
  .createServer((request, response) => {
    if (request.url?.split("?")[0] === "/health/shelf") {
      readFile(path.join(distDir, "shelf.json"), "utf8")
        .then((content) => shelfHealth(JSON.parse(content)))
        .catch(() => ({ ok: false, errors: [{ message: "shelf snapshot unavailable" }] }))
        .then((health) => {
          response.writeHead(health.ok ? 200 : 503, {
            "content-type": "application/json",
            "cache-control": "no-store",
          });
          response.end(JSON.stringify(health));
        });
      return;
    }
    if (request.url?.startsWith("/relay/")) {
      proxyRelay(request, response);
      return;
    }
    handler(request, response, {
      public: distDir,
      cleanUrls: true,
    });
  })
  .listen(port, () => {
    console.log(`serving dist on ${port}`);
  });
