import { Test } from "@nestjs/testing";
import {
  ForbiddenException,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { randomUUID as uuid } from "crypto";
import request from "supertest";
import { PrismaService } from "../prisma/prisma.service";
import { QuotasService } from "../quotas/quotas.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { QuoteOrderController, QuoteOrderService } from "./quote-order";
import {
  ServiceQuotesController,
  PublicQuoteApprovalController,
  ServiceQuotesService,
} from "./service-quotes";
import {
  ServiceCatalogController,
  ServiceCatalogService,
} from "./service-catalog";
import { FinanceService } from "../finance/finance.service";
import { IdempotencyService } from "../common/idempotency/idempotency.service";
import { ServiceOrderReadService } from "../service-orders/service-order-read.service";
const url = "postgresql://nexo@127.0.0.1:55439/postgres";
(process.env.QUOTE_ORDER_TEST_DATABASE_URL === url ? describe : describe.skip)(
  "Quote to service order with PostgreSQL",
  () => {
    let db: PrismaClient,
      app: any,
      customer: any,
      service: any,
      accepted: any,
      converted: any,
      finance: FinanceService;
    const org = uuid(),
      foreign = uuid(),
      actor = uuid(),
      other = uuid();
    let deny = false;
    const admission = jest.fn(async () => {
      await db.serviceOrder.count({ where: { orgId: org } });
      if (deny) throw new ForbiddenException("Plano não permite nova O.S.");
    });
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
    const convert = (
      quote: any,
      role = "MANAGER",
      body: any = { expectedVersion: quote.version },
    ) => call("post", `/service-quotes/${quote.id}/convert`, body, role);
    async function newQuote(
      total = 12345,
      currency = "BRL",
      source = service,
      approve = true,
    ) {
      const made = await call("post", "/service-quotes", {
        title: "Proposta para conversão",
        conditions:
          "Atendimento agendado após confirmação. Pagamento após execução.",
        expectedCurrency: currency,
        customerId: customer.id,
        entryKey: uuid(),
        items: [
          {
            serviceId: source.id,
            serviceVersion: source.version,
            quantity: 1,
            unitCents: total,
          },
        ],
      });
      expect(made.status).toBe(201);
      if (approve) {
        const link = await call(
          "post",
          `/service-quotes/${made.body.id}/share`,
          { expectedVersion: 0, entryKey: uuid() },
        );
        expect(link.status).toBe(201);
        const response = await request(app.getHttpServer())
          .post("/quote-approval/respond")
          .send({
            token: link.body.token,
            responseKey: uuid(),
            decision: "ACCEPTED",
            respondentName: "Cliente local",
            confirmed: true,
          });
        expect(response.status).toBe(201);
      }
      return made.body;
    }
    beforeAll(async () => {
      db = new PrismaClient({
        datasources: { db: { url: url + "?connection_limit=3" } },
      });
      await db.organization.createMany({
        data: [org, foreign].map((id) => ({
          id,
          slug: id,
          name: "Conversão local",
          currency: "BRL",
        })),
      });
      for (const [id, orgId] of [
        [actor, org],
        [other, foreign],
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
      customer = await db.customer.create({
        data: { orgId: org, name: "Cliente local", phone: "" },
      });
      const module = await Test.createTestingModule({
        controllers: [
          QuoteOrderController,
          ServiceQuotesController,
          PublicQuoteApprovalController,
          ServiceCatalogController,
        ],
        providers: [
          QuoteOrderService,
          ServiceQuotesService,
          ServiceCatalogService,
          { provide: PrismaService, useValue: db },
          { provide: QuotasService, useValue: { validateQuota: admission } },
          {
            provide: ConfigService,
            useValue: new ConfigService({
              JWT_SECRET: "isolated-quote-conversion-secret-not-production",
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
        name: "Visita técnica",
        description: "Descrição aprovada do serviço.",
        priceCents: 12345,
        durationMinutes: 60,
        expectedCurrency: "BRL",
        entryKey: uuid(),
      });
      expect(response.status).toBe(201);
      service = response.body;
      const metrics = { increment: jest.fn() },
        ctx = {
          requestId: "conversion-local",
          correlationId: "conversion-local",
        };
      finance = new FinanceService(
        db as any,
        {} as any,
        {
          log: jest.fn(),
          logInTransaction: jest.fn().mockResolvedValue({ id: "local-event" }),
        } as any,
        { track: jest.fn() } as any,
        ctx as any,
        new IdempotencyService(db as any, ctx as any, metrics as any),
        metrics as any,
        { log: jest.fn() } as any,
        { enqueue: jest.fn() } as any,
      );
      accepted = await newQuote();
    });
    afterAll(async () => {
      await app?.close();
      if (db) {
        for (const id of [org, foreign]) {
          const where = { orgId: id };
          await db.serviceQuoteOrder.deleteMany({ where });
          await db.serviceQuoteApproval.deleteMany({ where });
          await db.serviceQuoteRevision.deleteMany({ where });
          await db.serviceQuote.deleteMany({ where });
          await db.catalogServiceRevision.deleteMany({ where });
          await db.catalogService.deleteMany({ where });
          await db.timelineEvent.deleteMany({ where });
          await db.auditEvent.deleteMany({ where });
          await db.payment.deleteMany({ where });
          await db.charge.deleteMany({ where });
          await db.idempotencyRecord.deleteMany({ where });
          await db.serviceOrder.deleteMany({ where });
          await db.customer.deleteMany({ where });
          await db.person.deleteMany({ where });
          await db.user.deleteMany({ where });
          await db.organization.deleteMany({ where: { id } });
        }
        await db.$disconnect();
      }
    });
    it("requires approval, roles, tenant and exact raw version; never accepts client-owned commercial data", async () => {
      const draft = await newQuote(100, "BRL", service, false);
      expect((await convert(draft)).status).toBe(409);
      for (const role of ["STAFF", "VIEWER"])
        expect((await convert(accepted, role)).status).toBe(403);
      expect(
        (
          await call(
            "post",
            `/service-quotes/${accepted.id}/convert`,
            { expectedVersion: 0 },
            "MANAGER",
            foreign,
            other,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await call(
            "post",
            `/service-quotes/${accepted.id}/convert`,
            { expectedVersion: 0 },
            "MANAGER",
            org,
            "",
          )
        ).status,
      ).toBe(401);
      for (const body of [
        { expectedVersion: "0" },
        { expectedVersion: 0, amountCents: 1 },
        { expectedVersion: 0, customerId: uuid() },
        { expectedVersion: 0, status: "DONE" },
        { expectedVersion: 0, orgId: foreign },
      ])
        expect((await convert(accepted, "MANAGER", body)).status).toBe(400);
      expect(
        (await convert(accepted, "MANAGER", { expectedVersion: 1 })).status,
      ).toBe(409);
      expect(await db.serviceOrder.count({ where: { orgId: org } })).toBe(0);
    });
    it("creates exactly one open order under concurrent retries, without schedule, charge or other effects", async () => {
      const results = await Promise.all(
        Array.from({ length: 8 }, () => convert(accepted)),
      );
      for (const r of results) expect(r.status).toBe(201);
      expect(new Set(results.map((x) => x.body.serviceOrderId)).size).toBe(1);
      converted = results[0].body;
      const order = await db.serviceOrder.findUnique({
        where: { id: converted.serviceOrderId },
      });
      expect(order).toMatchObject({
        customerId: customer.id,
        amountCents: 12345,
        status: "OPEN",
        priority: 2,
        assignedToPersonId: null,
        scheduledFor: null,
        appointmentId: null,
        dueDate: null,
      });
      expect(order.description).toContain("Descrição aprovada do serviço.");
      expect(order.description).toContain(accepted.snapshot.conditions);
      expect(
        await db.serviceQuoteOrder.count({
          where: { orgId: org, quoteId: accepted.id },
        }),
      ).toBe(1);
      expect(
        await db.auditEvent.count({
          where: { orgId: org, context: "QuoteOrderConversion" },
        }),
      ).toBe(1);
      expect(
        await db.timelineEvent.count({
          where: { orgId: org, serviceOrderId: order.id },
        }),
      ).toBe(1);
      expect(await db.charge.count({ where: { orgId: org } })).toBe(0);
      expect(await db.appointment.count({ where: { orgId: org } })).toBe(0);
      const detail = await call("get", "/service-quotes/" + accepted.id);
      expect(detail.body.quote.conversion.serviceOrderId).toBe(order.id);
      const origin = await call(
        "get",
        `/service-orders/${order.id}/quote-origin`,
        undefined,
        "VIEWER",
      );
      expect(origin.status).toBe(200);
      expect(origin.body.origin.snapshot.totalCents).toBe(12345);
      expect(origin.body.origin.createdByName).toBe("Gestora local");
      expect(
        (
          await call(
            "get",
            `/service-orders/${order.id}/quote-origin`,
            undefined,
            "VIEWER",
            foreign,
            other,
          )
        ).status,
      ).toBe(404);
    });
    it("recovers existing conversion even with exhausted plan or canceled order, without making another", async () => {
      const count = admission.mock.calls.length;
      deny = true;
      await db.serviceOrder.update({
        where: { id: converted.serviceOrderId },
        data: { status: "CANCELED" },
      });
      const replay = await convert(accepted);
      expect(replay.status).toBe(201);
      expect(replay.body.serviceOrder.status).toBe("CANCELED");
      expect(replay.body.serviceOrderId).toBe(converted.serviceOrderId);
      expect(admission.mock.calls.length).toBe(count);
      expect(
        (await convert(accepted, "MANAGER", { expectedVersion: 1 })).status,
      ).toBe(409);
      deny = false;
    });
    it("checks plan/customer/currency before writing; stored approval survives access revocation", async () => {
      const quote = await newQuote();
      deny = true;
      expect((await convert(quote)).status).toBe(403);
      deny = false;
      await db.customer.update({
        where: { id: customer.id },
        data: { active: false },
      });
      expect((await convert(quote)).status).toBe(400);
      await db.customer.update({
        where: { id: customer.id },
        data: { active: true },
      });
      await db.organization.update({
        where: { id: org },
        data: { currency: "USD" },
      });
      expect((await convert(quote)).status).toBe(409);
      await db.organization.update({
        where: { id: org },
        data: { currency: "BRL" },
      });
      expect(
        await db.serviceQuoteOrder.count({
          where: { orgId: org, quoteId: quote.id },
        }),
      ).toBe(0);
      const link = await db.serviceQuoteApproval.findFirst({
        where: { orgId: org, quoteId: quote.id },
      });
      await call(
        "post",
        `/service-quotes/${quote.id}/approvals/${link.id}/revoke`,
        {},
      );
      expect((await convert(quote)).status).toBe(201);
    });
    it("supports approved zero orders without fake missing-charge risk or later linked charges", async () => {
      const quote = await newQuote(0),
        result = await convert(quote);
      expect(result.status).toBe(201);
      const id = result.body.serviceOrderId;
      await db.serviceOrder.update({ where: { id }, data: { status: "DONE" } });
      const order = await new ServiceOrderReadService(db as any).get(org, id);
      expect(order.operationalDecision.priority).toBe("P3");
      expect(order.operationalDecision.nextAction.type).toBe("select");
      const without = await new ServiceOrderReadService(db as any).list(org, {
        operationalFilter: "without_charge",
        page: 1,
        limit: 100,
      });
      expect(without.data.some((x) => x.id === id)).toBe(false);
      await expect(
        finance.ensureChargeForServiceOrderDone({
          orgId: org,
          customerId: customer.id,
          serviceOrderId: id,
          amountCents: 1,
        }),
      ).rejects.toThrow("não permite cobrança");
      await expect(
        db.serviceOrder.update({ where: { id }, data: { amountCents: 1 } }),
      ).rejects.toThrow();
      await expect(
        db.charge.create({
          data: {
            orgId: org,
            customerId: customer.id,
            serviceOrderId: id,
            amountCents: 1,
            currency: "BRL",
            dueDate: new Date(),
          },
        }),
      ).rejects.toThrow();
    });
    it("preserves approved amount/currency through both financial writers even after organization currency changes", async () => {
      await db.organization.update({
        where: { id: org },
        data: { currency: "USD" },
      });
      const source = (
        await call("post", "/service-catalog", {
          code: "USD",
          name: "Serviço USD",
          description: "Serviço em moeda USD.",
          priceCents: 10000,
          durationMinutes: 30,
          expectedCurrency: "USD",
          entryKey: uuid(),
        })
      ).body;
      const first = (await convert(await newQuote(10000, "USD", source))).body,
        second = (await convert(await newQuote(10000, "USD", source))).body;
      await db.organization.update({
        where: { id: org },
        data: { currency: "BRL" },
      });
      for (const item of [first, second])
        await db.serviceOrder.update({
          where: { id: item.serviceOrderId },
          data: { status: "DONE" },
        });
      const input = {
        orgId: org,
        customerId: customer.id,
        serviceOrderId: first.serviceOrderId,
        amountCents: 10000,
        dueDate: new Date("2027-01-01"),
      };
      await expect(
        finance.ensureChargeForServiceOrderDone({
          ...input,
          amountCents: 9999,
        }),
      ).rejects.toThrow("orçamento aprovado");
      expect(
        (await finance.ensureChargeForServiceOrderDone(input)).created,
      ).toBe(true);
      expect(
        (
          await db.charge.findFirst({
            where: { orgId: org, serviceOrderId: first.serviceOrderId },
          })
        ).currency,
      ).toBe("USD");
      await expect(
        finance.createCharge({
          ...input,
          serviceOrderId: second.serviceOrderId,
          amountCents: 9999,
          idempotencyKey: uuid(),
        }),
      ).rejects.toThrow("orçamento aprovado");
      const charge = await finance.createCharge({
        ...input,
        serviceOrderId: second.serviceOrderId,
        idempotencyKey: uuid(),
      });
      expect(charge.currency).toBe("USD");
      await expect(
        db.charge.update({
          where: { id: charge.id },
          data: { currency: "BRL" },
        }),
      ).rejects.toThrow();
      await expect(
        db.charge.update({
          where: { id: charge.id },
          data: { amountCents: 9999 },
        }),
      ).rejects.toThrow();
    });
    it("protects the commercial link and order fields against alternate SQL paths; preserves ordinary orders", async () => {
      await expect(
        db.serviceQuoteOrder.update({
          where: { serviceOrderId: converted.serviceOrderId },
          data: { amountCents: 1 },
        }),
      ).rejects.toThrow();
      await expect(
        db.serviceOrder.update({
          where: { id: converted.serviceOrderId },
          data: { amountCents: 1 },
        }),
      ).rejects.toThrow();
      await expect(
        db.serviceOrder.update({
          where: { id: converted.serviceOrderId },
          data: { billingTreatment: "RETURN_COVERED" },
        }),
      ).rejects.toThrow();
      await expect(
        db.serviceOrder.delete({ where: { id: converted.serviceOrderId } }),
      ).rejects.toMatchObject({ code: "P2003" });
      const plain = await db.serviceOrder.create({
        data: {
          orgId: org,
          customerId: customer.id,
          title: "Ordem sem orçamento",
          amountCents: 100,
        },
      });
      await db.serviceOrder.update({
        where: { id: plain.id },
        data: { amountCents: 200 },
      });
      expect(
        (await call("get", `/service-orders/${plain.id}/quote-origin`)).body
          .origin,
      ).toBeNull();
    });
    it("resolves currency in one tenant-scoped batch without changing legacy BRL or disclosing foreign orders", async () => {
      const quoteRows = await db.serviceQuoteOrder.findMany({
        where: { orgId: org },
        select: { serviceOrderId: true, currency: true },
      });
      const plain = await db.serviceOrder.create({
        data: {
          orgId: org,
          customerId: customer.id,
          title: "Valor legado",
          amountCents: 12345,
        },
      });
      const fromCharge = await db.serviceOrder.create({
        data: {
          orgId: org,
          customerId: customer.id,
          title: "Valor da cobrança",
          amountCents: null,
        },
      });
      await db.charge.create({
        data: {
          orgId: org,
          customerId: customer.id,
          serviceOrderId: fromCharge.id,
          amountCents: 1000,
          currency: "EUR",
          dueDate: new Date(),
        },
      });
      const foreignCustomer = await db.customer.create({
          data: { orgId: foreign, name: "Cliente externo", phone: "" },
        }),
        outside = await db.serviceOrder.create({
          data: {
            orgId: foreign,
            customerId: foreignCustomer.id,
            title: "Externa",
          },
        });
      const ids = [
        ...quoteRows.map((x) => x.serviceOrderId),
        plain.id,
        fromCharge.id,
        outside.id,
      ];
      for (const role of ["MANAGER", "STAFF", "VIEWER"]) {
        const result = await call(
          "post",
          "/service-orders/currency-context",
          { serviceOrderIds: ids },
          role,
        );
        expect(result.status).toBe(201);
        for (const row of quoteRows)
          expect(
            result.body.items.find(
              (x) => x.serviceOrderId === row.serviceOrderId,
            ),
          ).toMatchObject({ currency: row.currency, source: "QUOTE" });
        expect(
          result.body.items.find((x) => x.serviceOrderId === plain.id),
        ).toMatchObject({ currency: "BRL", source: "LEGACY_BRL" });
        expect(
          result.body.items.find((x) => x.serviceOrderId === fromCharge.id),
        ).toMatchObject({ currency: "EUR", source: "CHARGE" });
        expect(
          result.body.items.some((x) => x.serviceOrderId === outside.id),
        ).toBe(false);
      }
      expect(
        (
          await call("post", "/service-orders/currency-context", {
            serviceOrderIds: ids,
            orgId: foreign,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await call("post", "/service-orders/currency-context", {
            serviceOrderIds: ["invalid"],
          })
        ).status,
      ).toBe(400);
    });
  },
);
