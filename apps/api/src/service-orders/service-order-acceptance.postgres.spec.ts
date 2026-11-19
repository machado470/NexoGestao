import { Test } from "@nestjs/testing";
import { UnauthorizedException, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { randomUUID as uuid } from "crypto";
import request from "supertest";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import {
  ServiceOrderAcceptanceController,
  PublicServiceAcceptanceController,
  ServiceOrderAcceptanceService,
} from "./service-order-acceptance";
const url = "postgresql://nexo@127.0.0.1:55439/postgres";
(process.env.ACCEPTANCE_TEST_DATABASE_URL === url ? describe : describe.skip)(
  "Customer acceptance with isolated PostgreSQL",
  () => {
    let app: any, db: PrismaClient, order: any, other: any, created: any;
    const org = uuid(),
      foreign = uuid(),
      actor = uuid(),
      key = uuid();
    const payload = () => ({
      entryKey: uuid(),
      publicTitle: "Manutenção entregue",
      publicSummary:
        "Equipamento testado e serviço finalizado conforme combinado.",
    });
    const api = (
      method: "get" | "post",
      suffix = "",
      role = "STAFF",
      orderId = order.id,
    ) =>
      request(app.getHttpServer())
        [method](`/service-orders/${orderId}/acceptances${suffix}`)
        .set("x-actor", actor)
        .set("x-org", org)
        .set("x-role", role);
    const view = (token) =>
      request(app.getHttpServer())
        .post("/service-acceptance/view")
        .send({ token });
    const respond = (body) =>
      request(app.getHttpServer())
        .post("/service-acceptance/respond")
        .send(body);
    beforeAll(async () => {
      db = new PrismaClient({ datasources: { db: { url } } });
      await db.organization.createMany({
        data: [org, foreign].map((id) => ({
          id,
          slug: id,
          name: "Empresa local",
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
      const customer = await db.customer.create({
        data: { orgId: org, name: "Dado privado", phone: "11999990000" },
      });
      const foreignCustomer = await db.customer.create({
        data: { orgId: foreign, name: "Other", phone: "11999990000" },
      });
      order = await db.serviceOrder.create({
        data: {
          orgId: org,
          customerId: customer.id,
          title: "Nota interna secreta",
          description: "Não compartilhar",
          amountCents: 15000,
          status: "DONE",
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
      const module = await Test.createTestingModule({
        controllers: [
          ServiceOrderAcceptanceController,
          PublicServiceAcceptanceController,
        ],
        providers: [
          ServiceOrderAcceptanceService,
          { provide: PrismaService, useValue: db },
          {
            provide: ConfigService,
            useValue: new ConfigService({
              JWT_SECRET: "isolated-acceptance-test-secret-not-production",
            }),
          },
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
          await db.serviceOrderAcceptance.deleteMany({ where });
          await db.timelineEvent.deleteMany({ where });
          await db.auditEvent.deleteMany({ where });
          await db.serviceOrder.deleteMany({ where });
          await db.customer.deleteMany({ where });
          await db.user.deleteMany({ where });
          await db.organization.deleteMany({ where: { id } });
        }
        await db.$disconnect();
      }
    });
    it("creates one stable private link under repeated/concurrent requests", async () => {
      const input = { ...payload(), entryKey: key };
      const responses = await Promise.all(
        Array.from({ length: 6 }, () => api("post").send(input)),
      );
      expect(responses.every((r) => r.status === 201)).toBe(true);
      created = responses[0].body;
      expect(new Set(responses.map((r) => r.body.token)).size).toBe(1);
      expect(created.token).toMatch(/^[a-f0-9]{64}$/);
      expect(
        await db.serviceOrderAcceptance.count({ where: { orgId: org } }),
      ).toBe(1);
      expect(await db.timelineEvent.count({ where: { orgId: org } })).toBe(1);
      const stored = await db.serviceOrderAcceptance.findUnique({
        where: { id: created.id },
      });
      expect(stored.tokenHash).not.toBe(created.token);
      const result = await view(created.token);
      expect(result.status).toBe(201);
      expect(result.headers["cache-control"]).toBe("private, no-store");
      expect(Object.keys(result.body).sort()).toEqual(
        [
          "companyName",
          "publicTitle",
          "publicSummary",
          "expiresAt",
          "decision",
          "respondedAt",
        ].sort(),
      );
      expect(JSON.stringify(result.body)).not.toMatch(
        /11999990000|Não compartilhar|Nota interna secreta|15000/,
      );
      expect(
        (
          await api("post").send({
            ...input,
            publicSummary: "Outro resumo diferente",
          })
        ).status,
      ).toBe(409);
    });
    it("enforces authenticated roles/tenant and validates untrusted public input", async () => {
      expect(
        (
          await request(app.getHttpServer()).get(
            `/service-orders/${order.id}/acceptances`,
          )
        ).status,
      ).toBe(401);
      expect(
        (await api("get", "", "VIEWER")).body[0].tokenHash,
      ).toBeUndefined();
      expect((await api("post", "", "VIEWER").send(payload())).status).toBe(
        403,
      );
      expect(
        (await api("post", "", "STAFF", other.id).send(payload())).status,
      ).toBe(404);
      expect(
        (await api("post").send({ ...payload(), orgId: foreign })).status,
      ).toBe(400);
      expect((await view("0".repeat(64))).status).toBe(404);
      expect((await view("bad")).status).toBe(400);
      const input = {
        token: created.token,
        responseKey: uuid(),
        decision: "ISSUE",
        respondentName: "Cliente",
        confirmed: true,
      };
      expect((await respond(input)).status).toBe(400);
      expect(
        (await respond({ ...input, decision: "ACCEPTED", confirmed: "false" }))
          .status,
      ).toBe(400);
      expect(
        (await respond({ ...input, decision: "ACCEPTED", orgId: foreign }))
          .status,
      ).toBe(400);
    });
    it("records a single immutable response with idempotent retry and no billing effects", async () => {
      const input = {
        token: created.token,
        responseKey: uuid(),
        decision: "ACCEPTED",
        respondentName: "Cliente local",
        responseNote: "Tudo certo",
        confirmed: true,
      };
      const responses = await Promise.all(
        Array.from({ length: 8 }, () => respond(input)),
      );
      expect(
        responses.every(
          (r) => r.status === 201 && r.body.decision === "ACCEPTED",
        ),
      ).toBe(true);
      expect(new Set(responses.map((r) => r.body.respondedAt)).size).toBe(1);
      expect(
        (
          await respond({
            ...input,
            decision: "ISSUE",
            responseNote: "Quero registrar um problema",
          })
        ).status,
      ).toBe(409);
      expect((await respond({ ...input, responseKey: uuid() })).status).toBe(
        409,
      );
      const history = (await api("get")).body[0];
      expect(history.respondentName).toBe("Cliente local");
      expect(history.responseNote).toBe("Tudo certo");
      expect(await db.timelineEvent.count({ where: { orgId: org } })).toBe(2);
      expect(await db.auditEvent.count({ where: { orgId: org } })).toBe(2);
      expect(await db.payment.count({ where: { orgId: org } })).toBe(0);
      expect(
        (await db.serviceOrder.findUnique({ where: { id: order.id } })).status,
      ).toBe("DONE");
    });

    it("revokes access without deleting the recorded response", async () => {
      expect(
        (await api("post", `/${created.id}/revoke`, "VIEWER")).status,
      ).toBe(403);
      expect((await api("post", `/${created.id}/revoke`)).status).toBe(201);
      expect((await api("post", `/${created.id}/revoke`)).status).toBe(201);
      expect((await view(created.token)).status).toBe(404);
      expect((await api("get")).body[0].decision).toBe("ACCEPTED");
      expect(await db.timelineEvent.count({ where: { orgId: org } })).toBe(3);
    });
    it("replaces pending links and rejects expired or changed-order requests", async () => {
      const first = (await api("post").send(payload())).body;
      const second = (await api("post").send(payload())).body;
      expect((await view(first.token)).status).toBe(404);
      expect((await view(second.token)).status).toBe(201);
      await db.serviceOrder.update({
        where: { id: order.id },
        data: { title: "Alteração posterior" },
      });
      expect((await view(second.token)).status).toBe(404);
      expect(
        (
          await respond({
            token: second.token,
            responseKey: uuid(),
            decision: "ACCEPTED",
            respondentName: "Cliente",
            confirmed: true,
          })
        ).status,
      ).toBe(409);
      const third = (await api("post").send(payload())).body;
      await db.serviceOrderAcceptance.update({
        where: { id: third.id },
        data: {
          createdAt: new Date(Date.now() - 200000),
          expiresAt: new Date(Date.now() - 100000),
        },
      });
      expect((await view(third.token)).status).toBe(404);
      await db.serviceOrder.update({
        where: { id: order.id },
        data: { status: "IN_PROGRESS" },
      });
      expect((await api("post").send(payload())).status).toBe(409);
      await db.serviceOrder.update({
        where: { id: order.id },
        data: { status: "DONE" },
      });
    });
    it("records issues for follow-up without changing the service", async () => {
      const link = (await api("post").send(payload())).body;
      const result = await respond({
        token: link.token,
        responseKey: uuid(),
        decision: "ISSUE",
        respondentName: "Cliente",
        responseNote: "O equipamento ainda apresenta ruído.",
        confirmed: true,
      });
      expect(result.status).toBe(201);
      expect(result.body.decision).toBe("ISSUE");
      const history = await db.serviceOrderAcceptance.findUnique({
        where: { id: link.id },
      });
      expect(history.responseNote).toContain("ruído");
      expect(
        (await db.serviceOrder.findUnique({ where: { id: order.id } })).status,
      ).toBe("DONE");
    });
    it("caps requests without revoking the last usable link and enforces composite tenancy", async () => {
      let last: any;
      while (
        (await db.serviceOrderAcceptance.count({ where: { orgId: org } })) < 20
      )
        last = (await api("post").send(payload())).body;
      expect((await api("post").send(payload())).status).toBe(409);
      expect((await view(last.token)).status).toBe(201);
      const saved = await db.serviceOrderAcceptance.findUnique({
        where: { id: last.id },
      });
      await expect(
        db.serviceOrderAcceptance.create({
          data: {
            ...saved,
            id: uuid(),
            orgId: foreign,
            tokenHash: uuid(),
            entryKey: uuid(),
          },
        }),
      ).rejects.toMatchObject({ code: "P2003" });
    });
  },
);
