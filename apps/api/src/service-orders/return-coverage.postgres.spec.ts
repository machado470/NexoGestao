import { Test } from "@nestjs/testing";
import { UnauthorizedException, ValidationPipe } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { randomUUID as uuid } from "crypto";
import request from "supertest";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { QuotasService } from "../quotas/quotas.service";
import {
  ServiceOrderReturnsController,
  ServiceOrderReturnsService,
} from "./service-order-returns";
import { ServiceOrderReadService } from "./service-order-read.service";
import { FinanceService } from "../finance/finance.service";
import { IdempotencyService } from "../common/idempotency/idempotency.service";
const url = "postgresql://nexo@127.0.0.1:55439/postgres";
(process.env.COVERAGE_TEST_DATABASE_URL === url ? describe : describe.skip)(
  "Return coverage with real PostgreSQL",
  () => {
    let db: PrismaClient,
      app: any,
      original: any,
      record: any,
      read: ServiceOrderReadService,
      finance: FinanceService;
    const org = uuid(),
      foreign = uuid(),
      actor = uuid();
    const coverage = (
      body: any,
      item = record,
      role = "MANAGER",
      tenant = org,
    ) =>
      request(app.getHttpServer())
        .post(`/service-orders/${item.original.id}/returns/${item.id}/coverage`)
        .set("x-org", tenant)
        .set("x-actor", actor)
        .set("x-role", role)
        .send(body);
    const newReturn = async () => {
      const response = await request(app.getHttpServer())
        .post(`/service-orders/${original.id}/returns`)
        .set("x-org", org)
        .set("x-actor", actor)
        .set("x-role", "MANAGER")
        .send({
          entryKey: uuid(),
          kind: "WARRANTY",
          title: "Retorno em análise",
          reason: "Equipamento precisa ser conferido novamente.",
        });
      expect(response.status).toBe(201);
      return response.body;
    };
    const charge = (orderId: string) =>
      finance.createCharge({
        orgId: org,
        customerId: original.customerId,
        serviceOrderId: orderId,
        amountCents: 1000,
        dueDate: new Date("2027-01-01T12:00:00Z"),
        idempotencyKey: uuid(),
      });
    beforeAll(async () => {
      db = new PrismaClient({
        datasources: { db: { url: url + "?connection_limit=3" } },
      });
      await db.organization.createMany({
        data: [org, foreign].map((id) => ({
          id,
          slug: id,
          name: "Coverage local",
        })),
      });
      await db.user.create({
        data: {
          id: actor,
          orgId: org,
          email: actor + "@example.test",
          role: "ADMIN",
          active: true,
        },
      });
      const person = await db.person.create({
        data: {
          orgId: org,
          userId: actor,
          name: "Gestor local",
          role: "ADMIN",
        },
      });
      const customer = await db.customer.create({
        data: { orgId: org, name: "Cliente local", phone: "" },
      });
      original = await db.serviceOrder.create({
        data: {
          orgId: org,
          customerId: customer.id,
          title: "Original",
          status: "DONE",
          assignedToPersonId: person.id,
        },
      });
      const originalCharge = await db.charge.create({
        data: {
          orgId: org,
          customerId: customer.id,
          serviceOrderId: original.id,
          amountCents: 10000,
          currency: "BRL",
          dueDate: new Date("2027-01-01"),
        },
      });
      await db.payment.create({
        data: {
          orgId: org,
          chargeId: originalCharge.id,
          amountCents: 5000,
          method: "PIX",
        },
      });
      const module = await Test.createTestingModule({
        controllers: [ServiceOrderReturnsController],
        providers: [
          ServiceOrderReturnsService,
          { provide: PrismaService, useValue: db },
          {
            provide: QuotasService,
            useValue: { validateQuota: async () => {} },
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
      read = new ServiceOrderReadService(db as any);
      const metrics = { increment: jest.fn() },
        ctx = { requestId: "local", correlationId: "local" };
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
      record = await newReturn();
      await db.serviceOrder.update({
        where: { id: record.child.id },
        data: {
          status: "DONE",
          amountCents: 1000,
          assignedToPersonId: person.id,
        },
      });
    });
    afterAll(async () => {
      await app?.close();
      if (db) {
        for (const id of [org, foreign]) {
          const where = { orgId: id };
          await db.serviceOrderReturn.deleteMany({ where });
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
    it("starts pending, blocks both charge producers and offers review rather than collection", async () => {
      expect(record.child.billingTreatment).toBe("RETURN_PENDING");
      await expect(charge(record.child.id)).rejects.toThrow(
        "não permite cobrança",
      );
      await expect(
        finance.ensureChargeForServiceOrderDone({
          orgId: org,
          serviceOrderId: record.child.id,
          customerId: original.customerId,
          amountCents: 1000,
        }),
      ).rejects.toThrow("não permite cobrança");
      const detail = await read.get(org, record.child.id);
      expect(detail.operationalDecision.priority).toBe("P1");
      expect(detail.operationalDecision.nextAction.label).toBe(
        "Definir cobertura do retorno",
      );
      const page = await read.list(org, {
        operationalFilter: "without_charge",
      });
      expect(page.data.some((o) => o.id === record.child.id)).toBe(false);
      const p1 = await read.list(org, { priorityFilter: "P1" });
      expect(p1.data.some((o) => o.id === record.child.id)).toBe(true);
    });
    it("enforces financial roles, tenant scope and strict versions", async () => {
      const body = {
        treatment: "RETURN_COVERED",
        reason: "Cobertura aprovada após avaliação técnica.",
        expectedVersion: 0,
      };
      for (const role of ["STAFF", "VIEWER"])
        expect((await coverage(body, record, role)).status).toBe(403);
      expect((await coverage(body, record, "ADMIN", foreign)).status).toBe(401);
      expect((await coverage({ ...body, expectedVersion: "0" })).status).toBe(
        400,
      );
      expect(
        (
          await coverage({
            ...body,
            billingTreatment: "STANDARD",
            orgId: foreign,
          })
        ).status,
      ).toBe(400);
      expect((await coverage({ ...body, reason: "   " })).status).toBe(400);
    });
    it("approves once under concurrent retries and removes false charge risk", async () => {
      const body = {
        treatment: "RETURN_COVERED",
        reason: "Cobertura aprovada após avaliação técnica.",
        expectedVersion: 0,
      };
      const results = await Promise.all(
        Array.from({ length: 8 }, () => coverage(body)),
      );
      expect(
        results.every((r) => r.status === 201 && r.body.coverageVersion === 1),
      ).toBe(true);
      expect(results[0].body.coverageReviewedByName).toBe("Gestor local");
      expect(
        await db.auditEvent.count({
          where: { orgId: org, context: "ReturnCoverage" },
        }),
      ).toBe(1);
      const detail = await read.get(org, record.child.id);
      expect((detail as any).billingTreatment).toBeUndefined();
      expect(detail.operationalDecision.operationalStatus).toBe("NORMAL");
      expect(detail.operationalDecision.nextAction.type).toBe("select");
      await expect(charge(record.child.id)).rejects.toThrow(
        "não permite cobrança",
      );
      await expect(
        db.charge.create({
          data: {
            orgId: org,
            customerId: original.customerId,
            serviceOrderId: record.child.id,
            amountCents: 1000,
            dueDate: new Date(),
          },
        }),
      ).rejects.toThrow("NEXO_RETURN_BILLING_BLOCKED");
      expect(await db.charge.count({ where: { orgId: org } })).toBe(1);
      expect(await db.payment.count({ where: { orgId: org } })).toBe(1);
    });
    it("revises with history, permits explicit billing and refuses retroactive exemption", async () => {
      const response = await coverage({
        treatment: "RETURN_BILLABLE",
        reason: "Cliente aprovou atendimento fora da cobertura.",
        expectedVersion: 1,
      });
      expect(response.status).toBe(201);
      expect(response.body.coverageVersion).toBe(2);
      expect(await db.charge.count({ where: { orgId: org } })).toBe(1);
      expect(
        (
          await coverage({
            treatment: "RETURN_COVERED",
            reason: "Tentativa antiga não pode sobrescrever.",
            expectedVersion: 0,
          })
        ).status,
      ).toBe(409);
      const detail = await read.get(org, record.child.id);
      expect(detail.operationalDecision.nextAction.type).toBe("charge");
      const created = await charge(record.child.id);
      expect(created.id).toBeTruthy();
      for (const treatment of ["RETURN_COVERED", "RETURN_PENDING"])
        expect(
          (
            await coverage({
              treatment,
              reason: "Não deve cancelar valores já registrados.",
              expectedVersion: 2,
            })
          ).status,
        ).toBe(409);
      await expect(
        db.serviceOrder.update({
          where: { id: record.child.id },
          data: { billingTreatment: "RETURN_COVERED" },
        }),
      ).rejects.toThrow("NEXO_RETURN_BILLING_BLOCKED");
      expect(
        (await db.serviceOrder.findUnique({ where: { id: record.child.id } }))
          .billingTreatment,
      ).toBe("RETURN_BILLABLE");
      expect(
        await db.auditEvent.count({
          where: { orgId: org, context: "ReturnCoverage" },
        }),
      ).toBe(2);
    });
    it("serializes approval versus charge insertion without free service plus a new charge", async () => {
      for (let i = 0; i < 3; i++) {
        const item = await newReturn();
        await db.serviceOrder.update({
          where: { id: item.child.id },
          data: { status: "DONE", amountCents: 1000 },
        });
        expect(
          (
            await coverage(
              {
                treatment: "RETURN_BILLABLE",
                reason: "Condição comercial em avaliação concorrente.",
                expectedVersion: 0,
              },
              item,
            )
          ).status,
        ).toBe(201);
        const outcomes = await Promise.allSettled([
          coverage(
            {
              treatment: "RETURN_COVERED",
              reason: "Cobertura revisada antes da emissão da cobrança.",
              expectedVersion: 1,
            },
            item,
          ),
          charge(item.child.id),
        ]);
        const state = await db.serviceOrder.findUnique({
            where: { id: item.child.id },
          }),
          count = await db.charge.count({
            where: { orgId: org, serviceOrderId: item.child.id },
          });
        expect(state.billingTreatment === "RETURN_COVERED" && count > 0).toBe(
          false,
        );
        expect(state.billingTreatment === "RETURN_COVERED" || count === 1).toBe(
          true,
        );
        expect(outcomes[0].status).toBe("fulfilled");
      }
    });
  },
);
