import { Test } from "@nestjs/testing";
import { UnauthorizedException, ValidationPipe } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { randomUUID as uuid } from "crypto";
import request from "supertest";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  ServiceOrderChecklistController,
  ServiceOrderChecklistService,
} from "./service-order-checklist";
const url = "postgresql://nexo@127.0.0.1:55439/postgres";
(process.env.CHECKLIST_TEST_DATABASE_URL === url ? describe : describe.skip)(
  "Checklist with isolated PostgreSQL",
  () => {
    let app: any, db: PrismaClient, order: any, foreignOrder: any, item: any;
    const org = uuid(),
      foreign = uuid(),
      actor = uuid(),
      key = uuid();
    const api = (
      method: "get" | "post",
      path = "",
      role = "STAFF",
      orderId = order.id,
      tenant = org,
      personId = "",
    ) =>
      request(app.getHttpServer())
        [method](`/service-orders/${orderId}/checklist${path}`)
        .set("x-actor", actor)
        .set("x-org", tenant)
        .set("x-role", role)
        .set("x-person", personId);
    const change = (
      completed: boolean,
      expectedVersion: number,
      reason?: string,
    ) =>
      api("post", `/${item.id}/state`).send({
        completed,
        expectedVersion,
        reason,
      });
    beforeAll(async () => {
      db = new PrismaClient({ datasources: { db: { url } } });
      await db.organization.createMany({
        data: [org, foreign].map((id) => ({
          id,
          slug: id,
          name: "Checklist test",
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
      await db.person.create({
        data: {
          orgId: org,
          name: "Profissional local",
          role: "STAFF",
          userId: actor,
        },
      });
      const customer = await db.customer.create({
        data: { orgId: org, name: "Local", phone: "11999990000" },
      });
      const other = await db.customer.create({
        data: { orgId: foreign, name: "Other", phone: "11999990000" },
      });
      order = await db.serviceOrder.create({
        data: { orgId: org, customerId: customer.id, title: "Local" },
      });
      foreignOrder = await db.serviceOrder.create({
        data: { orgId: foreign, customerId: other.id, title: "Other" },
      });
      const module = await Test.createTestingModule({
        controllers: [ServiceOrderChecklistController],
        providers: [
          ServiceOrderChecklistService,
          { provide: PrismaService, useValue: db },
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
              personId: req.headers["x-person"],
            };
            return true;
          },
        })
        .compile();
      app = module.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
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
          await db.serviceOrderChecklistItem.deleteMany({ where });
          await db.timelineEvent.deleteMany({ where });
          await db.auditEvent.deleteMany({ where });
          await db.serviceOrder.deleteMany({ where });
          await db.customer.deleteMany({ where });
          await db.person.deleteMany({ where });
          await db.user.deleteMany({ where });
          await db.organization.deleteMany({ where: { id } });
        }
        await db.$disconnect();
      }
    });
    it("creates once under concurrent retries and rejects changed payload", async () => {
      const responses = await Promise.all(
        Array.from({ length: 8 }, () =>
          api("post").send({
            entryKey: key,
            title: "  Testar funcionamento  ",
          }),
        ),
      );
      expect(responses.every((r) => r.status === 201)).toBe(true);
      item = responses[0].body;
      expect(new Set(responses.map((r) => r.body.id)).size).toBe(1);
      expect(item.title).toBe("Testar funcionamento");
      expect(item.completed).toBe(false);
      expect(
        await db.serviceOrderChecklistItem.count({ where: { orgId: org } }),
      ).toBe(1);
      expect(await db.timelineEvent.count({ where: { orgId: org } })).toBe(1);
      expect(
        (await api("post").send({ entryKey: key, title: "Outra tarefa" }))
          .status,
      ).toBe(409);
      expect((await change(true, 0)).status).toBe(409); // Not started.
    });
    it("enforces role, tenant, auth and DTO validation", async () => {
      expect(
        (
          await request(app.getHttpServer()).get(
            `/service-orders/${order.id}/checklist`,
          )
        ).status,
      ).toBe(401);
      expect((await api("get", "", "VIEWER")).status).toBe(200);
      expect(
        (
          await api("post", "", "VIEWER").send({
            entryKey: uuid(),
            title: "Task",
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await api("post", `/${item.id}/state`, "VIEWER").send({
            completed: true,
            expectedVersion: 0,
          })
        ).status,
      ).toBe(403);
      expect((await api("get", "", "ADMIN", foreignOrder.id)).status).toBe(404);
      expect(
        (
          await api("post", "", "STAFF", foreignOrder.id).send({
            entryKey: uuid(),
            title: "Task",
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await api(
            "post",
            `/${item.id}/state`,
            "STAFF",
            foreignOrder.id,
            foreign,
          ).send({ completed: true, expectedVersion: 0 })
        ).status,
      ).toBe(401);
      for (const payload of [
        { entryKey: uuid(), title: "   " },
        { entryKey: uuid(), title: "Task", orgId: foreign },
      ])
        expect((await api("post").send(payload)).status).toBe(400);
      expect((await change(true, -1)).status).toBe(400);
      expect(
        (
          await api("post", `/${item.id}/state`).send({
            completed: "false",
            expectedVersion: 0,
          })
        ).status,
      ).toBe(400);
    });
    it("records completion, reasoned undo and rejects stale mutations", async () => {
      await db.serviceOrder.update({
        where: { id: order.id },
        data: { status: "IN_PROGRESS" },
      });
      const result = await change(true, 0);
      expect(result.status).toBe(201);
      expect(result.body.version).toBe(1);
      expect(result.body.completedByName).toBe("Profissional local");
      expect(result.body.completedAt).toBeTruthy();
      expect((await change(true, 0)).body.version).toBe(1);
      expect((await change(false, 1)).status).toBe(400);
      expect((await change(false, 1, "   ")).status).toBe(400);
      const undo = await change(false, 1, "Teste precisa ser repetido");
      expect(undo.status).toBe(201);
      expect(undo.body.completedAt).toBeNull();
      expect(undo.body.version).toBe(2);
      expect(
        (await change(false, 1, "Teste precisa ser repetido")).body.version,
      ).toBe(2);
      expect((await change(false, 1, "Outro motivo")).status).toBe(409);
      expect((await change(true, 0)).status).toBe(409);
      expect(await db.timelineEvent.count({ where: { orgId: org } })).toBe(3);
      const audit = await db.auditEvent.findMany({ where: { orgId: org } });
      expect(
        audit.some(
          (e) => (e.metadata as any)?.reason === "Teste precisa ser repetido",
        ),
      ).toBe(true);
      const responses = await Promise.all(
        Array.from({ length: 8 }, () => change(true, 2)),
      );
      expect(
        responses.every((r) => r.status === 201 && r.body.version === 3),
      ).toBe(true);
      expect(await db.timelineEvent.count({ where: { orgId: org } })).toBe(4);
    });
    it("keeps completed/canceled orders read-only and does not change service status", async () => {
      for (const status of ["DONE", "CANCELED"] as const) {
        await db.serviceOrder.update({
          where: { id: order.id },
          data: { status },
        });
        expect(
          (await api("post").send({ entryKey: uuid(), title: "Novo item" }))
            .status,
        ).toBe(409);
        expect((await change(false, 3, "Correção solicitada")).status).toBe(
          409,
        );
        expect((await api("get")).body).toHaveLength(1);
        expect(
          (await db.serviceOrder.findUnique({ where: { id: order.id } }))
            .status,
        ).toBe(status);
      }
      await db.serviceOrder.update({
        where: { id: order.id },
        data: { status: "IN_PROGRESS" },
      });
    });
    it("enforces item cap concurrently and composite tenant FK", async () => {
      const results = await Promise.all(
        Array.from({ length: 33 }, (_, i) =>
          api("post").send({ entryKey: uuid(), title: "Item " + i }),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(29);
      expect(results.filter((r) => r.status === 409)).toHaveLength(4);
      expect((await api("get")).body).toHaveLength(30);
      expect(await db.timelineEvent.count({ where: { orgId: org } })).toBe(33);
      expect(await db.auditEvent.count({ where: { orgId: org } })).toBe(33);
      await expect(
        db.serviceOrderChecklistItem.create({
          data: {
            orgId: foreign,
            serviceOrderId: order.id,
            entryKey: uuid(),
            title: "Wrong tenant",
            createdByUserId: actor,
          },
        }),
      ).rejects.toMatchObject({ code: "P2003" });
    });
    it("allows the assigned contractor to execute existing tasks until reassignment", async () => {
      const person = await db.person.findUniqueOrThrow({ where: { userId: actor } });
      const scopedOrder = await db.serviceOrder.create({
        data: {
          orgId: org, customerId: order.customerId, title: "Checklist atribuído",
          status: "IN_PROGRESS", assignedToPersonId: person.id,
        },
      });
      const task = await db.serviceOrderChecklistItem.create({
        data: {
          orgId: org, serviceOrderId: scopedOrder.id, entryKey: uuid(),
          title: "Conferir execução", createdByUserId: actor,
        },
      });
      const contractor = (method: "get" | "post", path = "") =>
        api(method, path, "CONTRACTOR", scopedOrder.id, org, person.id);
      await db.user.update({ where: { id: actor }, data: { role: "CONTRACTOR" } });
      try {
        await contractor("get").expect(200);
        await contractor("post").send({ title: "Nova tarefa", entryKey: uuid() }).expect(403);
        await contractor("post", `/${task.id}/state`)
          .send({ completed: true, expectedVersion: task.version }).expect(201);
        await db.serviceOrder.update({ where: { id: scopedOrder.id }, data: { assignedToPersonId: null } });
        await contractor("get").expect(404);
        await contractor("post", `/${task.id}/state`)
          .send({ completed: true, expectedVersion: task.version }).expect(404);
      } finally {
        await db.user.update({ where: { id: actor }, data: { role: "STAFF" } });
      }
    });
  },
);
