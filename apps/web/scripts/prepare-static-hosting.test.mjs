import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./prepare-static-hosting.mjs", import.meta.url));
function fixture(run) {
  const dir = mkdtempSync(path.join(tmpdir(), "nexo-static-"));
  try {
    mkdirSync(path.join(dir, "assets"));
    writeFileSync(path.join(dir, "assets/app.js"), "console.log('loaded');");
    writeFileSync(path.join(dir, "assets/app.css"), "body{margin:0}");
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const build = (dir, base) => spawnSync(process.execPath, [script, dir], {
  env: { ...process.env, VITE_BASE: base }, encoding: "utf8",
});

for (const base of ["/", "/NexoGestao/"]) {
  test(`validates assets and preserves the entry document for direct routes at ${base}`, () => fixture(dir => {
    const html = `<script src="${base}assets/app.js"></script><link href="${base}assets/app.css">`;
    writeFileSync(path.join(dir, "index.html"), html);
    assert.equal(build(dir, base).status, 0);
    assert.equal(readFileSync(path.join(dir, "404.html"), "utf8"), html);
  }));
}
test("rejects the root asset URLs that produce a blank project Pages site", () => fixture(dir => {
  writeFileSync(path.join(dir, "index.html"), '<script src="/assets/app.js"></script>');
  const result = build(dir, "/NexoGestao/");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Asset outside VITE_BASE/);
  assert.equal(existsSync(path.join(dir, "404.html")), false);
}));
test("rejects a missing emitted asset before publishing a fallback", () => fixture(dir => {
  writeFileSync(path.join(dir, "index.html"), '<script src="/NexoGestao/assets/missing.js"></script>');
  assert.notEqual(build(dir, "/NexoGestao/").status, 0);
  assert.equal(existsSync(path.join(dir, "404.html")), false);
}));
