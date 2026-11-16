import { copyFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// GitHub Pages serves the SPA fallback with HTTP 404 on direct route visits.
const output = path.resolve(process.argv[2] || fileURLToPath(new URL("../dist/public", import.meta.url)));
const base = process.env.VITE_BASE || "/";
if (!base.startsWith("/") || base.startsWith("//") || !base.endsWith("/")) {
  throw new Error("VITE_BASE must be an absolute pathname ending in /.");
}

const index = path.join(output, "index.html");
const html = readFileSync(index, "utf8");
const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)];
if (!assets.length) throw new Error("No JavaScript or CSS assets found in index.html.");
for (const [, url] of assets) {
  if (!url.startsWith(base) || url.startsWith("//")) {
    throw new Error(`Asset outside VITE_BASE ${base}: ${url}`);
  }
  const local = path.resolve(output, decodeURIComponent(url.slice(base.length)));
  if (!local.startsWith(output + path.sep) || !existsSync(local)) {
    throw new Error(`Missing or invalid asset: ${url}`);
  }
}
copyFileSync(index, path.join(output, "404.html"));
console.log(`Validated ${assets.length} assets under ${base}; SPA fallback created.`);
