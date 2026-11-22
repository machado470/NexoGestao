/**
 * C8 PR2 — static BFF → API contract analysis (test support only; never imported by the app).
 *
 * Reads the NestJS controllers of apps/api and the HTTP calls of the web BFF with the TypeScript
 * syntax tree (no type checker, no execution) and reports:
 * - calls without a matching API route or with the wrong HTTP method;
 * - public BFF calls to JWT-protected routes, calls to routes without an access declaration and
 *   API routes that declare neither a JWT guard nor @Public();
 * - body fields the BFF sends that the target DTO class does not whitelist (the API runs a global
 *   ValidationPipe with whitelist + forbidNonWhitelisted, so such a field is a 400);
 * - anything it cannot resolve (paths, bodies, DTOs, fetch targets). Nothing is skipped silently:
 *   every unresolved item is a finding that must be fixed or listed as a justified exception.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

// ---------------------------------------------------------------------------------------------
// Types

export type SourceInput = { path: string; text: string };
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "ALL" | "HEAD" | "OPTIONS";
export type Access = "jwt" | "public" | "undeclared";
export type BodySpec =
  | { kind: "class"; name: string; file: string }
  | { kind: "field"; field: string }
  | { kind: "unvalidated"; text: string };

export type ApiRoute = {
  method: HttpMethod;
  /** Path without the global prefix, with `:params`. */
  path: string;
  controller: string;
  file: string;
  line: number;
  access: Access;
  body: BodySpec | null;
};

export type SentBody = { keys: string[]; unresolved: string[] };

export type BffCall = {
  method: string;
  /** Resolved path (`:param` for dynamic segments, query removed) or null when unresolved. */
  path: string | null;
  file: string;
  line: number;
  /** Stable owner name: `router.procedure`, function or variable chain. */
  fn: string;
  transport: string;
  isPublic: boolean;
  sendsAuthorization: boolean;
  body: SentBody | null;
  via?: string;
  unresolvedReason?: string;
};

export type FindingKind =
  | "NO_ROUTE"
  | "WRONG_METHOD"
  | "UNRESOLVED_PATH"
  | "EXTERNAL_FETCH"
  | "PUBLIC_CALL_TO_PROTECTED_ROUTE"
  | "CALL_TO_UNDECLARED_ACCESS_ROUTE"
  | "ROUTE_WITHOUT_ACCESS_DECLARATION"
  | "BODY_FIELD_NOT_IN_DTO"
  | "BODY_UNRESOLVED"
  | "DTO_UNRESOLVED";

export type Finding = {
  kind: FindingKind;
  file: string;
  line: number;
  fn?: string;
  /** `METHOD /path` of the API route involved (or of the call when no route exists). */
  route?: string;
  field?: string;
  detail: string;
};

export type ContractException = {
  kind: FindingKind;
  file: string;
  fn?: string;
  route?: string;
  field?: string;
  reason: string;
};

export type ContractReport = { routes: ApiRoute[]; calls: BffCall[]; findings: Finding[] };

// ---------------------------------------------------------------------------------------------
// Source loading

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const WEB_ROOT = resolve(REPO_ROOT, "apps/web");

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" || name === "dist" ? [] : walk(path);
    return /\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
  });
}

const toInput = (path: string): SourceInput => ({
  path: relative(REPO_ROOT, path).split("\\").join("/"),
  text: readFileSync(path, "utf8"),
});

export function loadRepositorySources() {
  return {
    api: walk(join(REPO_ROOT, "apps/api/src")).map(toInput),
    // Calls are discovered in server/; shared/ is loaded so imported zod schemas resolve.
    web: [...walk(join(WEB_ROOT, "server")), ...walk(join(WEB_ROOT, "shared"))]
      .filter((path) => !path.includes(`${join("server", "__contract__")}`))
      .map(toInput),
  };
}

/** Global prefix of the API (`app.setGlobalPrefix`) and the prefix the BFF appends to NEXO_API_URL. */
export function readPrefixes() {
  const main = readFileSync(join(REPO_ROOT, "apps/api/src/main.ts"), "utf8");
  const apiUrl = readFileSync(join(WEB_ROOT, "server/_core/nexoApiUrl.ts"), "utf8");
  return {
    api: main.match(/setGlobalPrefix\(\s*["'`]([^"'`]+)["'`]/)?.[1] ?? null,
    bff: apiUrl.match(/API_PREFIX\s*=\s*["'`]\/?([^"'`]+)["'`]/)?.[1] ?? null,
  };
}

// ---------------------------------------------------------------------------------------------
// Shared syntax helpers

class Program {
  readonly files = new Map<string, ts.SourceFile>();
  constructor(inputs: SourceInput[]) {
    for (const input of inputs) {
      this.files.set(input.path, ts.createSourceFile(input.path, input.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS));
    }
  }

  /** Resolves a relative or `@shared/` import specifier to a loaded file path. */
  resolveModule(fromFile: string, specifier: string): string | null {
    let base: string;
    if (specifier.startsWith(".")) base = join(dirname(fromFile), specifier);
    else if (specifier.startsWith("@shared/")) base = join("apps/web/shared", specifier.slice("@shared/".length));
    else return null;
    base = base.split("\\").join("/");
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
      if (this.files.has(candidate)) return candidate;
    }
    return null;
  }

  /** Top-level declaration (variable initializer or class) named `name` in `file`, following re-exports. */
  findTopLevel(file: string, name: string, depth = 0): { node: ts.Node; file: string } | null {
    const sf = this.files.get(file);
    if (!sf || depth > 5) return null;
    for (const st of sf.statements) {
      if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.name.text === name && d.initializer) return { node: d.initializer, file };
        }
      }
      if ((ts.isClassDeclaration(st) || ts.isFunctionDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) && st.name?.text === name) return { node: st, file };
      if (ts.isImportDeclaration(st) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings)) {
        const el = st.importClause.namedBindings.elements.find((e) => e.name.text === name);
        if (el && ts.isStringLiteral(st.moduleSpecifier)) {
          const target = this.resolveModule(file, st.moduleSpecifier.text);
          if (target) return this.findTopLevel(target, (el.propertyName ?? el.name).text, depth + 1);
        }
      }
      if (ts.isExportDeclaration(st) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
        const target = this.resolveModule(file, st.moduleSpecifier.text);
        const named = st.exportClause && ts.isNamedExports(st.exportClause) ? st.exportClause.elements.find((e) => e.name.text === name) : null;
        if (target && (named || !st.exportClause)) {
          const found = this.findTopLevel(target, named ? (named.propertyName ?? named.name).text : name, depth + 1);
          if (found) return found;
        }
      }
    }
    return null;
  }
}

const lineOf = (node: ts.Node) => node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;
const decoratorsOf = (node: ts.Node) => (ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : []);
const decoratorName = (d: ts.Decorator) => (ts.isCallExpression(d.expression) ? d.expression.expression.getText() : d.expression.getText());
const decoratorArgs = (d: ts.Decorator) => (ts.isCallExpression(d.expression) ? d.expression.arguments : ts.factory.createNodeArray<ts.Expression>());
const stripParens = (e: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e) || ts.isAwaitExpression(e)
    ? stripParens(e.expression)
    : e;

/** Finds the declaration of `name` visible from `from`: variables, destructured bindings, parameters. */
function findBinding(from: ts.Node, name: string): ts.VariableDeclaration | ts.ParameterDeclaration | ts.BindingElement | null {
  const inPattern = (pattern: ts.BindingName): ts.BindingElement | null => {
    if (ts.isIdentifier(pattern)) return null;
    for (const el of pattern.elements) {
      if (ts.isOmittedExpression(el)) continue;
      if (ts.isIdentifier(el.name) && el.name.text === name) return el;
      const nested = inPattern(el.name);
      if (nested) return nested;
    }
    return null;
  };
  for (let node: ts.Node | undefined = from.parent; node; node = node.parent) {
    if (ts.isFunctionLike(node)) {
      for (const p of node.parameters) {
        if (ts.isIdentifier(p.name) && p.name.text === name) return p;
        const el = inPattern(p.name);
        if (el) return el;
      }
    }
    const statements = (node as { statements?: ts.NodeArray<ts.Statement> }).statements;
    if (statements) {
      for (const st of statements) {
        if (!ts.isVariableStatement(st)) continue;
        for (const d of st.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.name.text === name) return d;
          const el = inPattern(d.name);
          if (el) return el;
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// API discovery

const HTTP_DECORATORS: Record<string, HttpMethod> = {
  Get: "GET", Post: "POST", Put: "PUT", Patch: "PATCH", Delete: "DELETE", All: "ALL", Head: "HEAD", Options: "OPTIONS",
};
/** Decorators that do NOT register class-validator metadata (so they do not whitelist a property). */
const NON_VALIDATING_DECORATORS = new Set(["ApiProperty", "ApiPropertyOptional", "ApiHideProperty", "Transform", "Type", "Expose", "Exclude"]);

function stringValues(arg: ts.Expression | undefined): string[] | null {
  if (!arg) return [""];
  const e = stripParens(arg);
  if (ts.isStringLiteralLike(e)) return [e.text];
  if (ts.isArrayLiteralExpression(e)) {
    const all = e.elements.map((x) => stringValues(x as ts.Expression));
    return all.some((x) => x === null) ? null : all.flat() as string[];
  }
  if (ts.isObjectLiteralExpression(e)) {
    const p = e.properties.find((x) => x.name?.getText() === "path");
    return p && ts.isPropertyAssignment(p) ? stringValues(p.initializer) : [""];
  }
  return null;
}

const joinPath = (...parts: string[]) => "/" + parts.map((p) => p.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");

function accessOf(decorators: readonly ts.Decorator[]): { jwt: boolean; isPublic: boolean } {
  const isPublic = decorators.some((d) => decoratorName(d) === "Public");
  const jwt = decorators
    .filter((d) => decoratorName(d) === "UseGuards")
    .some((d) => decoratorArgs(d).some((a) => /\bJwtAuthGuard\b|AuthGuard\(\s*["']jwt["']\s*\)/.test(a.getText())));
  return { jwt, isPublic };
}

function bodySpecOf(param: ts.ParameterDeclaration, file: string): BodySpec {
  const deco = decoratorsOf(param).find((d) => decoratorName(d) === "Body")!;
  const first = decoratorArgs(deco)[0];
  if (first && ts.isStringLiteralLike(first)) return { kind: "field", field: first.text };
  const type = param.type;
  if (type && ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) && !type.typeArguments) {
    return { kind: "class", name: type.typeName.text, file };
  }
  return { kind: "unvalidated", text: type ? type.getText().slice(0, 60) : "untyped" };
}

export function discoverApiRoutes(program: Program, onFinding: (f: Finding) => void): ApiRoute[] {
  const routes: ApiRoute[] = [];
  for (const [file, sf] of program.files) {
    if (!file.startsWith("apps/api/")) continue;
    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node)) {
        const ctrl = decoratorsOf(node).find((d) => decoratorName(d) === "Controller");
        if (ctrl) {
          const prefixes = stringValues(decoratorArgs(ctrl)[0]);
          const classAccess = accessOf(decoratorsOf(node));
          for (const member of node.members) {
            if (!ts.isMethodDeclaration(member)) continue;
            const decos = decoratorsOf(member);
            for (const hd of decos.filter((d) => HTTP_DECORATORS[decoratorName(d)])) {
              const subs = stringValues(decoratorArgs(hd)[0]);
              if (!prefixes || !subs) {
                onFinding({ kind: "UNRESOLVED_PATH", file, line: lineOf(member), fn: `${node.name?.text}.${member.name.getText()}`, detail: "rota da API com caminho não literal" });
                continue;
              }
              const own = accessOf(decos);
              const access: Access = classAccess.isPublic || own.isPublic ? "public" : classAccess.jwt || own.jwt ? "jwt" : "undeclared";
              const bodyParam = member.parameters.find((p) => decoratorsOf(p).some((d) => decoratorName(d) === "Body"));
              for (const prefix of prefixes) {
                for (const sub of subs) {
                  routes.push({
                    method: HTTP_DECORATORS[decoratorName(hd)],
                    path: joinPath(prefix, sub),
                    controller: node.name?.text ?? "(anônimo)",
                    file,
                    line: lineOf(member),
                    access,
                    body: bodyParam ? bodySpecOf(bodyParam, file) : null,
                  });
                }
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return routes;
}

/** `class` for DTO classes, `type` for interfaces/aliases/enums (no validation), `unknown` when not found. */
export function dtoKind(program: Program, file: string, name: string): "class" | "type" | "unknown" {
  const found = program.findTopLevel(file, name);
  if (!found) return "unknown";
  return ts.isClassDeclaration(found.node) ? "class" : ts.isInterfaceDeclaration(found.node) || ts.isTypeAliasDeclaration(found.node) || ts.isEnumDeclaration(found.node) ? "type" : "unknown";
}

/** Whitelisted properties of a DTO class (validation decorators), following mapped-type helpers. */
export function dtoWhitelist(program: Program, file: string, name: string, depth = 0): string[] | null {
  if (depth > 8) return null;
  const found = program.findTopLevel(file, name);
  if (!found || !ts.isClassDeclaration(found.node)) return null;
  const cls = found.node;
  const own = cls.members
    .filter(ts.isPropertyDeclaration)
    .filter((p) => !p.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword))
    .filter((p) => decoratorsOf(p).some((d) => !NON_VALIDATING_DECORATORS.has(decoratorName(d))))
    .map((p) => p.name.getText());
  const ext = cls.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression;
  if (!ext) return own;
  const inherited = mappedType(program, found.file, ext, depth + 1);
  return inherited === null ? null : [...new Set([...inherited, ...own])];
}

function mappedType(program: Program, file: string, expr: ts.Expression, depth: number): string[] | null {
  const e = stripParens(expr);
  if (ts.isIdentifier(e)) return dtoWhitelist(program, file, e.text, depth);
  if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) {
    const [first, second] = e.arguments;
    const keysOf = (arg: ts.Expression | undefined) => {
      const values = arg ? stringValues(arg) : null;
      return values ?? null;
    };
    switch (e.expression.text) {
      case "PartialType":
        return first ? mappedType(program, file, first, depth) : null;
      case "OmitType": {
        const base = first ? mappedType(program, file, first, depth) : null;
        const drop = keysOf(second);
        return base && drop ? base.filter((k) => !drop.includes(k)) : null;
      }
      case "PickType": {
        const base = first ? mappedType(program, file, first, depth) : null;
        const keep = keysOf(second);
        return base && keep ? base.filter((k) => keep.includes(k)) : null;
      }
      case "IntersectionType": {
        const parts = e.arguments.map((a) => mappedType(program, file, a, depth));
        return parts.some((p) => p === null) ? null : [...new Set(parts.flat() as string[])];
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// BFF discovery

type TransportSpec = { method: HttpMethod | null; bodyArg: number | null; initArg: number | null; isPublic: boolean };
const TRANSPORTS: Record<string, TransportSpec> = {
  authedGet: { method: "GET", bodyArg: null, initArg: null, isPublic: false },
  authedGetPage: { method: "GET", bodyArg: null, initArg: null, isPublic: false },
  authedPost: { method: "POST", bodyArg: 2, initArg: null, isPublic: false },
  authedPatch: { method: "PATCH", bodyArg: 2, initArg: null, isPublic: false },
  authedPut: { method: "PUT", bodyArg: 2, initArg: null, isPublic: false },
  authedDelete: { method: "DELETE", bodyArg: null, initArg: null, isPublic: false },
  authedFetch: { method: null, bodyArg: null, initArg: 2, isPublic: false },
  nexoFetch: { method: null, bodyArg: null, initArg: 2, isPublic: false },
  nexoPublicFetch: { method: null, bodyArg: null, initArg: 2, isPublic: true },
};
const API_BASE = /^(NEXO_API_URL|resolveNexoApiUrl\(\))$/;

/** Owner chain of a node: `router.procedure`, `function`, `variable`… outermost first. */
function ownerName(node: ts.Node): string {
  const names: string[] = [];
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if ((ts.isPropertyAssignment(n) || ts.isMethodDeclaration(n) || ts.isFunctionDeclaration(n)) && n.name) names.push(n.name.getText());
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) names.push(n.name.text);
  }
  return names.reverse().join(".") || "(módulo)";
}

type PathResult = { path: string | null; apiBase: boolean; reason?: string };

class BffAnalyzer {
  constructor(private readonly program: Program) {}

  /** Resolves a path expression. `subst` maps helper parameters to already resolved paths. */
  path(expr: ts.Expression | undefined, subst: Map<string, string> = new Map(), depth = 0): PathResult {
    if (!expr || depth > 6) return { path: null, apiBase: false, reason: "sem expressão" };
    const e = stripParens(expr);
    if (ts.isStringLiteralLike(e)) return { path: e.text, apiBase: false };
    if (API_BASE.test(e.getText())) return { path: "", apiBase: true };
    if (ts.isIdentifier(e)) {
      if (subst.has(e.text)) return { path: subst.get(e.text)!, apiBase: false };
      const binding = findBinding(e, e.text);
      if (binding && ts.isVariableDeclaration(binding) && binding.initializer) return this.path(binding.initializer, subst, depth + 1);
      return { path: null, apiBase: false, reason: `variável ${e.text}` };
    }
    if (ts.isTemplateExpression(e)) {
      let out = e.head.text;
      let apiBase = false;
      for (const span of e.templateSpans) {
        const spanText = span.expression.getText();
        if (out === "" && !apiBase && API_BASE.test(spanText)) {
          apiBase = true;
          out = span.literal.text;
          continue;
        }
        if (ts.isIdentifier(span.expression) && subst.has(span.expression.text)) {
          out += subst.get(span.expression.text)! + span.literal.text;
          continue;
        }
        if (out.includes("?")) break; // query string: values do not change the route
        if (out === "" || !out.endsWith("/")) {
          // Not a whole segment: either a query suffix (`/x${query}`) or a path built elsewhere.
          if (out === "") return { path: null, apiBase, reason: `caminho dinâmico \${${spanText}}` };
          out += "?";
          break;
        }
        out += ":param" + span.literal.text;
      }
      return { path: out, apiBase };
    }
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = this.path(e.left, subst, depth + 1);
      if (left.path === null) return left;
      const right = this.path(e.right, subst, depth + 1);
      if (right.path !== null) return { path: left.path + right.path, apiBase: left.apiBase };
      // Only a query-string tail may stay unresolved; a dynamic path suffix must never shrink to a prefix.
      return left.path.includes("?") ? { path: left.path, apiBase: left.apiBase } : { path: null, apiBase: left.apiBase, reason: `sufixo dinâmico (${right.reason ?? "?"})` };
    }
    if (ts.isNewExpression(e) && e.expression.getText() === "URL") return { path: null, apiBase: false, reason: `new URL(${e.arguments?.[0]?.getText().slice(0, 30) ?? ""})` };
    return { path: null, apiBase: false, reason: e.getText().slice(0, 50) };
  }

  /** Keys of a zod schema expression (input of a tRPC procedure); null when not resolvable. */
  zodKeys(expr: ts.Expression | undefined, file: string, depth = 0): string[] | null {
    if (!expr || depth > 10) return null;
    const e = stripParens(expr);
    if (ts.isIdentifier(e)) {
      const local = findBinding(e, e.text);
      if (local && ts.isVariableDeclaration(local) && local.initializer) return this.zodKeys(local.initializer, file, depth + 1);
      const top = this.program.findTopLevel(file, e.text);
      return top && !ts.isClassDeclaration(top.node) && !ts.isFunctionDeclaration(top.node) ? this.zodKeys(top.node as ts.Expression, top.file, depth + 1) : null;
    }
    if (ts.isPropertyAccessExpression(e) && e.name.text === "shape") return this.zodKeys(e.expression, file, depth + 1);
    if (!ts.isCallExpression(e) || !ts.isPropertyAccessExpression(e.expression)) return null;
    const method = e.expression.name.text;
    const receiver = e.expression.expression;
    const [arg] = e.arguments;
    const literalKeys = (o: ts.Expression | undefined): string[] | null => {
      if (!o || !ts.isObjectLiteralExpression(o)) return null;
      const keys: string[] = [];
      for (const p of o.properties) {
        if (ts.isSpreadAssignment(p)) {
          // `...schema.shape` / `...otherSchema` or `...fieldsObject` (plain object of zod fields).
          const spread = this.zodKeys(p.expression, file, depth + 1) ?? this.plainObjectKeys(p.expression, file);
          if (!spread) return null;
          keys.push(...spread);
        } else if (p.name) keys.push(p.name.getText().replace(/^["']|["']$/g, ""));
      }
      return keys;
    };
    if (["object", "strictObject", "looseObject"].includes(method) && receiver.getText() === "z") return literalKeys(arg);
    if ((method === "union" || method === "discriminatedUnion") && receiver.getText() === "z") {
      // Any variant may be sent: the body can contain the keys of every variant.
      const list = stripParens((method === "union" ? e.arguments[0] : e.arguments[1]) ?? e);
      if (!ts.isArrayLiteralExpression(list)) return null;
      const variants = list.elements.map((v) => this.zodKeys(v as ts.Expression, file, depth + 1));
      return variants.some((v) => v === null) ? null : [...new Set(variants.flat() as string[])];
    }
    if (["strict", "passthrough", "strip", "optional", "nullable", "nullish", "partial", "required", "refine", "superRefine", "default", "describe", "readonly", "catch", "brand"].includes(method)) {
      return this.zodKeys(receiver, file, depth + 1);
    }
    const base = this.zodKeys(receiver, file, depth + 1);
    if (!base) return null;
    if (method === "extend") {
      const extra = literalKeys(arg);
      return extra ? [...new Set([...base, ...extra])] : null;
    }
    if (method === "merge" || method === "and") {
      const other = this.zodKeys(arg, file, depth + 1);
      return other ? [...new Set([...base, ...other])] : null;
    }
    if (method === "omit" || method === "pick") {
      const listed = literalKeys(arg);
      if (!listed) return null;
      return method === "omit" ? base.filter((k) => !listed.includes(k)) : base.filter((k) => listed.includes(k));
    }
    return null; // transform/pipe/unknown: output keys cannot be derived statically
  }

  /** Keys of a plain object literal (e.g. a shared map of zod fields), following a const binding. */
  private plainObjectKeys(expr: ts.Expression, file: string): string[] | null {
    const e = stripParens(expr);
    if (ts.isObjectLiteralExpression(e)) return e.properties.every((p) => p.name && !ts.isSpreadAssignment(p)) ? e.properties.map((p) => p.name!.getText().replace(/^["']|["']$/g, "")) : null;
    if (ts.isIdentifier(e)) {
      const local = findBinding(e, e.text);
      if (local && ts.isVariableDeclaration(local) && local.initializer) return this.plainObjectKeys(local.initializer, file);
      const top = this.program.findTopLevel(file, e.text);
      return top && ts.isObjectLiteralExpression(top.node as ts.Node) ? this.plainObjectKeys(top.node as ts.Expression, top.file) : null;
    }
    return null;
  }

  /** Input schema keys of the tRPC procedure that encloses `node`. */
  procedureInputKeys(node: ts.Node, file: string): string[] | null {
    for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ["mutation", "query", "subscription"].includes(n.expression.name.text)) {
        const keys: string[] = [];
        let found = false;
        for (let c: ts.Expression = n.expression.expression; ts.isCallExpression(c) && ts.isPropertyAccessExpression(c.expression); c = c.expression.expression) {
          if (c.expression.name.text === "input") {
            const k = this.zodKeys(c.arguments[0], file);
            if (!k) return null;
            keys.push(...k);
            found = true;
          }
        }
        return found ? [...new Set(keys)] : null;
      }
    }
    return null;
  }

  /** Field names sent in a request body expression. */
  body(expr: ts.Expression | undefined, file: string, subst: Map<string, ts.Expression> = new Map(), depth = 0): SentBody {
    const none = (reason: string): SentBody => ({ keys: [], unresolved: [reason] });
    if (!expr || depth > 8) return none("sem expressão");
    const e = stripParens(expr);
    const merge = (parts: SentBody[]): SentBody => ({ keys: [...new Set(parts.flatMap((p) => p.keys))], unresolved: parts.flatMap((p) => p.unresolved) });
    if (ts.isCallExpression(e) && e.expression.getText() === "JSON.stringify") return this.body(e.arguments[0], file, subst, depth + 1);
    if (ts.isObjectLiteralExpression(e)) {
      const parts: SentBody[] = [];
      for (const p of e.properties) {
        if (ts.isSpreadAssignment(p)) parts.push(this.body(p.expression, file, subst, depth + 1));
        else if (p.name) parts.push({ keys: [p.name.getText().replace(/^["']|["']$/g, "")], unresolved: [] });
      }
      return merge(parts);
    }
    if (ts.isConditionalExpression(e)) return merge([this.body(e.whenTrue, file, subst, depth + 1), this.body(e.whenFalse, file, subst, depth + 1)]);
    if (ts.isBinaryExpression(e) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(e.operatorToken.kind)) {
      return this.body(e.left, file, subst, depth + 1);
    }
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return this.body(e.right, file, subst, depth + 1);
    if (ts.isIdentifier(e)) {
      if (subst.has(e.text)) return this.body(subst.get(e.text), file, new Map(), depth + 1);
      if (e.text === "undefined") return { keys: [], unresolved: [] };
      const binding = findBinding(e, e.text);
      if (!binding) return none(`variável ${e.text}`);
      if (ts.isVariableDeclaration(binding)) return binding.initializer ? this.body(binding.initializer, file, subst, depth + 1) : none(`variável ${e.text} sem valor`);
      if (ts.isBindingElement(binding)) return this.bindingKeys(binding, file, subst, depth);
      // Plain parameter named `input` of a procedure callback is the procedure input.
      const keys = e.text === "input" ? this.procedureInputKeys(binding, file) : null;
      return keys ? { keys, unresolved: [] } : none(`parâmetro ${e.text}`);
    }
    return none(e.getText().slice(0, 50));
  }

  /**
   * Keys bound to a destructured name.
   * - `const { a, ...rest } = source` → keys of `source` minus `a`;
   * - `({ ctx, input })` → the procedure input;
   * - `({ input: { id, ...input } })` → the procedure input minus `id`.
   */
  private bindingKeys(el: ts.BindingElement, file: string, subst: Map<string, ts.Expression>, depth: number): SentBody {
    const pattern = el.parent as ts.ObjectBindingPattern;
    const owner = pattern.parent;
    const name = this.propertyName(el);
    if (ts.isParameter(owner)) {
      const keys = !el.dotDotDotToken && name === "input" ? this.procedureInputKeys(owner, file) : null;
      return keys ? { keys, unresolved: [] } : { keys: [], unresolved: [`parâmetro desestruturado ${name}`] };
    }
    let source: SentBody;
    if (ts.isVariableDeclaration(owner)) {
      source = owner.initializer ? this.body(owner.initializer, file, subst, depth + 1) : { keys: [], unresolved: ["desestruturação sem origem"] };
    } else if (ts.isBindingElement(owner) && this.propertyName(owner) === "input" && ts.isParameter(owner.parent.parent)) {
      const keys = this.procedureInputKeys(owner.parent.parent, file);
      source = keys ? { keys, unresolved: [] } : { keys: [], unresolved: ["input sem schema resolvido"] };
    } else {
      return { keys: [], unresolved: ["desestruturação não suportada"] };
    }
    if (!el.dotDotDotToken) return { keys: [], unresolved: [`propriedade ${name} de objeto`] };
    const taken = pattern.elements.filter((x) => x !== el && !x.dotDotDotToken).map((x) => this.propertyName(x));
    return { keys: source.keys.filter((k) => !taken.includes(k)), unresolved: source.unresolved };
  }

  private propertyName(el: ts.BindingElement) {
    return (el.propertyName ?? el.name).getText();
  }

  /** Method, body and Authorization header from a fetch-like init object. */
  init(expr: ts.Expression | undefined, fallback: HttpMethod | null, file: string, subst: Map<string, ts.Expression>): { method: string; body: SentBody | null; sendsAuthorization: boolean } {
    let method: string = fallback ?? "GET";
    let body: SentBody | null = null;
    let sendsAuthorization = false;
    const e = expr ? stripParens(expr) : undefined;
    if (e && ts.isObjectLiteralExpression(e)) {
      for (const p of e.properties) {
        const key = p.name?.getText();
        if (ts.isShorthandPropertyAssignment(p) && key === "body") body = this.body(p.name, file, subst);
        if (!ts.isPropertyAssignment(p)) continue;
        if (key === "method") method = ts.isStringLiteralLike(p.initializer) ? p.initializer.text.toUpperCase() : `<${p.initializer.getText()}>`;
        if (key === "body") body = this.body(p.initializer, file, subst);
        if (key === "headers") sendsAuthorization = /\bauthorization\b/i.test(p.initializer.getText());
      }
    } else if (e && ts.isIdentifier(e) && subst.has(e.text)) {
      return this.init(subst.get(e.text), fallback, file, new Map());
    } else if (e) {
      method = fallback ?? `<${e.getText().slice(0, 30)}>`;
    }
    return { method, body, sendsAuthorization };
  }
}

/** Local (non-exported) function whose transport call takes its path from one of its parameters. */
type Helper = { name: string; file: string; params: string[]; call: ts.CallExpression; transport: string };

function enclosingHelper(call: ts.CallExpression, pathExpr: ts.Expression): Helper | null {
  const fn = (() => {
    for (let n: ts.Node | undefined = call.parent; n; n = n.parent) if (ts.isFunctionLike(n)) return n as ts.SignatureDeclaration;
    return null;
  })();
  if (!fn) return null;
  const params = fn.parameters.map((p) => (ts.isIdentifier(p.name) ? p.name.text : ""));
  const used = new Set<string>();
  const collect = (n: ts.Node) => {
    if (ts.isIdentifier(n)) used.add(n.text);
    ts.forEachChild(n, collect);
  };
  collect(pathExpr);
  if (!params.some((p) => p && used.has(p))) return null;
  let name: string | null = null;
  let exported = false;
  if (ts.isFunctionDeclaration(fn) && fn.name) {
    name = fn.name.text;
    exported = !!fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  } else if (fn.parent && ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)) {
    name = fn.parent.name.text;
    const stmt = fn.parent.parent?.parent;
    exported = !!(stmt && ts.isVariableStatement(stmt) && stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
  }
  if (!name || exported) return null;
  return { name, file: call.getSourceFile().fileName, params, call, transport: call.expression.getText() };
}

export function discoverBffCalls(program: Program): BffCall[] {
  const analyzer = new BffAnalyzer(program);
  const calls: BffCall[] = [];
  for (const [file, sf] of program.files) {
    if (!file.startsWith("apps/web/server/")) continue;
    const helpers: Helper[] = [];

    const emit = (call: ts.CallExpression, transport: string, spec: TransportSpec, pathExpr: ts.Expression | undefined, site: ts.CallExpression, via?: string, pathSubst = new Map<string, string>(), exprSubst = new Map<string, ts.Expression>()) => {
      const resolved = analyzer.path(pathExpr, pathSubst);
      const init = spec.initArg !== null ? analyzer.init(call.arguments[spec.initArg], spec.method, file, exprSubst) : { method: spec.method ?? "GET", body: null as SentBody | null, sendsAuthorization: false };
      const body = spec.bodyArg !== null ? analyzer.body(call.arguments[spec.bodyArg], file, exprSubst) : init.body;
      calls.push({
        method: init.method,
        path: resolved.path === null ? null : resolved.path,
        file,
        line: lineOf(site),
        fn: ownerName(site),
        transport,
        isPublic: spec.isPublic,
        sendsAuthorization: init.sendsAuthorization,
        body: ["POST", "PUT", "PATCH"].includes(init.method) ? body : null,
        via,
        unresolvedReason: resolved.path === null ? resolved.reason : undefined,
      });
    };

    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression.getText();
        const spec = TRANSPORTS[callee];
        if (spec && node.arguments.length >= 2) {
          const pathExpr = node.arguments[1];
          const probe = analyzer.path(pathExpr);
          const helper = probe.path === null || /\$\{|\+/.test(pathExpr.getText()) ? enclosingHelper(node, pathExpr) : null;
          if (helper) helpers.push(helper);
          else emit(node, callee, spec, pathExpr, node);
        }
        if (callee === "fetch" || callee === "globalThis.fetch") {
          const target = analyzer.path(node.arguments[0]);
          if (target.apiBase) {
            emit(node, "fetch", { method: null, bodyArg: null, initArg: 1, isPublic: false }, node.arguments[0], node);
            const last = calls[calls.length - 1];
            // Direct fetches set their own Authorization header (or none, for public routes).
            last.isPublic = !last.sendsAuthorization;
          } else {
            calls.push({ method: "?", path: null, file, line: lineOf(node), fn: ownerName(node), transport: "fetch", isPublic: true, sendsAuthorization: false, body: null, unresolvedReason: `EXTERNAL:${node.arguments[0]?.getText().slice(0, 50) ?? ""}` });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);

    // Expand local helpers at their call sites (path and body come from the arguments).
    for (const helper of helpers) {
      const spec = TRANSPORTS[helper.transport];
      const sites: ts.CallExpression[] = [];
      const findSites = (n: ts.Node) => {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === helper.name) sites.push(n);
        ts.forEachChild(n, findSites);
      };
      findSites(sf);
      if (!sites.length) {
        calls.push({ method: spec.method ?? "?", path: null, file, line: lineOf(helper.call), fn: ownerName(helper.call), transport: helper.transport, isPublic: spec.isPublic, sendsAuthorization: false, body: null, via: helper.name, unresolvedReason: `helper ${helper.name} sem chamadas` });
      }
      for (const site of sites) {
        const pathSubst = new Map<string, string>();
        const exprSubst = new Map<string, ts.Expression>();
        let unresolved: string | undefined;
        const helperPath = helper.call.arguments[1].getText();
        helper.params.forEach((param, i) => {
          if (!param || !site.arguments[i]) return;
          exprSubst.set(param, site.arguments[i]);
          if (!new RegExp(`\\b${param}\\b`).test(helperPath)) return;
          const r = analyzer.path(site.arguments[i]);
          if (r.path !== null) pathSubst.set(param, r.path);
          // An id filling a whole segment (`/x/${id}`) is a route parameter, not a path.
          else if (new RegExp(`/\\$\\{${param}\\}(?=/|\x60|\\?|$)`).test(helperPath)) pathSubst.set(param, ":param");
          else unresolved = r.reason ?? `argumento ${param}`;
        });
        if (unresolved) {
          calls.push({ method: spec.method ?? "?", path: null, file, line: lineOf(site), fn: ownerName(site), transport: helper.transport, isPublic: spec.isPublic, sendsAuthorization: false, body: null, via: helper.name, unresolvedReason: unresolved });
          continue;
        }
        emit(helper.call, helper.transport, spec, helper.call.arguments[1], site, helper.name, pathSubst, exprSubst);
      }
    }
  }
  return calls;
}

// ---------------------------------------------------------------------------------------------
// Comparison

const segments = (path: string) => path.split("?")[0].replace(/\/+$/, "").split("/").filter(Boolean);
const isParam = (segment: string) => segment.startsWith(":");

export function matchRoute(routes: ApiRoute[], method: string, path: string): { route: ApiRoute | null; candidates: ApiRoute[] } {
  const b = segments(path);
  const candidates = routes.filter((r) => {
    const a = segments(r.path);
    return a.length === b.length && a.every((x, i) => x === b[i] || isParam(x) || isParam(b[i]));
  });
  const literalScore = (r: ApiRoute) => segments(r.path).filter((x, i) => x === b[i]).length;
  const sameMethod = candidates.filter((r) => r.method === method || r.method === "ALL").sort((x, y) => literalScore(y) - literalScore(x));
  return { route: sameMethod[0] ?? null, candidates };
}

export function analyzeContract(sources: { api: SourceInput[]; web: SourceInput[] }): ContractReport {
  const program = new Program([...sources.api, ...sources.web]);
  const findings: Finding[] = [];
  const routes = discoverApiRoutes(program, (f) => findings.push(f));
  const calls = discoverBffCalls(program);

  for (const route of routes) {
    if (route.access === "undeclared") {
      findings.push({ kind: "ROUTE_WITHOUT_ACCESS_DECLARATION", file: route.file, line: route.line, route: `${route.method} ${route.path}`, detail: `${route.controller}: sem JwtAuthGuard e sem @Public()` });
    }
  }

  for (const call of calls) {
    const base = { file: call.file, line: call.line, fn: call.fn };
    if (call.path === null) {
      const external = call.unresolvedReason?.startsWith("EXTERNAL:");
      findings.push({ ...base, kind: external ? "EXTERNAL_FETCH" : "UNRESOLVED_PATH", detail: external ? `fetch fora da API: ${call.unresolvedReason!.slice(9)}` : `caminho não resolvido (${call.unresolvedReason ?? "?"})` });
      continue;
    }
    const { route, candidates } = matchRoute(routes, call.method, call.path);
    const callKey = `${call.method} ${call.path}`;
    if (!route) {
      findings.push({ ...base, kind: candidates.length ? "WRONG_METHOD" : "NO_ROUTE", route: callKey, detail: candidates.length ? `rotas existentes: ${candidates.map((r) => `${r.method} ${r.path}`).join(", ")}` : "nenhuma rota da API corresponde" });
      continue;
    }
    const routeKey = `${route.method} ${route.path}`;
    if (call.isPublic && route.access === "jwt" && !call.sendsAuthorization) {
      findings.push({ ...base, kind: "PUBLIC_CALL_TO_PROTECTED_ROUTE", route: routeKey, detail: `${route.controller} exige JwtAuthGuard` });
    }
    if (route.access === "undeclared") {
      findings.push({ ...base, kind: "CALL_TO_UNDECLARED_ACCESS_ROUTE", route: routeKey, detail: `${route.controller} sem declaração de acesso` });
    }
    if (call.body && route.body?.kind === "class" && dtoKind(program, route.body.file, route.body.name) !== "type") {
      const whitelist = dtoWhitelist(program, route.body.file, route.body.name);
      if (!whitelist) {
        findings.push({ ...base, kind: "DTO_UNRESOLVED", route: routeKey, detail: `DTO ${route.body.name} não resolvido estaticamente` });
        continue;
      }
      for (const field of call.body.keys.filter((k) => !whitelist.includes(k))) {
        findings.push({ ...base, kind: "BODY_FIELD_NOT_IN_DTO", route: routeKey, field, detail: `${route.body.name} não declara "${field}" (forbidNonWhitelisted → 400)` });
      }
      if (call.body.unresolved.length) {
        findings.push({ ...base, kind: "BODY_UNRESOLVED", route: routeKey, detail: `corpo não resolvido: ${call.body.unresolved.join("; ")}` });
      }
    }
  }
  return { routes, calls, findings };
}

// ---------------------------------------------------------------------------------------------
// Exceptions

export function exceptionMatches(exception: ContractException, finding: Finding): boolean {
  return (
    exception.kind === finding.kind &&
    exception.file === finding.file &&
    (exception.fn === undefined || exception.fn === finding.fn) &&
    (exception.route === undefined || exception.route === finding.route) &&
    (exception.field === undefined || exception.field === finding.field)
  );
}

export function applyExceptions(findings: Finding[], exceptions: ContractException[]) {
  const unexpected = findings.filter((f) => !exceptions.some((e) => exceptionMatches(e, f)));
  const unused = exceptions.filter((e) => !findings.some((f) => exceptionMatches(e, f)));
  return { unexpected, unused };
}

export const formatFinding = (f: Finding) =>
  `${f.kind} ${f.file}:${f.line} [${f.fn ?? "-"}]${f.route ? ` ${f.route}` : ""}${f.field ? ` campo=${f.field}` : ""} — ${f.detail}`;
