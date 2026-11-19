import { Test } from "@nestjs/testing";
import {
  ForbiddenException,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { randomUUID as uuid } from "crypto";
import request from "supertest";
import { PrismaService } from "../prisma/prisma.service";
import { QuotasService } from "../quotas/quotas.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  ServiceOrderReturnsController,
  ServiceOrderReturnsService,
} from "./service-order-returns";
const url = "postgresql://nexo@127.0.0.1:55439/postgres";
(process.env.RETURNS_TEST_DATABASE_URL === url ? describe : describe.skip)(
  "Service returns with isolated PostgreSQL",
  () => {
    let db: PrismaClient,
      app: any,
      original: any,
      other: any,
      issue: any,
      otherIssue: any,
      accepted: any,
      returned: any,
      allowed = true;
    const org = uuid(),
      foreign = uuid(),
      actor = uuid(),
      key = uuid();
    const quota = {
      validateQuota: jest.fn(async () => {
        // Admission also needs a pool connection. Concurrent returns must not hold
        // all connections in transactions while waiting for this count.
        await db.serviceOrder.count({ where: { orgId: org } });
        if (!allowed) throw new ForbiddenException("Limite do plano");
      }),
    };
    const api = (
      method: "get" | "post",
      orderId = original.id,
      role = "STAFF",
      query = "",
    ) =>
      request(app.getHttpServer())
        [method](`/service-orders/${orderId}/returns${query}`)
        .set("x-actor", actor)
        .set("x-org", org)
        .set("x-role", role);
    const body = () => ({
      entryKey: uuid(),
      kind: "WARRANTY",
      title: "Avaliar equipamento novamente",
      reason: "Equipamento apresenta ruído após a entrega.",
      sourceAcceptanceId: issue.id,
    });
    beforeAll(async () => {
      db = new PrismaClient({ datasources: { db: { url: url + '?connection_limit=3' } } });
      await db.organization.createMany({
        data: [org, foreign].map((id) => ({
          id,
          slug: id,
          name: "Return test",
        })),
      });
      await db.user.create({
        data: {
          id: actor,
          orgId: org,
          email: actor + "@example.test",
          role: "STAFF",
          active: true,
        },
      });
      const person = await db.person.create({
        data: {
          orgId: org,
          userId: actor,
          name: "Profissional local",
          role: "STAFF",
        },
      });
      const customer = await db.customer.create({
        data: { orgId: org, name: "Local", phone: "11999990000" },
      });
      const foreignCustomer = await db.customer.create({
        data: { orgId: foreign, name: "Other", phone: "11999990000" },
      });
      original = await db.serviceOrder.create({
        data: {
          orgId: org,
          customerId: customer.id,
          title: "Manutenção original",
          status: "DONE",
          amountCents: 10000,
          dueDate: new Date(),
          assignedToPersonId: person.id,
          scheduledFor: new Date(),
        },
      });
      other = await db.serviceOrder.create({
        data: {
          orgId: foreign,
          customerId: foreignCustomer.id,
          title: "Other",
          status: "DONE",
        },
      });
      const charge = await db.charge.create({
        data: {
          orgId: org,
          customerId: customer.id,
          serviceOrderId: original.id,
          amountCents: 10000,
          currency: "BRL",
          dueDate: new Date(),
        },
      });
      await db.payment.create({
        data: {
          orgId: org,
          chargeId: charge.id,
          amountCents: 5000,
          method: "PIX",
        },
      });
      const acceptance = (orgId, order, decision) =>
        db.serviceOrderAcceptance.create({
          data: {
            orgId,
            serviceOrderId: order.id,
            entryKey: uuid(),
            tokenHash: uuid(),
            publicTitle: "Entrega",
            publicSummary: "Resumo da entrega original.",
            companyName: "Local",
            orderVersion: order.updatedAt,
            createdByUserId: actor,
            expiresAt: new Date(Date.now() + 1000000),
            decision,
            responseKey: uuid(),
            respondentName: "Cliente",
            responseNote: "Equipamento ainda apresenta ruído.",
            respondedAt: new Date(),
          },
        });
      issue = await acceptance(org, original, "ISSUE");
      otherIssue = await acceptance(foreign, other, "ISSUE");
      accepted = await acceptance(org, original, "ACCEPTED");
      const module = await Test.createTestingModule({
        controllers: [ServiceOrderReturnsController],
        providers: [
          ServiceOrderReturnsService,
          { provide: PrismaService, useValue: db },
          { provide: QuotasService, useValue: quota },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: (context) => {
            const req = context.switchToHttp().getRequest();
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
          await db.serviceOrderAcceptance.deleteMany({ where });
          await db.serviceOrder.deleteMany({ where });
          await db.customer.deleteMany({ where });
          await db.person.deleteMany({ where });
          await db.user.deleteMany({ where });
          await db.organization.deleteMany({ where: { id } });
        }
        await db.$disconnect();
      }
    });
    it("creates one linked order under concurrent retries and preserves money/context", async () => {
      const payload = { ...body(), entryKey: key };
      const responses = await Promise.all(
        Array.from({ length: 8 }, () => api("post").send(payload)),
      );
      expect(responses.every((r) => r.status === 201)).toBe(true);
      returned = responses[0].body;
      expect(new Set(responses.map((r) => r.body.child.id)).size).toBe(1);
      expect(quota.validateQuota).toHaveBeenCalled();
      expect(quota.validateQuota).toHaveBeenCalledWith(
        org,
        "CREATE_SERVICE_ORDER",
      );
      const child = await db.serviceOrder.findUnique({
        where: { id: returned.child.id },
      });
      expect(child).toMatchObject({
        orgId: org,
        customerId: original.customerId,
        status: "OPEN",
        amountCents: null,
        dueDate: null,
        assignedToPersonId: null,
        scheduledFor: null,
        appointmentId: null,
      });
      expect(
        (await db.serviceOrder.findUnique({ where: { id: original.id } }))
          .status,
      ).toBe("DONE");
      expect(await db.serviceOrder.count({ where: { orgId: org } })).toBe(2);
      expect(await db.charge.count({ where: { orgId: org } })).toBe(1);
      expect(await db.payment.count({ where: { orgId: org } })).toBe(1);
      expect(await db.timelineEvent.count({ where: { orgId: org } })).toBe(2);
      expect(await db.auditEvent.count({ where: { orgId: org } })).toBe(1);
      expect(
        (
          await api("post").send({
            ...payload,
            reason: "Outro motivo diferente",
          })
        ).status,
      ).toBe(409);
      const incoming = (await api("get", child.id)).body.origin;
      expect(incoming.original.id).toBe(original.id);
      expect(incoming.sourceAcceptanceId).toBe(issue.id);
    });
    it("enforces auth, roles, tenant and untrusted source fields", async () => {
      expect(
        (
          await request(app.getHttpServer()).get(
            `/service-orders/${original.id}/returns`,
          )
        ).status,
      ).toBe(401);
      expect((await api("get", original.id, "VIEWER")).status).toBe(200);
      expect(
        (await api("post", original.id, "VIEWER").send(body())).status,
      ).toBe(403);
      expect((await api("post", other.id).send(body())).status).toBe(404);
      expect((await api("get", other.id)).status).toBe(404);
      for (const changed of [
        { customerId: uuid() },
        { orgId: foreign },
        { amountCents: 999 },
        { kind: "FREE" },
        { reason: "   " },
        { title: "  " },
      ])
        expect((await api("post").send({ ...body(), ...changed })).status).toBe(
          400,
        );
      expect(
        (
          await api("post").send({
            ...body(),
            sourceAcceptanceId: otherIssue.id,
          })
        ).status,
      ).toBe(400);
      expect(
        (await api("post").send({ ...body(), sourceAcceptanceId: accepted.id }))
          .status,
      ).toBe(400);
      expect((await api("get", original.id, "STAFF", "?page=0")).status).toBe(
        400,
      );
    });
    it("refuses non-completed sources and respects plan admission without duplicate effects", async () => {
      await db.serviceOrder.update({
        where: { id: original.id },
        data: { status: "IN_PROGRESS" },
      });
      expect((await api("post").send(body())).status).toBe(409);
      await db.serviceOrder.update({
        where: { id: original.id },
        data: { status: "DONE" },
      });
      allowed = false;
      expect((await api("post").send(body())).status).toBe(403);
      // A confirmed old attempt remains recoverable even if admission now denies new work.
      expect(
        (await api("post").send({ ...body(), entryKey: key })).body.child.id,
      ).toBe(returned.child.id);
      expect(await db.serviceOrder.count({ where: { orgId: org } })).toBe(2);
      expect(await db.serviceOrderReturn.count({ where: { orgId: org } })).toBe(
        1,
      );
      allowed = true;
    });
    it("paginates outgoing history and supports rework without an acceptance source", async () => {
      for (let i = 0; i < 10; i++)
        expect(
          (
            await api("post").send({
              ...body(),
              entryKey: uuid(),
              kind: "REWORK",
              sourceAcceptanceId: undefined,
              title: "Retrabalho " + i,
            })
          ).status,
        ).toBe(201);
      const first = (await api("get")).body,
        second = (await api("get", original.id, "STAFF", "?page=2")).body;
      expect(first.total).toBe(11);
      expect(first.pages).toBe(2);
      expect(first.items).toHaveLength(10);
      expect(second.items).toHaveLength(1);
      expect(
        new Set([...first.items, ...second.items].map((item) => item.id)).size,
      ).toBe(11);
      expect(first.issues.map((i) => i.id)).toEqual([issue.id]);
    });
    it("has composite DB constraints for both orders and the linked problem", async () => {
      const saved = await db.serviceOrderReturn.findUnique({
        where: { id: returned.id },
      });
      const child = await db.serviceOrder.create({
        data: {
          orgId: org,
          customerId: original.customerId,
          title: "Constraint fixture",
        },
      });
      await expect(
        db.serviceOrderReturn.create({
          data: {
            ...saved,
            id: uuid(),
            entryKey: uuid(),
            childOrderId: child.id,
            sourceAcceptanceId: otherIssue.id,
          },
        }),
      ).rejects.toMatchObject({ code: "P2003" });
      await expect(
        db.serviceOrderReturn.create({
          data: {
            ...saved,
            id: uuid(),
            entryKey: uuid(),
            childOrderId: child.id,
            originalOrderId: other.id,
            sourceAcceptanceId: null,
          },
        }),
      ).rejects.toMatchObject({ code: "P2003" });
      expect(await db.serviceOrderReturn.count({ where: { orgId: org } })).toBe(
        11,
      );
    });
  },
);
