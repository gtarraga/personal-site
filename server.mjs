import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import handler from "serve-handler";
import { refreshShelfFile } from "./scripts/shelf-data.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(rootDir, "dist");
const port = Number.parseInt(process.env.PORT || "8080", 10);

try {
  const snapshot = await refreshShelfFile(path.join(distDir, "shelf.json"));
  console.log(`shelf refreshed on boot: ${snapshot.items.length} items`);
} catch (error) {
  console.warn("shelf refresh failed on boot, using baked fallback", error);
}

http
  .createServer((request, response) =>
    handler(request, response, {
      public: distDir,
      cleanUrls: true,
    })
  )
  .listen(port, () => {
    console.log(`serving dist on ${port}`);
  });
