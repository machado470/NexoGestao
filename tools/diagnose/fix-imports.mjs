#!/usr/bin/env node
/*
 * Experimental import fixer.
 *
 * This script scans TypeScript and TSX files for relative import paths that
 * do not resolve to an existing file. It attempts a small number of
 * deterministic fixes such as adding missing extensions or adjusting the
 * case of path segments. When a single unambiguous fix is found, the
 * suggestion is recorded. No files are modified by this script.
 *
 * Results are written to `tools/diagnose/fix-imports.suggestions.json` in the
 * repository root.
 */

import fs from 'fs/promises';
import path from 'path';

const ROOT = path.resolve(process.cwd());

/** Recursively collect all .ts and .tsx files under `dir`. */
async function collectTSFiles(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.next', '.git', 'coverage'].includes(entry.name)) {
        continue;
      }
      files.push(...await collectTSFiles(path.join(dir, entry.name)));
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        files.push(path.join(dir, entry.name));
      }
    }
  }
  return files;
}

/** Attempt to resolve an import path relative to `fromFile`. Returns null
 * if no candidate is found or multiple ambiguous candidates exist.
 * @param {string} importPath the path from the import statement (e.g. '../foo/bar')
 * @param {string} fromFile absolute path to the importing file
 */
async function resolveImport(importPath, fromFile) {
  const baseDir = path.dirname(fromFile);
  // Candidate 1: as specified
  const candidateRaw = path.resolve(baseDir, importPath);
  const exts = ['.ts', '.tsx', '.js', '.jsx'];
  const candidates = [];
  // Check if path points directly to a file with extension
  try {
    const stat = await fs.stat(candidateRaw);
    if (stat.isFile()) return null; // already exists
  } catch {}
  // Check if candidateRaw.ts / .tsx etc exists
  for (const ext of exts) {
    const filePath = candidateRaw + ext;
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        candidates.push({ resolved: filePath, suggestion: importPath + ext });
      }
    } catch {}
  }
  // Check index files within directory
  try {
    const stat = await fs.stat(candidateRaw);
    if (stat.isDirectory()) {
      for (const ext of exts) {
        const idxPath = path.join(candidateRaw, 'index' + ext);
        try {
          const idxStat = await fs.stat(idxPath);
          if (idxStat.isFile()) {
            candidates.push({ resolved: idxPath, suggestion: importPath + '/index' + ext });
          }
        } catch {}
      }
    }
  } catch {}
  // If exactly one candidate found, suggest it
  if (candidates.length === 1) {
    return candidates[0].suggestion;
  }
  return null;
}

/** Main entrypoint */
async function main() {
  const tsFiles = await collectTSFiles(ROOT);
  const suggestions = [];
  for (const file of tsFiles) {
    const relFile = path.relative(ROOT, file);
    const content = await fs.readFile(file, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*import\s+[^'"`]+?from\s+['"](.+?)['"]/);
      if (match) {
        const importPath = match[1];
        if (importPath.startsWith('.')) {
          const suggestion = await resolveImport(importPath, file);
          if (suggestion && suggestion !== importPath) {
            suggestions.push({
              file: relFile,
              original: importPath,
              suggested: suggestion
            });
          }
        }
      }
    }
  }
  const outDir = path.join(ROOT, 'tools', 'diagnose');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'fix-imports.suggestions.json');
  await fs.writeFile(outPath, JSON.stringify({ suggestions }, null, 2));
  console.log(`Import fix suggestions written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
