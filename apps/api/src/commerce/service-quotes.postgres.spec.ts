import { Test } from "@nestjs/testing";
import { UnauthorizedException, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { randomUUID as uuid, createHash } from "crypto";
import request from "supertest";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  ServiceQuotesController,
  PublicQuoteApprovalController,
  ServiceQuotesService,
} from "./service-quotes";
import {
  ServiceCatalogController,
  ServiceCatalogService,
} from "./service-catalog";
const url = "postgresql://nexo@127.0.0.1:55439/postgres";
(process.env.QUOTES_TEST_DATABASE_URL === url ? describe : describe.skip)(
  "Versioned service quotes with PostgreSQL",
  () => {
    let db: PrismaClient,
      app: any,
      customer: any,
      otherCustomer: any,
      service: any,
      current: any,
      quote: any;
    const org = uuid(),
      foreign = uuid(),
      actor = uuid(),
      otherActor = uuid();
    const call = (
      method: string,
      path: string,
      body?: any,
      role = "MANAGER",
      tenant = org,
      userId: string = actor,
    ) =>
      request(app.getHttpServer())
        [method](path)
        .set("x-org", tenant)
        .set("x-actor", userId)
        .set("x-role", role)
        .send(body);
    const pub = (path: string, body: any) =>
      request(app.getHttpServer())
        .post("/quote-approval/" + path)
        .send(body);
    const values = () => ({
      title: "Manutenção preventiva",
      conditions: "Atendimento em horário comercial. Pagamento após execução.",
      expectedCurrency: "BRL",
      items: [
        {
          serviceId: current.id,
          serviceVersion: current.version,
          quantity: 2,
          unitCents: 15000,
        },
      ],
    });
    const create = (changes: any = {}) =>
      call("post", "/service-quotes", {
        ...values(),
        customerId: customer.id,
        entryKey: uuid(),
        ...changes,
      });
    const share = (item: any, key = uuid()) =>
      call("post", `/service-quotes/${item.id}/share`, {
        expectedVersion: item.version,
        entryKey: key,
      });
    const revise = (item: any, changes: any = {}) =>
      call("post", `/service-quotes/${item.id}/revise`, {
        ...values(),
        items: item.snapshot.items.map(
          ({ serviceId, serviceVersion, quantity, unitCents }) => ({
            serviceId,
            serviceVersion,
            quantity,
            unitCents,
          }),
        ),
        expectedVersion: item.version,
        reason: "Revisão comercial solicitada pelo cliente.",
        ...changes,
      });
    const answer = (token: string, changes: any = {}) =>
      pub("respond", {
        token,
        responseKey: uuid(),
        decision: "ACCEPTED",
        respondentName: "Cliente local",
        confirmed: true,
        ...changes,
      });
    beforeAll(async () => {
      db = new PrismaClient({
        datasources: { db: { url: url + "?connection_limit=3" } },
      });
      await db.organization.createMany({
        data: [org, foreign].map((id) => ({
          id,
          slug: id,
          name: "Empresa dos orçamentos",
          currency: "BRL",
        })),
      });
      for (const [id, orgId] of [
        [actor, org],
        [otherActor, foreign],
      ]) {
        await db.user.create({
          data: {
            id,
            orgId,
            email: id + "@example.test",
            role: "ADMIN",
            active: true,
          },
        });
        await db.person.create({
          data: { orgId, userId: id, name: "Gestora local", role: "ADMIN" },
        });
      }
      customer = await db.customer.create({
        data: {
          orgId: org,
          name: "Cliente privado",
          phone: "11999990000",
          email: "private@example.test",
        },
      });
      otherCustomer = await db.customer.create({
        data: { orgId: foreign, name: "Outra empresa", phone: "" },
      });
      const module = await Test.createTestingModule({
        controllers: [
          ServiceQuotesController,
          PublicQuoteApprovalController,
          ServiceCatalogController,
        ],
        providers: [
          ServiceQuotesService,
          ServiceCatalogService,
          { provide: PrismaService, useValue: db },
          {
            provide: ConfigService,
            useValue: new ConfigService({
              JWT_SECRET: "isolated-quotes-test-secret-not-production",
            }),
          },
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
      const response = await call("post", "/service-catalog", {
        code: "VISITA",
        name: "Visita técnica original",
        description: "Avaliação do equipamento.",
        priceCents: 15000,
        durationMinutes: 60,
        expectedCurrency: "BRL",
        entryKey: uuid(),
      });
      expect(response.status).toBe(201);
      service = current = response.body;
    });
    afterAll(async () => {
      await app?.close();
      if (db) {
        for (const id of [org, foreign]) {
          const where = { orgId: id };
          await db.serviceQuoteApproval.deleteMany({ where });
          await db.serviceQuoteRevision.deleteMany({ where });
          await db.serviceQuote.deleteMany({ where });
          await db.catalogServiceRevision.deleteMany({ where });
          await db.catalogService.deleteMany({ where });
          await db.auditEvent.deleteMany({ where });
          await db.timelineEvent.deleteMany({ where });
          await db.customer.deleteMany({ where });
          await db.person.deleteMany({ where });
          await db.user.deleteMany({ where });
          await db.organization.deleteMany({ where: { id } });
        }
        await db.$disconnect();
      }
    });
    it("creates once and calculates integer totals, snapshots and currency on the server", async () => {
      const body = { ...values(), customerId: customer.id, entryKey: uuid() };
      const results = await Promise.all(
        Array.from({ length: 8 }, () => call("post", "/service-quotes", body)),
      );
      for (const result of results) {
        expect(result.status).toBe(201);
        expect(result.body.snapshot.totalCents).toBe(30000);
        expect(result.body.snapshot.items[0].name).toBe(service.name);
        expect(result.body.orgId).toBeUndefined();
      }
      expect(new Set(results.map((x) => x.body.id)).size).toBe(1);
      quote = results[0].body;
      expect(
        await db.serviceQuoteRevision.count({ where: { orgId: org } }),
      ).toBe(1);
      expect(
        (
          await call("post", "/service-quotes", {
            ...body,
            title: "Conteúdo diferente",
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await create({
            items: [
              { ...values().items[0], quantity: 1000, unitCents: 2147483647 },
            ],
          })
        ).status,
      ).toBe(400);
      expect(
        (await create({ items: [{ ...values().items[0], unitCents: 0 }] })).body
          .snapshot.totalCents,
      ).toBe(0);
    });
    it("enforces roles, tenant, input types and server-owned totals", async () => {
      for (const role of ["STAFF", "VIEWER"]) {
        expect(
          (
            await call(
              "post",
              "/service-quotes",
              { ...values(), customerId: customer.id, entryKey: uuid() },
              role,
            )
          ).status,
        ).toBe(403);
        expect(
          (await call("get", "/service-quotes", undefined, role)).status,
        ).toBe(200);
      }
      expect(
        (await call("get", "/service-quotes", undefined, "MANAGER", org, ""))
          .status,
      ).toBe(401);
      expect(
        (
          await call(
            "get",
            "/service-quotes/" + quote.id,
            undefined,
            "VIEWER",
            foreign,
            otherActor,
          )
        ).status,
      ).toBe(404);
      expect((await create({ customerId: otherCustomer.id })).status).toBe(400);
      for (const change of [
        { orgId: foreign },
        { totalCents: 1 },
        { status: "ACCEPTED" },
        { customerName: "Forged" },
        { items: [] },
        { items: [{ ...values().items[0], quantity: "2" }] },
        { items: [{ ...values().items[0], unitCents: "1" }] },
        { items: [{ ...values().items[0], serviceVersion: "0" }] },
        { items: [{ ...values().items[0], name: "Forged" }] },
      ])
        expect((await create(change)).status).toBe(400);
    });
    it("preserves catalog snapshots, records revisions and revokes superseded links", async () => {
      const before = await share(quote);
      expect(before.status).toBe(201);
      const updated = await call("post", "/service-catalog/" + service.id, {
        code: service.code,
        name: "Serviço renomeado",
        description: "Descrição nova",
        priceCents: 25000,
        durationMinutes: 90,
        expectedCurrency: "BRL",
        active: false,
        expectedVersion: 0,
        reason: "Serviço atualizado no catálogo comercial.",
      });
      expect(updated.status).toBe(201);
      current = updated.body;
      expect(
        (await pub("view", { token: before.body.token })).body.items[0].name,
      ).toBe(service.name);
      expect(
        (await create({ items: [{ ...values().items[0], serviceVersion: 0 }] }))
          .status,
      ).toBe(409);
      const revised = await revise(quote, {
        conditions:
          "Novas condições: atendimento aos sábados com preço combinado.",
      });
      expect(revised.status).toBe(201);
      expect(revised.body.snapshot.items[0].name).toBe(service.name);
      expect(revised.body.snapshot.totalCents).toBe(30000);
      quote = revised.body;
      expect((await pub("view", { token: before.body.token })).status).toBe(
        404,
      );
      expect(
        (
          await revise(
            { ...quote, version: 0 },
            { title: "Revisão desatualizada" },
          )
        ).status,
      ).toBe(409);
      const detail = await call(
        "get",
        "/service-quotes/" + quote.id + "?page=1",
      );
      expect(detail.body.revisions.map((x) => x.version)).toEqual([1, 0]);
      expect(detail.body.revisions[1].snapshot.items[0].name).toBe(
        service.name,
      );
    });
    it("shares idempotently, revokes previous access and exposes only the reviewed public proposal", async () => {
      const key = uuid(),
        links = await Promise.all(
          Array.from({ length: 5 }, () => share(quote, key)),
        );
      for (const result of links) expect(result.status).toBe(201);
      expect(new Set(links.map((x) => x.body.token)).size).toBe(1);
      const first = links[0].body;
      const raw = await db.serviceQuoteApproval.findUnique({
        where: { id: first.id },
      });
      expect(raw.tokenHash).toBe(
        createHash("sha256").update(first.token).digest("hex"),
      );
      expect(raw.tokenHash).not.toBe(first.token);
      const view = await pub("view", { token: first.token });
      expect(view.status).toBe(201);
      expect(view.headers["cache-control"]).toContain("no-store");
      expect(view.body.totalCents).toBe(30000);
      for (const key of [
        "customerId",
        "customerName",
        "orgId",
        "respondentName",
        "entryKey",
        "tokenHash",
      ])
        expect(view.body[key]).toBeUndefined();
      expect(view.body.items[0].serviceId).toBeUndefined();
      const second = await share(quote);
      expect((await pub("view", { token: first.token })).status).toBe(404);
      expect((await pub("view", { token: second.body.token })).status).toBe(
        201,
      );
      expect(
        (
          await call(
            "post",
            `/service-quotes/${quote.id}/approvals/${second.body.id}/revoke`,
            {},
          )
        ).status,
      ).toBe(201);
      expect((await pub("view", { token: second.body.token })).status).toBe(
        404,
      );
      const third = await share(quote);
      await db.serviceQuoteApproval.update({
        where: { id: third.body.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect((await answer(third.body.token)).status).toBe(404);
    });
    it("records refusal and acceptance once, preserves approved terms and rejects forged confirmation", async () => {
      const shared = await share(quote),
        token = shared.body.token;
      for (const change of [
        { confirmed: false },
        { confirmed: "true" },
        { decision: "PAID" },
        { orgId: foreign },
        { respondentName: "  " },
      ])
        expect((await answer(token, change)).status).toBe(400);
      expect(
        (await answer(token, { decision: "REJECTED", responseNote: "curto" }))
          .status,
      ).toBe(400);
      const responseKey = uuid();
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          answer(token, {
            responseKey,
            decision: "REJECTED",
            responseNote: "Solicito mudança no horário do atendimento.",
          }),
        ),
      );
      for (const result of results) {
        expect(result.status).toBe(201);
        expect(result.body.decision).toBe("REJECTED");
      }
      expect((await answer(token)).status).toBe(409);
      expect((await share(quote)).status).toBe(409);
      const revision = await revise(quote, {
        conditions:
          "Revisado para atendimento no horário solicitado pelo cliente.",
      });
      expect(revision.status).toBe(201);
      quote = revision.body;
      const approved = await share(quote),
        key = uuid(),
        accepted = await Promise.all(
          Array.from({ length: 5 }, () =>
            answer(approved.body.token, { responseKey: key }),
          ),
        );
      for (const r of accepted) {
        expect(r.status).toBe(201);
        expect(r.body.decision).toBe("ACCEPTED");
      }
      expect((await revise(quote)).status).toBe(409);
      expect((await share(quote)).status).toBe(409);
      const detail = await call("get", "/service-quotes/" + quote.id);
      expect(detail.body.quote.status).toBe("ACCEPTED");
      expect(
        detail.body.approvals.find((x) => x.id === approved.body.id)
          .respondentName,
      ).toBe("Cliente local");
      expect(JSON.stringify(detail.body)).not.toContain("tokenHash");
      expect(
        await db.auditEvent.count({
          where: {
            orgId: org,
            metadata: { path: ["approvalId"], equals: approved.body.id },
            context: "ServiceQuote",
          },
        }),
      ).toBe(2);
    });
    it("serializes approval against revision and revocation without accepting superseded terms", async () => {
      // Re-enable for new proposals; previously recorded quotes still retain the original service snapshot.
      const reopened = await call("post", "/service-catalog/" + current.id, {
        code: current.code,
        name: current.name,
        description: current.description,
        priceCents: current.priceCents,
        durationMinutes: current.durationMinutes,
        expectedCurrency: "BRL",
        active: true,
        expectedVersion: current.version,
        reason: "Serviço reativado para novas propostas.",
      });
      current = reopened.body;
      for (let i = 0; i < 3; i++) {
        const created = await create();
        expect(created.status).toBe(201);
        const q = created.body,
          link = await share(q);
        const [response, revision] = await Promise.all([
          answer(link.body.token),
          revise(q, { title: "Nova proposta revisada" }),
        ]);
        expect([201, 404, 409]).toContain(response.status);
        expect([201, 409]).toContain(revision.status);
        const persisted = await db.serviceQuote.findUnique({
          where: { id: q.id },
        });
        if (response.status === 201) {
          expect(revision.status).toBe(409);
          expect(persisted.status).toBe("ACCEPTED");
          expect(persisted.version).toBe(0);
        } else {
          expect(revision.status).toBe(201);
          expect(persisted.version).toBe(1);
          expect(persisted.status).toBe("DRAFT");
        }
      }
      const q = (await create()).body,
        link = (await share(q)).body;
      const results = await Promise.all([
        answer(link.token),
        call("post", `/service-quotes/${q.id}/approvals/${link.id}/revoke`, {}),
      ]);
      expect(results[1].status).toBe(201);
      const stored = await db.serviceQuoteApproval.findUnique({
        where: { id: link.id },
      });
      expect(stored.revokedAt).toBeTruthy();
      if (results[0].status === 201) expect(stored.decision).toBe("ACCEPTED");
      else {
        expect(results[0].status).toBe(404);
        expect(stored.decision).toBeNull();
      }
    });
    it("does not produce orders, payments or stock, and protects revision/link references", async () => {
      expect(await db.serviceOrder.count({ where: { orgId: org } })).toBe(0);
      expect(await db.charge.count({ where: { orgId: org } })).toBe(0);
      expect(await db.stockMovement.count({ where: { orgId: org } })).toBe(0);
      await expect(
        db.serviceQuote.delete({ where: { id: quote.id } }),
      ).rejects.toMatchObject({ code: "P2003" });
    });
  },
);
