import { Test } from "@nestjs/testing";
import { UnauthorizedException, ValidationPipe } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { randomUUID as uuid } from "crypto";
import request from "supertest";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import {
  ServiceOrderEvidenceController,
  ServiceOrderEvidenceService,
} from "./service-order-evidence";

import { ServiceOrderReadService } from "./service-order-read.service";

const url = "postgresql://nexo@127.0.0.1:55439/postgres";
// Opt-in, isolated database only. Never consumes DATABASE_URL.
(process.env.EVIDENCE_TEST_DATABASE_URL === url ? describe : describe.skip)(
  "Private evidence with PostgreSQL",
  () => {
    let db: PrismaClient, app: any, order: any, otherOrder: any, photo: any;
    const org = uuid(),
      foreign = uuid(),
      actor = uuid();
    // Valid 8x8 JPEG fixture, generated from a solid color (no personal data).
    const imageBase64 =
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCzRRRXxR94f//Z";
    const body = () => ({
      entryKey: uuid(),
      description: "Execução conferida pelo profissional",
      imageBase64,
      professionalConfirmed: true,
    });
    const api = (
      method: "get" | "post",
      path = "",
      role = "STAFF",
      tenant = org,
      orderId = order.id,
      actorId: string = actor,
      personId?: string,
    ) =>
      request(app.getHttpServer())
        [method](`/service-orders/${orderId}/evidence${path}`)
        .set("x-actor", actorId)
        .set("x-person", personId ?? "")
        .set("x-org", tenant)
        .set("x-role", role);
    beforeAll(async () => {
      db = new PrismaClient({ datasources: { db: { url } } });
      await db.organization.createMany({
        data: [org, foreign].map((id) => ({
          id,
          slug: id,
          name: "Evidence test",
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
        data: {
          orgId: org,
          customerId: customer.id,
          title: "Evidence test",
          status: "IN_PROGRESS",
        },
      });
      otherOrder = await db.serviceOrder.create({
        data: { orgId: foreign, customerId: other.id, title: "Other" },
      });
      const module = await Test.createTestingModule({
        controllers: [ServiceOrderEvidenceController],
        providers: [
          ServiceOrderEvidenceService,
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
        }),
      );
      await app.init();
    });
    afterAll(async () => {
      await app?.close();
      if (db) {
        for (const id of [org, foreign]) {
          await db.serviceOrderEvidence.deleteMany({ where: { orgId: id } });
          await db.timelineEvent.deleteMany({ where: { orgId: id } });
          await db.auditEvent.deleteMany({ where: { orgId: id } });
          await db.serviceOrder.deleteMany({ where: { orgId: id } });
          await db.customer.deleteMany({ where: { orgId: id } });
          await db.person.deleteMany({ where: { orgId: id } });
          await db.user.deleteMany({ where: { orgId: id } });
          await db.organization.deleteMany({ where: { id } });
        }
        await db.$disconnect();
      }
    });
    it("persists once under concurrent replay with actor and atomic timeline/audit; metadata excludes content", async () => {
      const input = body();
      const replies = await Promise.all(
        Array.from({ length: 6 }, () => api("post").send(input)),
      );
      expect(replies.every((r) => r.status === 201)).toBe(true);
      photo = replies[0].body;
      expect(new Set(replies.map((r) => r.body.id)).size).toBe(1);
      expect(photo.uploadedByName).toBe("Profissional local");
      expect(photo.content).toBeUndefined();
      expect(
        await db.serviceOrderEvidence.count({ where: { orgId: org } }),
      ).toBe(1);
      expect(await db.timelineEvent.count({ where: { orgId: org } })).toBe(1);
      expect(await db.auditEvent.count({ where: { orgId: org } })).toBe(1);
      const image = await api("get", "/" + photo.id).expect("Cache-Control", "private, no-store");
      expect(image.body.imageBase64).toBe(imageBase64);
      const list = await api("get").expect("Cache-Control", "private, no-store");
      expect(list.body).toHaveLength(1);
      expect(
        (
          await api("post").send({
            ...input,
            description: "Conteúdo diferente",
          })
        ).status,
      ).toBe(409);
    });
    it("limits contractor evidence to the current assignee after reassignment", async () => {
      const [a, b] = await Promise.all(["A", "B"].map(async name => {
        const id = uuid();
        return db.user.create({
          data: {
            id, orgId: org, email: id + "@example.test", role: "CONTRACTOR", active: true,
            person: { create: { orgId: org, name, role: "CONTRACTOR" } },
          },
          include: { person: true },
        });
      }));
      const contractor = (user: typeof a, method: "get" | "post", path = "") =>
        api(method, path, "CONTRACTOR", org, order.id, user.id, user.person!.id);
      await db.serviceOrder.update({ where: { id: order.id }, data: { assignedToPersonId: a.person!.id } });
      const orders = new ServiceOrderReadService(db as PrismaService);
      const aId = a.person!.id;
      const bId = b.person!.id;
      try {
        expect(await orders.listAssigned(org, aId, 1)).toEqual({
          items: [{ id: order.id, title: order.title, status: order.status,
            priority: order.priority, scheduledFor: order.scheduledFor }],
          nextPage: null,
        });
        expect((await orders.listAssigned(org, bId, 1)).items).toEqual([]);
        expect((await orders.listAssigned(foreign, aId, 1)).items).toEqual([]);
        await expect(orders.getAssigned(org, bId, order.id)).rejects.toMatchObject({ status: 404 });
        const detail = await orders.getAssigned(org, aId, order.id);
        expect(detail).not.toHaveProperty("amountCents");
        expect(detail).not.toHaveProperty("customerId");
        await contractor(a, "get").expect(200);
        await contractor(a, "get", "/" + photo.id).expect(200);
        await contractor(b, "get").expect(404);
        await contractor(b, "get", "/" + photo.id).expect(404);
        await contractor(b, "post").send(body()).expect(404);
        await db.serviceOrder.update({ where: { id: order.id }, data: { assignedToPersonId: b.person!.id } });
        await expect(orders.getAssigned(org, aId, order.id)).rejects.toMatchObject({ status: 404 });
        expect((await orders.getAssigned(org, bId, order.id)).id).toBe(order.id);
        await contractor(a, "get", "/" + photo.id).expect(404);
        await contractor(a, "post").send(body()).expect(404);
        await contractor(b, "get", "/" + photo.id).expect(200);
      } finally {
        await db.serviceOrder.update({ where: { id: order.id }, data: { assignedToPersonId: null } });
      }
    });
    it("enforces auth, role and tenant boundaries on metadata, image and writes", async () => {
      expect(
        (
          await request(app.getHttpServer()).get(
            `/service-orders/${order.id}/evidence`,
          )
        ).status,
      ).toBe(401);
      expect((await api("post", "", "VIEWER").send(body())).status).toBe(403);
      expect((await api("get", "", "VIEWER")).status).toBe(200);
      expect((await api("get", "", "ADMIN", org, otherOrder.id)).status).toBe(
        404,
      );
      expect(
        (await api("get", "/" + photo.id, "ADMIN", foreign, otherOrder.id))
          .status,
      ).toBe(404);
      expect(
        (await api("post", "", "STAFF", org, otherOrder.id).send(body()))
          .status,
      ).toBe(404);
      expect(
        (
          await api("post").send({
            ...body(),
            orgId: foreign,
            uploadedByName: "Forged",
          })
        ).status,
      ).toBe(400);
    });
    it("rejects unsupported content, invalid confirmation and oversized images", async () => {
      for (const changed of [
        { imageBase64: "not base64" },
        { imageBase64: Buffer.from("<svg></svg>").toString("base64") },
        { imageBase64: Buffer.alloc(65537).toString("base64") },
        { professionalConfirmed: false },
        { description: "     " },
      ])
        expect((await api("post").send({ ...body(), ...changed })).status).toBe(
          400,
        );
    });
    it("rejects new photos before start or after cancellation; preserves existing evidence", async () => {
      for (const status of ["OPEN", "CANCELED"] as const) {
        await db.serviceOrder.update({
          where: { id: order.id },
          data: { status },
        });
        expect((await api("post").send(body())).status).toBe(409);
        expect((await api("get", "/" + photo.id)).status).toBe(200);
      }
      await db.serviceOrder.update({
        where: { id: order.id },
        data: { status: "DONE" },
      });
      expect((await api("post").send(body())).status).toBe(201);
      expect(
        (await db.serviceOrder.findUnique({ where: { id: order.id } })).status,
      ).toBe("DONE");
    });
    it("enforces 12-photo cap even for concurrent additions without orphan events", async () => {
      const replies = await Promise.all(
        Array.from({ length: 14 }, () => api("post").send(body())),
      );
      expect(replies.filter((r) => r.status === 201)).toHaveLength(10);
      expect(replies.filter((r) => r.status === 409)).toHaveLength(4);
      expect(
        await db.serviceOrderEvidence.count({ where: { orgId: org } }),
      ).toBe(12);
      expect(await db.timelineEvent.count({ where: { orgId: org } })).toBe(12);
      expect(await db.auditEvent.count({ where: { orgId: org } })).toBe(12);
      await expect(
        db.serviceOrderEvidence.create({
          data: {
            orgId: foreign,
            serviceOrderId: order.id,
            entryKey: uuid(),
            description: "Wrong tenant",
            content: Buffer.from(imageBase64, "base64"),
            sha256: "x",
            uploadedByUserId: actor,
            uploadedByName: "x",
          },
        }),
      ).rejects.toMatchObject({ code: "P2003" });
    });
  },
);
