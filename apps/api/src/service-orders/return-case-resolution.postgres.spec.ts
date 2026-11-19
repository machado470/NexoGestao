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
const url = "postgresql://nexo@127.0.0.1:55439/postgres";
(process.env.RETURN_CASE_TEST_DATABASE_URL === url ? describe : describe.skip)(
  "Return case resolution with PostgreSQL",
  () => {
    let db: PrismaClient, app: any, original: any, customer: any;
    const org = uuid(),
      foreign = uuid(),
      actor = uuid();
    const post = (
      item: any,
      path: string,
      body: any,
      role = "MANAGER",
      tenant = org,
      actorId: string = actor,
    ) =>
      request(app.getHttpServer())
        .post(`/service-orders/${item.original.id}/returns/${item.id}/${path}`)
        .set("x-org", tenant)
        .set("x-actor", actorId)
        .set("x-role", role)
        .send(body);
    const state = (
      item: any,
      version = 0,
      value = "CLOSED",
      reason = "Atendimento revisado e acompanhamento finalizado.",
    ) =>
      post(item, "state", { state: value, expectedVersion: version, reason });
    const coverage = (item: any, version = 0, treatment = "RETURN_COVERED") =>
      post(item, "coverage", {
        treatment,
        expectedVersion: version,
        reason: "Avaliação comercial registrada pelo gestor.",
      });
    async function create(status = "OPEN") {
      const response = await request(app.getHttpServer())
        .post(`/service-orders/${original.id}/returns`)
        .set("x-org", org)
        .set("x-actor", actor)
        .set("x-role", "MANAGER")
        .send({
          entryKey: uuid(),
          kind: "WARRANTY",
          title: "Retorno local",
          reason: "Revisar equipamento após visita inicial.",
        });
      expect(response.status).toBe(201);
      if (status !== "OPEN")
        await db.serviceOrder.update({
          where: { id: response.body.child.id },
          data: { status: status as any },
        });
      return response.body;
    }
    beforeAll(async () => {
      db = new PrismaClient({
        datasources: { db: { url: url + "?connection_limit=3" } },
      });
      await db.organization.createMany({
        data: [org, foreign].map((id) => ({
          id,
          slug: id,
          name: "Case resolution local",
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
      await db.person.create({
        data: {
          orgId: org,
          userId: actor,
          name: "Gestora local",
          role: "ADMIN",
        },
      });
      customer = await db.customer.create({
        data: { orgId: org, name: "Cliente local", phone: "" },
      });
      original = await db.serviceOrder.create({
        data: {
          orgId: org,
          customerId: customer.id,
          title: "Original",
          status: "DONE",
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
          await db.serviceOrder.deleteMany({ where });
          await db.customer.deleteMany({ where });
          await db.person.deleteMany({ where });
          await db.user.deleteMany({ where });
          await db.organization.deleteMany({ where: { id } });
        }
        await db.$disconnect();
      }
    });
    it("requires terminal execution and commercial review, rejects forged fields/roles/tenants", async () => {
      const item = await create();
      expect(item.caseState).toBe("ACTIVE");
      expect(item.caseVersion).toBe(0);
      expect((await state(item)).status).toBe(409);
      for (const status of ["ASSIGNED", "IN_PROGRESS"]) {
        await db.serviceOrder.update({
          where: { id: item.child.id },
          data: { status: status as any },
        });
        expect((await state(item)).status).toBe(409);
      }
      await db.serviceOrder.update({
        where: { id: item.child.id },
        data: { status: "DONE" },
      });
      expect((await state(item)).status).toBe(409);
      const body = {
        state: "CLOSED",
        expectedVersion: 0,
        reason: "Revisão do acompanhamento concluída.",
      };
      for (const role of ["STAFF", "VIEWER"])
        expect((await post(item, "state", body, role)).status).toBe(403);
      expect((await post(item, "state", body, "MANAGER", foreign)).status).toBe(
        401,
      );
      expect(
        (await post({ ...item, original: { id: uuid() } }, "state", body))
          .status,
      ).toBe(404);
      expect((await post(item, "state", body, "MANAGER", org, "")).status).toBe(
        401,
      );
      for (const change of [
        { orgId: org },
        { caseReviewedByName: "Fake" },
        { state: "DONE" },
        { expectedVersion: "0" },
        { reason: "     " },
      ])
        expect((await post(item, "state", { ...body, ...change })).status).toBe(
          400,
        );
    });
    it("closes once under concurrent retries with review metadata and preserves execution, money and acceptance version", async () => {
      const item = await create("DONE");
      expect((await coverage(item, 0, "RETURN_BILLABLE")).status).toBe(201);
      const charge = await db.charge.create({
        data: {
          orgId: org,
          customerId: customer.id,
          serviceOrderId: item.child.id,
          amountCents: 1000,
          dueDate: new Date("2027-01-01"),
          currency: "BRL",
        },
      });
      const payment = await db.payment.create({
        data: {
          orgId: org,
          chargeId: charge.id,
          amountCents: 500,
          method: "PIX",
        },
      });
      const before = await db.serviceOrder.findUnique({
        where: { id: item.child.id },
      });
      const results = await Promise.all(
        Array.from({ length: 8 }, () => state(item)),
      );
      for (const result of results) {
        expect(result.status).toBe(201);
        expect(result.body.caseState).toBe("CLOSED");
        expect(result.body.caseVersion).toBe(1);
        expect(result.body.caseReviewedByName).toBe("Gestora local");
        expect(result.body.caseReviewedAt).toBeTruthy();
      }
      expect(
        await db.auditEvent.count({
          where: {
            orgId: org,
            context: "ReturnCaseState",
            metadata: { path: ["returnCaseId"], equals: item.id },
          },
        }),
      ).toBe(1);
      expect(
        await db.timelineEvent.count({
          where: {
            orgId: org,
            metadata: { path: ["returnCaseId"], equals: item.id },
            description: { startsWith: "Acompanhamento do retorno" },
          },
        }),
      ).toBe(2);
      expect(
        await db.serviceOrder.findUnique({ where: { id: item.child.id } }),
      ).toEqual(before);
      expect(
        await db.payment.findUnique({ where: { id: payment.id } }),
      ).toEqual(payment);
      expect(await db.charge.findUnique({ where: { id: charge.id } })).toEqual(
        charge,
      );
    });
    it("requires reopening before coverage revision, preserves history, rejects stale versions", async () => {
      const item = await create("DONE");
      await coverage(item);
      await state(item);
      expect((await coverage(item, 1, "RETURN_BILLABLE")).status).toBe(409);
      expect(
        (
          await state(
            item,
            0,
            "ACTIVE",
            "Cliente solicitou outra revisão do atendimento.",
          )
        ).status,
      ).toBe(409);
      const reopened = await state(
        item,
        1,
        "ACTIVE",
        "Cliente solicitou outra revisão do atendimento.",
      );
      expect(reopened.status).toBe(201);
      expect(reopened.body.caseVersion).toBe(2);
      expect(
        (
          await state(
            item,
            1,
            "ACTIVE",
            "Cliente solicitou outra revisão do atendimento.",
          )
        ).body.caseVersion,
      ).toBe(2);
      expect((await coverage(item, 1, "RETURN_BILLABLE")).status).toBe(201);
      expect((await state(item, 0)).status).toBe(409);
      expect((await state(item, 2)).status).toBe(201);
      expect(
        await db.auditEvent.count({
          where: {
            orgId: org,
            context: "ReturnCaseState",
            metadata: { path: ["returnCaseId"], equals: item.id },
          },
        }),
      ).toBe(3);
      const list = await request(app.getHttpServer())
        .get(`/service-orders/${item.child.id}/returns?page=1`)
        .set("x-org", org)
        .set("x-actor", actor)
        .set("x-role", "VIEWER");
      expect(list.status).toBe(200);
      expect(list.body.origin.caseState).toBe("CLOSED");
    });
    it("allows reviewed cancellation without pretending the service was delivered", async () => {
      const item = await create("CANCELED");
      const response = await state(
        item,
        0,
        "CLOSED",
        "Cliente desistiu; retorno cancelado sem execução.",
      );
      expect(response.status).toBe(201);
      expect(response.body.child.status).toBe("CANCELED");
      expect(response.body.child.billingTreatment).toBe("RETURN_PENDING");
      expect(
        await db.serviceOrderAcceptance.count({
          where: { orgId: org, serviceOrderId: item.child.id },
        }),
      ).toBe(0);
    });
    it("serializes closing against a commercial revision to pending", async () => {
      for (let i = 0; i < 4; i++) {
        const item = await create("DONE");
        await coverage(item);
        const results = await Promise.all([
          state(item),
          coverage(item, 1, "RETURN_PENDING"),
        ]);
        expect(results.map((x) => x.status).sort()).toEqual([201, 409]);
        const persisted = await db.serviceOrderReturn.findUnique({
          where: { id: item.id },
          include: { child: true },
        });
        expect(
          persisted.caseState === "CLOSED" &&
            persisted.child.billingTreatment === "RETURN_PENDING",
        ).toBe(false);
      }
    });
  },
);
