import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(currentDir, "../..");
const repoRoot = path.resolve(currentDir, "../../../..");

const envCandidates = [
  path.resolve(appRoot, ".env.local"),
  path.resolve(appRoot, ".env"),
  path.resolve(repoRoot, ".env.local"),
  path.resolve(repoRoot, ".env"),
];

for (const envPath of envCandidates) {
  if (!existsSync(envPath)) continue;
  dotenv.config({ path: envPath, override: false });
}
