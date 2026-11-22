import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

/**
 * C8 PR1 — guard against reusing client-controlled forwarding headers.
 *
 * X-Forwarded-For, X-Real-IP and Forwarded can be set by the client. The BFF keeps the NO_TRUST
 * policy: only `_core/clientIp.ts` may observe them (diagnostics, aggregated counters, consent with
 * `ip: null`). Legacy modules that keyed rate limits and audit records on the raw
 * X-Forwarded-For were removed; this test fails if such a read comes back anywhere else, in the
 * source tree or in the real production bundle.
 */

const WEB_ROOT = resolve(__dirname, "..");
const SERVER_DIR = resolve(WEB_ROOT, "server");
/** The only server module allowed to read forwarding headers (paths relative to apps/web). */
const ALLOWED = new Set(["server/_core/clientIp.ts"]);
const LEGACY = ["server/_core/rateLimit.ts", "server/_core/audit.ts", "server/_core/security.ts"];

const HEADER = String.raw`(?:x-forwarded-for|x-real-ip|forwarded)`;
const Q = String.raw`["'\x60]`;
/** Patterns of a header *read*. Exact header names, so X-Forwarded-Proto/Host do not match. */
const RAW_READ_PATTERNS: RegExp[] = [
  new RegExp(String.raw`headers\s*\??\.?\s*\[\s*${Q}${HEADER}${Q}\s*\]`, "i"), // headers["x-forwarded-for"]
  new RegExp(String.raw`headers\s*\??\.\s*forwarded\b`, "i"), // headers.forwarded
  new RegExp(String.raw`\.\s*(?:get|header|getHeader)\s*\(\s*${Q}${HEADER}${Q}`, "i"), // req.get("x-real-ip")
  new RegExp(String.raw`headerLines\s*\(\s*[\w.?]+\s*,\s*${Q}${HEADER}${Q}`, "i"), // clientIp helper
  /\breq(?:uest)?\s*\??\.\s*ips\b/, // Express trusted-proxy chain
];
const TRUST_PROXY = /\.set\s*\(\s*["'`]trust proxy["'`]/i;

/** Drops comments so documentation that names the headers is not reported as a read. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

function findRawForwardedReads(source: string): string[] {
  const code = stripComments(source);
  return RAW_READ_PATTERNS.flatMap((pattern) => {
    const match = code.match(pattern);
    return match ? [match[0]] : [];
  });
}

function serverSourceFiles(dir = SERVER_DIR): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : serverSourceFiles(path);
    return /\.(ts|tsx|js|mjs|cjs)$/.test(name) && !/\.(test|spec)\./.test(name) ? [path] : [];
  });
}

const rel = (path: string) => relative(WEB_ROOT, path).split("\\").join("/");

describe("forwarded headers are only observed by clientIp.ts (NO_TRUST)", () => {
  it("the detector recognises raw reads and ignores comments and other X-Forwarded-* headers", () => {
    for (const sample of [
      `const ip = req.headers["x-forwarded-for"]`,
      `ctx.req?.headers['X-Real-IP']`,
      "req.headers[`forwarded`]",
      `const f = req.headers.forwarded`,
      `req.get("x-forwarded-for")`,
      `res.getHeader('X-Real-IP')`,
      `headerLines(req, "x-real-ip")`,
      `const chain = req.ips`,
      // Exactly what the removed legacy modules did:
      `const ip = context.req?.headers["x-forwarded-for"] || context.req?.socket?.remoteAddress || "unknown";`,
      `ip: ctx.req?.headers["x-forwarded-for"] as string | undefined,`,
    ]) {
      expect(findRawForwardedReads(sample), sample).not.toEqual([]);
    }
    for (const sample of [
      `// the first X-Forwarded-For value is never used`,
      `/* headers["x-forwarded-for"] */`,
      `req.headers["x-forwarded-proto"] === "https"`,
      `req.get("x-forwarded-host")`,
      `const ip = req.ip`,
    ]) {
      expect(findRawForwardedReads(sample), sample).toEqual([]);
    }
  });

  it("no server source file outside the allowlist reads forwarding headers", () => {
    const offenders = serverSourceFiles()
      .map((path) => ({ file: rel(path), reads: findRawForwardedReads(readFileSync(path, "utf8")) }))
      .filter(({ file, reads }) => reads.length > 0 && !ALLOWED.has(file));
    expect(offenders, "Use _core/clientIp.ts (NO_TRUST) instead of reading forwarding headers directly").toEqual([]);
    // The allowed module really is the one doing the observation.
    expect(findRawForwardedReads(readFileSync(resolve(WEB_ROOT, "server/_core/clientIp.ts"), "utf8"))).not.toEqual([]);
  });

  it("the BFF never enables Express trust proxy", () => {
    const offenders = serverSourceFiles().filter((path) => TRUST_PROXY.test(stripComments(readFileSync(path, "utf8")))).map(rel);
    expect(offenders).toEqual([]);
  });

  it("the production bundle contains no other reader and none of the removed legacy modules", async () => {
    // Same entry as the package `build` script, so the check follows the real production bundle.
    const buildScript: string = JSON.parse(readFileSync(resolve(WEB_ROOT, "package.json"), "utf8")).scripts.build;
    const entry = buildScript.match(/esbuild\s+(\S+\.ts)/)?.[1];
    expect(entry, "entry of the esbuild step in the build script").toBeTruthy();
    const result = await build({
      absWorkingDir: WEB_ROOT,
      entryPoints: [entry!],
      bundle: true,
      platform: "node",
      packages: "external",
      format: "esm",
      write: false,
      metafile: true,
      logLevel: "silent",
      outdir: "dist-guard-test",
      define: { "process.env.NODE_ENV": '"production"' },
    });
    const inputs = Object.keys(result.metafile!.inputs);
    expect(inputs).toContain("server/_core/clientIp.ts");
    for (const legacy of LEGACY) expect(inputs).not.toContain(legacy);
    const offenders = inputs
      .filter((file) => !file.includes("node_modules") && !ALLOWED.has(file))
      .filter((file) => findRawForwardedReads(readFileSync(resolve(WEB_ROOT, file), "utf8")).length > 0);
    expect(offenders).toEqual([]);
  }, 60_000);
});
