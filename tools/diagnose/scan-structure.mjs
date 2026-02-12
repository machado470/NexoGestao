#!/usr/bin/env node
/*
 * Simple repository scanner used during diagnostic setup.
 *
 * This script walks the working directory (assumed to be the repository root)
 * and produces a report of potential structural issues. It is intentionally
 * conservative: it does not mutate any files and only reports what it
 * observes. The resulting JSON report is written to
 * `tools/diagnose/scan-structure.report.json`.
 *
 * Features:
 *  - Recursively lists all files/directories, ignoring common build outputs.
 *  - Detects potential name collisions by normalising names (case‑insensitive
 *    and stripping spaces, hyphens and underscores) and listing all paths
 *    that normalise to the same key.
 *  - Flags likely mislocated frontend/back‑end files, such as `.tsx` files
 *    living under `apps/api` and NestJS source under `apps/web`.
 *  - Identifies `package.json` files with no dependencies or no scripts as
 *    “orphans” for further review.
 *  - Verifies `tsconfig.json` references point to existing files and
 *    highlights broken references.
 */
import fs from 'fs/promises';
import path from 'path';
// Root of the repository – assume this script is executed from within
// the repository. Resolve to absolute path to avoid surprises.
const ROOT = path.resolve(process.cwd());
// Directories to skip entirely during traversal. These are common build
// outputs or caches that do not need scanning.
const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.git',
  'coverage'
]);
/** Normalise a file or directory name. Lowercases the input and removes
 * spaces, hyphens and underscores to make it easier to spot collisions on
 * case‑insensitive file systems.
 * @param {string} name
 * @returns {string}
 */
function normaliseName(name) {
  return name.toLowerCase().replace(/[\s_\-]/g, '');
}
// Data structures to collect findings
const nameMap = new Map();      // normalisedName -> list of relative paths
const mislocated = [];           // list of objects describing misplaced files
const orphanPackages = [];       // list of package.json files lacking deps/scripts
const tsconfigIssues = [];       // list of tsconfig reference problems
/** Recursively walk the directory tree starting at `dir`.
 * Populates the global data structures defined above.
 * @param {string} dir absolute path to directory
 */
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const { name } = entry;
    // Skip ignored directories entirely
    if (entry.isDirectory() && IGNORE_DIRS.has(name)) {
      continue;
    }
    const fullPath = path.join(dir, name);
    const relPath = path.relative(ROOT, fullPath);
    // Record normalised name for collision detection
    const key = normaliseName(name);
    if (!nameMap.has(key)) nameMap.set(key, []);
    nameMap.get(key).push(relPath);
    if (entry.isDirectory()) {
      await walk(fullPath);
    } else {
      // Detect mislocated files
      if (relPath.startsWith('apps/api') && name.endsWith('.tsx')) {
        mislocated.push({
          reason: 'TSX file in backend',
          file: relPath
        });
      }
      if (relPath.startsWith('apps/web') && name.endsWith('.ts')) {
        // Attempt to read the file to check for NestJS imports. If the file
        // cannot be read, ignore the error – there may be binary files with
        // a .ts extension (unlikely but safe to handle gracefully).
        try {
          const content = await fs.readFile(fullPath, 'utf8');
          // Precompile regex outside of literal context to avoid escaping issues.
          const nestImportPattern = /['"]@nestjs\//;
          if (nestImportPattern.test(content) || /@Controller/.test(content) || /@Module/.test(content)) {
            mislocated.push({
              reason: 'NestJS code in frontend',
              file: relPath
            });
          }
        } catch {
          /* ignore */
        }
      }
      // Identify orphan package.json files
      if (name === 'package.json') {
        try {
          const pkg = JSON.parse(await fs.readFile(fullPath, 'utf8'));
          const depCount = Object.keys(pkg.dependencies || {}).length;
          const devDepCount = Object.keys(pkg.devDependencies || {}).length;
          const scriptCount = Object.keys(pkg.scripts || {}).length;
          if (depCount + devDepCount === 0 || scriptCount === 0) {
            orphanPackages.push({
              file: relPath,
              dependencies: depCount + devDepCount,
              scripts: scriptCount
            });
          }
        } catch {
          // Malformed JSON should be reported as orphaned
          orphanPackages.push({
            file: relPath,
            error: 'Malformed package.json'
          });
        }
      }
      // Check tsconfig references
      if (/^tsconfig.*\.json$/.test(name)) {
        try {
          const config = JSON.parse(await fs.readFile(fullPath, 'utf8'));
          if (Array.isArray(config.references)) {
            for (const ref of config.references) {
              const refPath = ref && ref.path;
              if (typeof refPath === 'string') {
                // Resolve relative to the tsconfig's directory
                const refFull = path.resolve(path.dirname(fullPath), refPath);
                try {
                  // We expect the reference target to exist (file or directory)
                  await fs.stat(refFull);
                } catch {
                  tsconfigIssues.push({
                    file: relPath,
                    missingReference: refPath
                  });
                }
              }
            }
          }
        } catch {
          // ignore malformed tsconfig
        }
      }
    }
  }
}
async function main() {
  await walk(ROOT);
  // Collect collisions where more than one path maps to the same normalised name
  const collisions = [];
  for (const [norm, paths] of nameMap.entries()) {
    if (paths.length > 1) {
      collisions.push({ normalised: norm, paths });
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    collisions,
    mislocated,
    orphanPackages,
    tsconfigIssues
  };
  const reportDir = path.join(ROOT, 'tools', 'diagnose');
  await fs.mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'scan-structure.report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report written to ${reportPath}`);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
