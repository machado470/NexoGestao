import { Test } from "@nestjs/testing";
import { UnauthorizedException, ValidationPipe } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { randomUUID as uuid } from "crypto";
import request from "supertest";
import {
  ServiceCatalogController,
  ServiceCatalogService,
} from "./service-catalog";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
const url = "postgresql://nexo@127.0.0.1:55439/postgres";
(process.env.CATALOG_TEST_DATABASE_URL === url ? describe : describe.skip)(
  "Service catalog with PostgreSQL",
  () => {
    let db: PrismaClient, app: any, item: any;
    const org = uuid(),
      foreign = uuid(),
      actor = uuid(),
      outsider = uuid();
    const values = {
      code: "visita-01",
      name: "Visita técnica",
      description: "Avaliação inicial do equipamento.",
      priceCents: 15000,
      durationMinutes: 60,
      expectedCurrency: "BRL",
    };
    const call = (
      method: string,
      path: string,
      body?: any,
      role = "MANAGER",
      tenant = org,
      userId: string = actor,
    ) =>
      request(app.getHttpServer())
        [method]("/service-catalog" + path)
        .set("x-org", tenant)
        .set("x-actor", userId)
        .set("x-role", role)
        .send(body);
    const create = (
      body: any = { ...values, entryKey: uuid() },
      role = "MANAGER",
    ) => call("post", "", body, role);
    const edit = (target: any, changes: any = {}, version = target.version) =>
      call("post", "/" + target.id, {
        ...values,
        code: target.code,
        active: true,
        expectedVersion: version,
        reason: "Revisão comercial do serviço cadastrado.",
        ...changes,
      });
    beforeAll(async () => {
      db = new PrismaClient({ datasources: { db: { url } } });
      await db.organization.createMany({
        data: [org, foreign].map((id) => ({
          id,
          slug: id,
          name: "Catálogo local",
          currency: "BRL",
        })),
      });
      for (const [id, orgId] of [
        [actor, org],
        [outsider, foreign],
      ]) {
        await db.user.create({
          data: {
            id,
            orgId,
            email: id + "@example.test",
            active: true,
            role: "ADMIN",
          },
        });
        await db.person.create({
          data: { orgId, userId: id, name: "Gestora local", role: "ADMIN" },
        });
      }
      const module = await Test.createTestingModule({
        controllers: [ServiceCatalogController],
        providers: [
          ServiceCatalogService,
          { provide: PrismaService, useValue: db },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: (ctx) => {
            const req = ctx.switchToHttp().getRequest();
            if (!req.headers["x-actor"]) throw new UnauthorizedException();
            req.user = {
              sub: req.headers["x-actor"],
              orgId: req.headers["x-org"],
              role: req.headers["x-role"],
            };
            return true;
          },
        })
        .compile();
      app = module.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
          transformOptions: { enableImplicitConversion: true },
        }),
      );
      await app.init();
    });
    afterAll(async () => {
      await app?.close();
      if (db) {
        for (const id of [org, foreign]) {
          const where = { orgId: id };
          await db.catalogServiceRevision.deleteMany({ where });
          await db.catalogService.deleteMany({ where });
          await db.auditEvent.deleteMany({ where });
          await db.person.deleteMany({ where });
          await db.user.deleteMany({ where });
          await db.organization.deleteMany({ where: { id } });
        }
        await db.$disconnect();
      }
    });
    it("creates once under concurrency, snapshots the currency and keeps codes unique", async () => {
      const body = { ...values, entryKey: uuid() };
      const results = await Promise.all(
        Array.from({ length: 8 }, () => create(body)),
      );
      for (const result of results) {
        expect(result.status).toBe(201);
        expect(result.body.code).toBe("VISITA-01");
        expect(result.body.orgId).toBeUndefined();
        expect(result.body.entryKey).toBeUndefined();
      }
      item = results[0].body;
      expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
      expect(
        await db.catalogServiceRevision.count({ where: { orgId: org } }),
      ).toBe(1);
      expect((await create({ ...body, name: "Outro conteúdo" })).status).toBe(
        409,
      );
      expect((await create({ ...values, entryKey: uuid() })).status).toBe(409);
      expect(
        (
          await create({
            ...values,
            code: "NOVO",
            expectedCurrency: "USD",
            entryKey: uuid(),
          })
        ).status,
      ).toBe(409);
    });
    it("enforces roles, session, tenant and raw payload types", async () => {
      for (const role of ["STAFF", "VIEWER"]) {
        expect(
          (await create({ ...values, code: role, entryKey: uuid() }, role))
            .status,
        ).toBe(403);
        expect((await call("get", "", undefined, role)).status).toBe(200);
      }
      expect(
        (await call("get", "", undefined, "MANAGER", org, "")).status,
      ).toBe(401);
      const body = {
        ...values,
        active: false,
        expectedVersion: 0,
        reason: "Arquivar serviço durante a revisão.",
      };
      for (const role of ["STAFF", "VIEWER"])
        expect((await call("post", "/" + item.id, body, role)).status).toBe(
          403,
        );
      expect(
        (await call("post", "/" + item.id, body, "MANAGER", foreign, outsider))
          .status,
      ).toBe(404);
      expect(
        (
          await call(
            "get",
            "/" + item.id + "/history?page=1",
            undefined,
            "VIEWER",
            foreign,
            outsider,
          )
        ).status,
      ).toBe(404);
      for (const change of [
        { orgId: foreign },
        { actorName: "Fake" },
        { priceCents: "15000" },
        { priceCents: -1 },
        { priceCents: 0.5 },
        { durationMinutes: "60" },
        { expectedVersion: "0" },
        { active: "false" },
        { name: "  " },
      ])
        expect(
          (await call("post", "/" + item.id, { ...body, ...change })).status,
        ).toBe(400);
    });
    it("version-controls edits, retries, archive/reactivation and immutable history", async () => {
      const changes = { priceCents: 18000, name: "Visita revisada" };
      const replies = await Promise.all(
        Array.from({ length: 6 }, () => edit(item, changes)),
      );
      for (const r of replies) {
        expect(r.status).toBe(201);
        expect(r.body.version).toBe(1);
      }
      const updated = replies[0].body;
      expect((await edit(item, { priceCents: 19000 })).status).toBe(409);
      expect(
        (await edit(updated, { ...changes, active: false })).body.version,
      ).toBe(2);
      const active = await call("get", "?state=active");
      expect(active.body.total).toBe(0);
      const archived = await call("get", "?state=archived&q=VISITA");
      expect(archived.body.total).toBe(1);
      const history = await call(
        "get",
        "/" + item.id + "/history?page=1",
        undefined,
        "VIEWER",
      );
      expect(history.status).toBe(200);
      expect(history.body.items.map((x) => x.version)).toEqual([2, 1, 0]);
      expect(history.body.items[2].snapshot.priceCents).toBe(15000);
      expect(history.body.items[0].actorName).toBe("Gestora local");
      expect(
        (await edit(archived.body.items[0], { ...changes, active: true })).body
          .version,
      ).toBe(3);
      expect(
        (
          await create({
            ...values,
            entryKey: (
              await db.catalogService.findUnique({ where: { id: item.id } })
            ).entryKey,
          })
        ).body.version,
      ).toBe(3);
      expect(
        await db.auditEvent.count({
          where: { orgId: org, context: "ServiceCatalog" },
        }),
      ).toBe(4);
    });
    it("distinguishes zero from on-request, preserves original currency after organization changes and paginates", async () => {
      for (let i = 0; i < 22; i++) {
        const r = await create({
          ...values,
          code: "ITEM-" + i,
          priceCents: i === 0 ? 0 : null,
          durationMinutes: null,
          entryKey: uuid(),
        });
        expect(r.status).toBe(201);
      }
      const first = await call("get", "?state=all&page=1");
      const second = await call("get", "?state=all&page=2");
      expect(first.body.items).toHaveLength(20);
      expect(second.body.items).toHaveLength(3);
      expect(
        new Set([...first.body.items, ...second.body.items].map((x) => x.id))
          .size,
      ).toBe(23);
      expect((await call("get", "?q=ITEM-0")).body.items[0].priceCents).toBe(0);
      expect(
        (await call("get", "?q=ITEM-1")).body.items.find(
          (x) => x.code === "ITEM-1",
        ).priceCents,
      ).toBeNull();
      await db.organization.update({
        where: { id: org },
        data: { currency: "USD" },
      });
      const current = await db.catalogService.findUnique({
        where: { id: item.id },
      });
      expect(
        (
          await edit(current, {
            priceCents: 20000,
            name: "Preço em moeda original",
          })
        ).body.currency,
      ).toBe("BRL");
      expect(
        (
          await edit(
            { ...current, version: current.version + 1 },
            { expectedCurrency: "USD", priceCents: 100 },
          )
        ).status,
      ).toBe(409);
      expect(
        (
          await create({
            ...values,
            code: "USD-NEW",
            expectedCurrency: "USD",
            entryKey: uuid(),
          })
        ).body.currency,
      ).toBe("USD");
      for (const path of [
        "?page=0",
        "?page=10001",
        "?state=unknown",
        "?page=1.2",
      ])
        expect((await call("get", path)).status).toBe(400);
    });
    it("does not mutate execution or financial tables and restricts deletion of revision history", async () => {
      expect(await db.serviceOrder.count({ where: { orgId: org } })).toBe(0);
      expect(await db.charge.count({ where: { orgId: org } })).toBe(0);
      expect(await db.stockMovement.count({ where: { orgId: org } })).toBe(0);
      await expect(
        db.catalogService.delete({ where: { id: item.id } }),
      ).rejects.toMatchObject({ code: "P2003" });
    });
  },
);
