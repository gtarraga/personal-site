import path from "node:path";
import { access, mkdir, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { refreshShelfFiles } from "./shelf-data.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const generatedPath = path.join(rootDir, "src", "generated", "shelf.json");
const publicPath = path.join(rootDir, "public", "shelf.json");

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonFile(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

try {
  const snapshot = await refreshShelfFiles([generatedPath, publicPath]);
  console.log(`shelf snapshot updated: ${snapshot.items.length} items`);
} catch (error) {
  console.error("shelf snapshot refresh failed", error);

  const generatedExists = await fileExists(generatedPath);
  const publicExists = await fileExists(publicPath);

  if (!generatedExists || !publicExists) {
    const emptySnapshot = { generatedAt: new Date().toISOString(), items: [] };

    if (!generatedExists) {
      await writeJsonFile(generatedPath, emptySnapshot);
    }

    if (!publicExists) {
      await writeJsonFile(publicPath, emptySnapshot);
    }
  }
}
