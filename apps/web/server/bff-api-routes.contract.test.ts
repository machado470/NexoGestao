import { describe, expect, it } from "vitest";

import {
  analyzeContract,
  applyExceptions,
  formatFinding,
  loadRepositorySources,
  matchRoute,
  readPrefixes,
  type ContractException,
  type Finding,
  type SourceInput,
} from "./__contract__/routeContract";
import { CONTRACT_EXCEPTIONS } from "./__contract__/routeContract.exceptions";

/**
 * C8 PR2 — every BFF call to the API must hit a declared route with the right method, respect the
 * route's access declaration and send only fields the target DTO whitelists (the API rejects any
 * other field: ValidationPipe whitelist + forbidNonWhitelisted). Static analysis, no network.
 */

const MIN_API_ROUTES = 290;
const MIN_BFF_CALLS = 190;

describe("BFF → API contract (repository)", () => {
  const report = analyzeContract(loadRepositorySources());
  const { unexpected, unused } = applyExceptions(report.findings, CONTRACT_EXCEPTIONS);

  it("discovers enough routes and calls (the detector is not silently empty)", () => {
    expect(report.routes.length).toBeGreaterThanOrEqual(MIN_API_ROUTES);
    expect(report.calls.length).toBeGreaterThanOrEqual(MIN_BFF_CALLS);
  });

  it("the API global prefix is the one the BFF appends to NEXO_API_URL", () => {
    const prefixes = readPrefixes();
    expect(prefixes.api).toBeTruthy();
    expect(prefixes.bff).toBe(prefixes.api);
  });

  it("has no unexpected finding (route, method, access, body fields, unresolved items)", () => {
    expect(unexpected.map(formatFinding), "Corrija a chamada ou, se for legítimo, registre uma exceção específica e justificada").toEqual([]);
  });

  it("has no stale exception", () => {
    expect(unused.map((e) => `${e.kind} ${e.file} ${e.fn ?? ""} ${e.route ?? ""} ${e.field ?? ""}`.trim()), "Remova exceções que não correspondem a mais nenhum achado").toEqual([]);
  });

  it("exceptions are specific, justified and unique", () => {
    for (const e of CONTRACT_EXCEPTIONS) {
      const label = JSON.stringify(e);
      expect(e.fn || e.route, `exceção sem fn/route: ${label}`).toBeTruthy();
      expect(e.reason.trim().length, `justificativa curta: ${label}`).toBeGreaterThanOrEqual(20);
      expect(e.file, `arquivo deve ser um arquivo, não diretório: ${label}`).toMatch(/\.tsx?$/);
      if (e.kind === "BODY_FIELD_NOT_IN_DTO") {
        expect(e.field && e.route && e.fn, `exceção de campo deve nomear field, route e fn: ${label}`).toBeTruthy();
      }
    }
    const keys = CONTRACT_EXCEPTIONS.map((e) => [e.kind, e.file, e.fn, e.route, e.field].join("|"));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every call is either matched to a route or reported (nothing is skipped silently)", () => {
    for (const call of report.calls) {
      if (call.path !== null && matchRoute(report.routes, call.method, call.path).route) continue;
      expect(report.findings.some((f) => f.file === call.file && f.line === call.line), `${call.file}:${call.line}`).toBe(true);
    }
  });

  it("checks request bodies against DTO classes for a meaningful share of calls", () => {
    const checked = report.calls.filter((call) => {
      if (!call.body || call.path === null) return false;
      return matchRoute(report.routes, call.method, call.path).route?.body?.kind === "class";
    });
    expect(checked.length).toBeGreaterThanOrEqual(40);
  });
});

// ---------------------------------------------------------------------------------------------
// Negative fixtures: prove the detector fails on real incompatibilities.

const api = (path: string, text: string): SourceInput => ({ path: `apps/api/src/${path}`, text });
const web = (path: string, text: string): SourceInput => ({ path: `apps/web/server/${path}`, text });

const FIXTURE_API: SourceInput[] = [
  api(
    "widgets/widget.dto.ts",
    `
    import { IsString, IsOptional } from 'class-validator'
    import { ApiProperty } from '@nestjs/swagger'
    import { PartialType, OmitType } from '@nestjs/swagger'
    export class CreateWidgetDto {
      @IsString() name!: string
      @IsOptional() @IsString() color?: string
      @IsOptional() @IsString() serial?: string
      @IsOptional() @IsString() note?: string
      @ApiProperty() docsOnly?: string
    }
    export class UpdateWidgetDto extends PartialType(OmitType(CreateWidgetDto, ['serial'] as const)) {
      @IsString() expectedUpdatedAt!: string
    }
    export interface PlainShape { anything: string }
    `,
  ),
  api(
    "widgets/widgets.controller.ts",
    `
    import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common'
    import { JwtAuthGuard } from '../auth/jwt-auth.guard'
    import { Public } from '../auth/public.decorator'
    import { CreateWidgetDto, UpdateWidgetDto, PlainShape } from './widget.dto'
    @Controller('widgets')
    @UseGuards(JwtAuthGuard)
    export class WidgetsController {
      @Get() list() {}
      @Get(':id') one() {}
      @Post() create(@Body() body: CreateWidgetDto) {}
      @Patch(':id') update(@Body() body: UpdateWidgetDto) {}
      @Post('plain') plain(@Body() body: PlainShape) {}
      @Public() @Get('catalog') catalog() {}
    }
    `,
  ),
  // Non-conventional file name, array paths and object path syntax.
  api(
    "odd/odd-routes.ts",
    `
    import { Controller, Get, Post, UseGuards } from '@nestjs/common'
    import { JwtAuthGuard } from '../auth/jwt-auth.guard'
    @Controller({ path: 'odd' })
    @UseGuards(JwtAuthGuard)
    export class OddController {
      @Get(['a', 'b']) ab() {}
      @Post('items/:itemId/state') state() {}
    }
    @Controller('open')
    export class OpenController {
      @Get('status') status() {}
    }
    `,
  ),
];

const BASE_WEB: SourceInput[] = [
  web(
    "fixtures/schemas.ts",
    `
    import { z } from "zod";
    const common = { note: z.string().optional() };
    export const widgetCreate = z.object({ name: z.string(), color: z.string().optional(), ...common }).strict();
    export const widgetUnion = z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("a"), name: z.string() }),
      z.object({ kind: z.literal("b"), color: z.string() }),
    ]);
    `,
  ),
];

function analyzeFixture(router: string) {
  return analyzeContract({ api: FIXTURE_API, web: [...BASE_WEB, web("routers/fixture.ts", router)] }).findings;
}

const kinds = (findings: Finding[]) => findings.map((f) => `${f.kind}${f.field ? `:${f.field}` : ""}`).sort();

describe("BFF → API contract detector (negative fixtures)", () => {
  it("accepts a compatible router: params, query strings, helpers, destructuring, imports and unions", () => {
    const findings = analyzeFixture(`
      import { z } from "zod";
      import { authedGet, authedPost, authedPatch } from "../_core/nexoTransport";
      import { nexoFetch, nexoPublicFetch } from "../_core/nexoClient";
      import { widgetCreate } from "../fixtures/schemas";
      const read = (ctx: any, path: string) => nexoFetch(ctx, "/widgets" + path, { method: "GET" });
      function oddState(ctx: any, itemId: string) { return authedPost(ctx, \`/odd/items/\${itemId}/state\`, {}); }
      export const fixtureRouter = router({
        list: p.query(({ ctx, input }) => authedGet(ctx, \`/widgets?page=\${input.page}\`)),
        one: p.query(({ ctx, input }) => authedGet(ctx, \`/widgets/\${input.id}\`)),
        viaHelper: p.query(({ ctx, input }) => read(ctx, \`/\${input.id}\`)),
        viaIdHelper: p.mutation(({ ctx, input }) => oddState(ctx, input.id)),
        odd: p.query(({ ctx }) => authedGet(ctx, "/odd/b")),
        create: p.input(widgetCreate).mutation(({ ctx, input }) => authedPost(ctx, "/widgets", input)),
        update: p.input(z.object({ id: z.string(), color: z.string().optional(), expectedUpdatedAt: z.string() })).mutation(({ ctx, input }) => {
          const { id, ...payload } = input;
          return authedPatch(ctx, \`/widgets/\${id}\`, payload);
        }),
        nested: p.input(z.object({ id: z.string(), name: z.string() })).mutation(({ ctx, input: { id, ...input } }) => nexoFetch(ctx, \`/widgets/\${id}\`, { method: "PATCH", body: JSON.stringify(input) })),
        plain: p.mutation(({ ctx }) => authedPost(ctx, "/widgets/plain", { whatever: 1 })),
        publicOk: p.query(({ ctx }) => nexoPublicFetch(ctx, "/widgets/catalog", { method: "GET" })),
        publicWithToken: p.query(({ ctx }) => nexoPublicFetch(ctx, "/widgets", { method: "GET", headers: { Authorization: "Bearer x" } })),
      });
    `);
    expect(findings.filter((f) => f.file.endsWith("fixture.ts")).map(formatFinding)).toEqual([]);
  });

  it("flags a call to a route that does not exist", () => {
    expect(kinds(analyzeFixture(`export const r = { a: p.query(({ ctx }) => authedGet(ctx, "/widgetz")) };`).filter((f) => f.file.endsWith("fixture.ts")))).toEqual(["NO_ROUTE"]);
  });

  it("flags the wrong HTTP method", () => {
    expect(kinds(analyzeFixture(`export const r = { a: p.mutation(({ ctx, input }) => nexoFetch(ctx, \`/widgets/\${input.id}\`, { method: "DELETE" })) };`).filter((f) => f.file.endsWith("fixture.ts")))).toEqual(["WRONG_METHOD"]);
  });

  it("flags a public call to a JWT-protected route without Authorization", () => {
    expect(kinds(analyzeFixture(`export const r = { a: p.query(({ ctx }) => nexoPublicFetch(ctx, "/widgets", { method: "GET" })) };`).filter((f) => f.file.endsWith("fixture.ts")))).toEqual(["PUBLIC_CALL_TO_PROTECTED_ROUTE"]);
  });

  it("flags body fields the DTO does not whitelist (literal, docs-only property, zod input, removed by OmitType)", () => {
    const findings = analyzeFixture(`
      import { z } from "zod";
      import { widgetUnion } from "../fixtures/schemas";
      export const r = {
        literal: p.mutation(({ ctx }) => authedPost(ctx, "/widgets", { name: "x", sneaky: 1 })),
        docsOnly: p.mutation(({ ctx }) => authedPost(ctx, "/widgets", { name: "x", docsOnly: "y" })),
        zodInput: p.input(z.object({ name: z.string(), extra: z.string() })).mutation(({ ctx, input }) => authedPost(ctx, "/widgets", input)),
        omitted: p.mutation(({ ctx, input }) => authedPatch(ctx, \`/widgets/\${input.id}\`, { serial: "s", expectedUpdatedAt: "t" })),
        union: p.input(widgetUnion).mutation(({ ctx, input }) => authedPost(ctx, "/widgets", input)),
      };
    `).filter((f) => f.file.endsWith("fixture.ts"));
    expect(kinds(findings)).toEqual([
      "BODY_FIELD_NOT_IN_DTO:docsOnly",
      "BODY_FIELD_NOT_IN_DTO:extra",
      "BODY_FIELD_NOT_IN_DTO:kind",
      "BODY_FIELD_NOT_IN_DTO:serial",
      "BODY_FIELD_NOT_IN_DTO:sneaky",
    ]);
  });

  it("reports paths it cannot resolve instead of matching a prefix", () => {
    const findings = analyzeFixture(`
      const read = (ctx: any, path: string) => nexoFetch(ctx, "/widgets" + path, { method: "GET" });
      export const r = {
        dynamic: p.query(({ ctx, input }) => read(ctx, input.suffix)),
        unused: p.query(({ ctx, input }) => authedGet(ctx, buildPath(input))),
      };
    `).filter((f) => f.file.endsWith("fixture.ts"));
    expect(kinds(findings)).toEqual(["UNRESOLVED_PATH", "UNRESOLVED_PATH"]);
  });

  it("reports an unresolved request body", () => {
    const findings = analyzeFixture(`export const r = { a: p.mutation(({ ctx }) => authedPost(ctx, "/widgets", buildBody())) };`).filter((f) => f.file.endsWith("fixture.ts"));
    expect(kinds(findings)).toEqual(["BODY_UNRESOLVED"]);
  });

  it("flags API routes without JwtAuthGuard or @Public() and calls to them", () => {
    const findings = analyzeFixture(`export const r = { a: p.query(({ ctx }) => authedGet(ctx, "/open/status")) };`);
    expect(kinds(findings.filter((f) => f.file.endsWith("odd-routes.ts")))).toEqual(["ROUTE_WITHOUT_ACCESS_DECLARATION"]);
    expect(kinds(findings.filter((f) => f.file.endsWith("fixture.ts")))).toEqual(["CALL_TO_UNDECLARED_ACCESS_ROUTE"]);
  });

  it("classifies every fetch: API base URL resolved, anything else external", () => {
    const findings = analyzeFixture(`
      const NEXO_API_URL = resolveNexoApiUrl();
      export async function a() { const url = \`\${NEXO_API_URL}/widgetz\`; return fetch(url, { method: "GET" }); }
      export async function b() { return fetch("https://example.test/x"); }
    `).filter((f) => f.file.endsWith("fixture.ts"));
    expect(kinds(findings)).toEqual(["EXTERNAL_FETCH", "NO_ROUTE"]);
  });

  it("a field exception covers only its field, and unused exceptions are reported", () => {
    const findings = analyzeFixture(`export const r = { a: p.mutation(({ ctx }) => authedPost(ctx, "/widgets", { name: "x", sneaky: 1, other: 2 })) };`);
    const exception: ContractException = { kind: "BODY_FIELD_NOT_IN_DTO", file: "apps/web/server/routers/fixture.ts", fn: "r.a", route: "POST /widgets", field: "sneaky", reason: "fixture: only this field is accepted" };
    const stale: ContractException = { kind: "NO_ROUTE", file: "apps/web/server/routers/fixture.ts", fn: "r.gone", route: "GET /gone", reason: "fixture: no longer matches anything" };
    const { unexpected, unused } = applyExceptions(findings, [exception, stale]);
    expect(kinds(unexpected.filter((f) => f.file.endsWith("fixture.ts")))).toEqual(["BODY_FIELD_NOT_IN_DTO:other"]);
    expect(unused).toEqual([stale]);
  });
});
