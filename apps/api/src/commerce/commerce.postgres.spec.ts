import { Test } from "@nestjs/testing";
import { UnauthorizedException, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { randomUUID as uuid } from "crypto";
import { CommerceController } from "./commerce.controller";
import { CommerceService } from "./commerce.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
const url = "postgresql://nexo@127.0.0.1:55439/postgres";
(process.env.COMMERCE_TEST_DATABASE_URL === url ? describe : describe.skip)(
  "Commerce with isolated PostgreSQL",
  () => {
    let app: any,
      db: PrismaClient,
      product: any,
      customer: any,
      other: any,
      order: any;
    const org = uuid(),
      foreign = uuid(),
      actor = uuid();
    const api = (
      method: "get" | "post",
      path: string,
      role = "ADMIN",
      tenant = org,
    ) =>
      request(app.getHttpServer())
        [method]("/commerce/" + path)
        .set("x-test-actor", actor)
        .set("x-test-org", tenant)
        .set("x-test-role", role);
    beforeAll(async () => {
      db = new PrismaClient({ datasources: { db: { url } } });
      await db.$connect();
      await db.organization.createMany({
        data: [
          {
            id: org,
            name: "A",
            slug: org,
            currency: "BRL",
            timezone: "America/Sao_Paulo",
          },
          {
            id: foreign,
            name: "B",
            slug: foreign,
            currency: "USD",
            timezone: "UTC",
          },
        ],
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
      customer = await db.customer.create({
        data: { orgId: org, name: "A", phone: "11999990000" },
      });
      other = await db.customer.create({
        data: { orgId: foreign, name: "B", phone: "11999990000" },
      });
      order = await db.serviceOrder.create({
        data: { orgId: org, customerId: customer.id, title: "Serviço" },
      });
      const module = await Test.createTestingModule({
        controllers: [CommerceController],
        providers: [CommerceService, { provide: PrismaService, useValue: db }],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: (context) => {
            const req = context.switchToHttp().getRequest();
            if (!req.headers["x-test-actor"]) throw new UnauthorizedException();
            req.user = {
              sub: req.headers["x-test-actor"],
              orgId: req.headers["x-test-org"],
              role: req.headers["x-test-role"],
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
        }),
      );
      await app.init();
    });
    afterAll(async () => {
      await app?.close();
      if (db) {
        const where = { orgId: { in: [org, foreign] } };
        await db.fiscalDraft.deleteMany({ where });
        await db.stockMovement.deleteMany({ where });
        await db.stockReservation.deleteMany({ where });
        await db.inventoryKitWithdrawal.deleteMany({ where });
        await db.inventoryKitComponent.deleteMany({ where });
        await db.inventoryProduct.deleteMany({ where: { ...where, kind: "VARIANT" } });
        await db.inventoryProduct.deleteMany({ where });
        await db.paymentRefund.deleteMany({ where });
        await db.payment.deleteMany({ where });
        await db.charge.deleteMany({ where });
        await db.expense.deleteMany({ where });
        await db.serviceOrder.deleteMany({ where });
        await db.customer.deleteMany({ where });
        await db.user.deleteMany({ where });
        await db.organization.deleteMany({
          where: { id: { in: [org, foreign] } },
        });
        await db.$disconnect();
      }
    });
    it("guards all modules and validates payloads without accepting client organization", async () => {
      await request(app.getHttpServer()).get("/commerce/products").expect(401);
      for (const role of ["MANAGER", "STAFF", "VIEWER"])
        for (const path of ["products", "fiscal-drafts", "health"])
          await api("get", path, role).expect(403);
      const input = {
        sku: "filtro-220",
        name: "Filtro",
        variant: "220V",
        barcode: "1234567890",
        minQuantity: 2,
        costCents: 1000,
        saleCents: 2500,
        expectedCurrency: "BRL",
      };
      product = (await api("post", "products").send(input).expect(201)).body;
      expect(product).toMatchObject({
        sku: "FILTRO-220",
        onHand: 0,
        currency: "BRL",
      });
      expect(
        (await api("post", "products").send(input).expect(201)).body.id,
      ).toBe(product.id);
      await api("post", "products")
        .send({ ...input, name: "Outro" })
        .expect(409);
      await api("post", "products")
        .send({ ...input, orgId: foreign })
        .expect(400);
      await api("post", "products")
        .send({ ...input, sku: "X", expectedCurrency: "USD" })
        .expect(409);
      expect(
        (await api("get", "products?q=123456").expect(200)).body.total,
      ).toBe(1);
      expect(
        (await api("get", "products", "ADMIN", foreign).expect(200)).body.total,
      ).toBe(0);
    });
    it("deduplicates ten concurrent entries, preserves actor and rejects key changes", async () => {
      const input = {
        productId: product.id,
        direction: "IN",
        quantity: 10,
        reason: "Compra",
        entryKey: uuid(),
        serviceOrderId: order.id,
      };
      const replies = await Promise.all(
        Array.from({ length: 10 }, () => api("post", "movements").send(input)),
      );
      expect(replies.map((r) => r.status)).toEqual(Array(10).fill(201));
      expect(new Set(replies.map((r) => r.body.id)).size).toBe(1);
      expect(await db.stockMovement.count({ where: { orgId: org } })).toBe(1);
      expect(
        (await db.inventoryProduct.findUnique({ where: { id: product.id } }))!
          .onHand,
      ).toBe(10);
      expect(replies[0].body.actorUserId).toBe(actor);
      await api("post", "movements")
        .send({ ...input, quantity: 9 })
        .expect(409);
    });
    it("prevents negative stock under concurrency and enforces tenant FKs", async () => {
      const input = {
        productId: product.id,
        direction: "OUT",
        quantity: 2,
        reason: "Consumo",
        entryKey: uuid(),
      };
      const replies = await Promise.all(
        Array.from({ length: 9 }, () =>
          api("post", "movements").send({ ...input, entryKey: uuid() }),
        ),
      );
      expect(replies.filter((r) => r.status === 201)).toHaveLength(5);
      expect(replies.filter((r) => r.status === 400)).toHaveLength(4);
      expect(
        (await db.inventoryProduct.findUnique({ where: { id: product.id } }))!
          .onHand,
      ).toBe(0);
      await api("post", "movements", "ADMIN", foreign)
        .send({ ...input, direction: "IN" })
        .expect(404);
      const otherOrder = await db.serviceOrder.create({
        data: { orgId: foreign, customerId: other.id, title: "Outro" },
      });
      await api("post", "movements")
        .send({
          ...input,
          direction: "IN",
          serviceOrderId: otherOrder.id,
          entryKey: uuid(),
        })
        .expect(404);
      await expect(
        db.stockMovement.create({
          data: {
            orgId: foreign,
            productId: product.id,
            direction: "IN",
            quantity: 1,
            reason: "FK test",
            actorUserId: actor,
            entryKey: uuid(),
          },
        }),
      ).rejects.toMatchObject({ code: "P2003" });
      await api("post", "movements")
        .send({ ...input, quantity: 1.5 })
        .expect(400);
    });
    it("stores only fiscal preparation and verifies customer/order ownership and idempotency", async () => {
      const input = {
        customerId: customer.id,
        serviceOrderId: order.id,
        description: "Manutenção preventiva",
        amountCents: 15000,
        expectedCurrency: "BRL",
        entryKey: uuid(),
      };
      const first = (await api("post", "fiscal-drafts").send(input).expect(201))
        .body;
      expect(
        (await api("post", "fiscal-drafts").send(input).expect(201)).body.id,
      ).toBe(first.id);
      await api("post", "fiscal-drafts")
        .send({ ...input, amountCents: 16000 })
        .expect(409);
      await api("post", "fiscal-drafts")
        .send({ ...input, customerId: other.id, entryKey: uuid() })
        .expect(404);
      const second = await db.customer.create({
        data: { orgId: org, name: "Segundo", phone: "11888880000" },
      });
      await api("post", "fiscal-drafts")
        .send({ ...input, customerId: second.id, entryKey: uuid() })
        .expect(404);
      const list = (await api("get", "fiscal-drafts").expect(200)).body;
      expect(list.emissionAvailable).toBe(false);
      expect(list.items).toHaveLength(1);
      expect(
        (await api("get", "fiscal-drafts", "ADMIN", foreign).expect(200)).body
          .items,
      ).toEqual([]);
    });
    it("keeps money separate, handles month bounds/refunds/partial balances and unknown currencies", async () => {
      const input = {
        title: "Transporte",
        amountCents: 2000,
        occurredAt: "2026-11-15T15:00:00.000Z",
        expectedCurrency: "BRL",
        entryKey: uuid(),
      };
      const first = (await api("post", "expenses").send(input).expect(201))
        .body;
      expect(
        (await api("post", "expenses").send(input).expect(201)).body.id,
      ).toBe(first.id);
      await api("post", "expenses")
        .send({ ...input, amountCents: 3000 })
        .expect(409);
      const legacy = await db.expense.create({
        data: {
          orgId: org,
          title: "Antiga",
          amountCents: 500,
          category: "OPERATIONS",
          type: "VARIABLE",
          occurredAt: new Date("2026-11-15T15:00:00Z"),
        },
      });
      await db.expense.create({
        data: {
          orgId: foreign,
          title: "Outra empresa",
          amountCents: 999999,
          currency: "USD",
          category: "OPERATIONS",
          type: "VARIABLE",
          occurredAt: new Date("2026-11-15T15:00:00Z"),
        },
      });
      const charge = await db.charge.create({
        data: {
          orgId: org,
          customerId: customer.id,
          amountCents: 15000,
          currency: "BRL",
          status: "OVERDUE",
          dueDate: new Date("2026-11-05T12:00:00Z"),
        },
      });
      await db.payment.create({
        data: {
          orgId: org,
          chargeId: charge.id,
          amountCents: 5000,
          method: "PIX",
          paidAt: new Date("2026-11-01T02:59:59Z"),
        },
      });
      const p = await db.payment.create({
        data: {
          orgId: org,
          chargeId: charge.id,
          amountCents: 5000,
          method: "PIX",
          paidAt: new Date("2026-11-01T03:00:00Z"),
        },
      });
      await db.paymentRefund.create({
        data: {
          orgId: org,
          paymentId: p.id,
          amountCents: 1000,
          currency: "BRL",
          providerRefundId: uuid(),
          providerEventId: uuid(),
          refundedAt: new Date("2026-11-10T12:00:00Z"),
        },
      });
      await db.paymentRefund.create({
        data: {
          orgId: org,
          paymentId: p.id,
          amountCents: 500,
          currency: "BRL",
          providerRefundId: uuid(),
          providerEventId: uuid(),
          refundedAt: new Date("2026-11-10T12:00:00Z"),
          reversedAt: new Date("2026-11-11T12:00:00Z"),
        },
      });
      const usd = await db.charge.create({
        data: {
          orgId: org,
          customerId: customer.id,
          amountCents: 9000,
          currency: "USD",
          status: "PENDING",
          dueDate: new Date("2026-11-25T12:00:00Z"),
        },
      });
      await db.payment.create({
        data: {
          orgId: org,
          chargeId: usd.id,
          amountCents: 2000,
          method: "PIX",
          paidAt: new Date("2026-11-15T12:00:00Z"),
        },
      });
      let data = (await api("get", "health?month=2026-11").expect(200)).body;
      expect(data.recentExpenses[0].id).toBe(legacy.id);
      expect(data.unclassifiedExpenseCount).toBe(1);
      expect(data.currencies.every((r) => r.recordedResultCents === null)).toBe(
        true,
      );
      await api("post", "expenses/currency", "ADMIN", foreign)
        .send({ id: legacy.id, currency: "USD" })
        .expect(404);
      await api("post", "expenses/currency")
        .send({ id: legacy.id, currency: "USD" })
        .expect(201);
      await api("post", "expenses/currency")
        .send({ id: legacy.id, currency: "BRL" })
        .expect(409);
      data = (await api("get", "health?month=2026-11").expect(200)).body;
      expect(data.unclassifiedExpenseCount).toBe(0);
      expect(data.currencies.find((r) => r.currency === "BRL")).toMatchObject({
        receivedCents: 5000,
        refundedCents: 1000,
        expensesCents: 2000,
        recordedResultCents: 2000,
        openCents: 6000,
        overdueCents: 6000,
      });
      expect(data.currencies.find((r) => r.currency === "USD")).toMatchObject({
        receivedCents: 2000,
        refundedCents: 0,
        expensesCents: 500,
        recordedResultCents: 1500,
        openCents: 7000,
      });
      await api("get", "health?month=2026-13").expect(400);
    });
    it("keeps legacy items and moves stock only on a variant within its company", async () => {
      const input = {
        expectedCurrency: "BRL", minQuantity: 0, costCents: 0, saleCents: 0,
      };
      expect(product).toMatchObject({ kind: "SIMPLE", variant: "220V", parentId: null });
      const parent = (await api("post", "products").send({
        ...input, kind: "PARENT", sku: "FAMILIA", name: "Família",
      }).expect(201)).body;
      const child = {
        ...input, kind: "VARIANT", sku: "FILTRO-FILHO-220", name: "Família",
        variant: "220V", parentSku: "familia",
      };
      await api("post", "products", "ADMIN", foreign).send({ ...child, expectedCurrency: "USD" }).expect(404);
      await api("post", "products").send({ ...child, parentSku: product.sku }).expect(404);
      const variant = (await api("post", "products").send(child).expect(201)).body;
      expect(variant).toMatchObject({ parentId: parent.id, kind: "VARIANT", onHand: 0 });
      const family = (await api("get", "products?q=FAMILIA").expect(200)).body;
      expect(family.items.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining([parent.id, variant.id]));
      expect((await api("post", "products").send(child).expect(201)).body.id).toBe(variant.id);
      const movement = { direction: "IN", quantity: 1, reason: "Entrada de teste" };
      await api("post", "movements").send({ ...movement, productId: parent.id, entryKey: uuid() }).expect(404);
      await api("post", "movements").send({ ...movement, productId: variant.id, entryKey: uuid() }).expect(201);
      expect(await db.inventoryProduct.findUnique({ where: { id: variant.id } })).toMatchObject({ onHand: 1 });
      expect(await db.inventoryProduct.findUnique({ where: { id: parent.id } })).toMatchObject({ onHand: 0 });
    });
    it("reserves the last unit once, protects it from stock withdrawals, and releases it once", async () => {
      const item = await db.inventoryProduct.create({ data: {
        orgId: org, sku: "ULTIMA-UNIDADE", name: "Peça de teste", currency: "BRL", onHand: 1,
      }});
      const orders = await Promise.all(["Reserva A", "Reserva B"].map(title =>
        db.serviceOrder.create({ data: { orgId: org, customerId: customer.id, title } })
      ));
      const inputs = orders.map(service => ({
        productId: item.id, serviceOrderId: service.id, quantity: 1, entryKey: uuid(),
      }));
      const attempts = await Promise.all(inputs.map(input => api("post", "reservations").send(input)));
      expect(attempts.map(result => result.status).sort()).toEqual([201, 409]);
      const winner = attempts.findIndex(result => result.status === 201);
      const reservation = attempts[winner].body;
      await api("post", "reservations").send(inputs[winner]).expect(201);
      const withdrawal = {
        productId: item.id, direction: "OUT", quantity: 1, reason: "Saída avulsa", entryKey: uuid(),
      };
      await api("post", "movements").send(withdrawal).expect(400);
      await api("post", `reservations/${reservation.id}/release`, "ADMIN", foreign).expect(404);
      await Promise.all(Array.from({ length: 2 }, () =>
        api("post", `reservations/${reservation.id}/release`).expect(201)
      ));
      await api("post", "movements").send(withdrawal).expect(201);
      expect(await db.inventoryProduct.findUnique({ where: { id: item.id } }))
        .toMatchObject({ onHand: 0, reservedQuantity: 0 });
    });
    it("consumes a reservation only during execution and writes one stock movement on retries", async () => {
      const item = await db.inventoryProduct.create({ data: {
        orgId: org, sku: "PECA-CONSUMIDA", name: "Peça a consumir", currency: "BRL", onHand: 3,
      }});
      const service = await db.serviceOrder.create({
        data: { orgId: org, customerId: customer.id, title: "O.S. de consumo" },
      });
      const reservation = (await api("post", "reservations").send({
        productId: item.id, serviceOrderId: service.id, quantity: 2, entryKey: uuid(),
      }).expect(201)).body;
      const path = `reservations/${reservation.id}/consume`;
      await api("get", `reservations/${service.id}`, "STAFF").expect(403);
      await api("get", `reservations/${service.id}`, "ADMIN", foreign).expect(404);
      const list = await api("get", `reservations/${service.id}`).expect(200);
      expect(list.body).toMatchObject([{ id: reservation.id, product: { sku: item.sku } }]);
      await api("post", path, "ADMIN", foreign).expect(404);
      await api("post", path).expect(409);
      await db.serviceOrder.update({ where: { id: service.id }, data: { status: "IN_PROGRESS" } });
      const attempts = await Promise.all(Array.from({ length: 3 }, () => api("post", path).expect(201)));
      expect(new Set(attempts.map(attempt => attempt.body.id)).size).toBe(1);
      expect(attempts[0].body).toMatchObject({ direction: "OUT", quantity: 2, serviceOrderId: service.id });
      await api("post", `reservations/${reservation.id}/release`).expect(409);
      expect(await db.stockMovement.count({ where: { orgId: org, reservationId: reservation.id } })).toBe(1);
      expect(await db.inventoryProduct.findUnique({ where: { id: item.id } }))
        .toMatchObject({ onHand: 1, reservedQuantity: 0 });
    });
    it.each(["CANCELED", "DONE"] as const)(
      "releases only unused reservations when the order becomes %s",
      async status => {
        const item = await db.inventoryProduct.create({ data: {
          orgId: org, sku: `PECA-${status}`, name: "Peça de encerramento", currency: "BRL", onHand: 5,
        }});
        const service = await db.serviceOrder.create({ data: {
          orgId: org, customerId: customer.id, title: "O.S. de encerramento", status: "IN_PROGRESS",
        }});
        const reserve = async (quantity: number) => (await api("post", "reservations").send({
          productId: item.id, serviceOrderId: service.id, quantity, entryKey: uuid(),
        }).expect(201)).body;
        const consumed = await reserve(1);
        const pending = await reserve(2);
        await api("post", `reservations/${consumed.id}/consume`).expect(201);
        await expect(db.$transaction(async tx => {
          await tx.serviceOrder.update({ where: { id: service.id }, data: { status } });
          throw new Error("Rollback de teste");
        })).rejects.toThrow("Rollback de teste");
        expect(await db.inventoryProduct.findUnique({ where: { id: item.id } }))
          .toMatchObject({ onHand: 4, reservedQuantity: 2 });
        await db.serviceOrder.update({ where: { id: service.id }, data: { status } });
        await db.serviceOrder.update({ where: { id: service.id }, data: { status } });
        expect(await db.inventoryProduct.findUnique({ where: { id: item.id } }))
          .toMatchObject({ onHand: 4, reservedQuantity: 0 });
        expect(await db.stockReservation.findUnique({ where: { id: pending.id } }))
          .toMatchObject({ releasedAt: expect.any(Date), consumedAt: null });
        expect(await db.stockReservation.findUnique({ where: { id: consumed.id } }))
          .toMatchObject({ releasedAt: null, consumedAt: expect.any(Date) });
      },
    );
    it("serializes a linked movement and reservations on the same order and product", async () => {
      const item = await db.inventoryProduct.create({ data: {
        orgId: org, sku: "PECA-CONCORRENTE", name: "Peça concorrente", currency: "BRL", onHand: 12,
      }});
      const service = await db.serviceOrder.create({ data: {
        orgId: org, customerId: customer.id, title: "O.S. concorrente", status: "IN_PROGRESS",
      }});
      const base = { productId: item.id, serviceOrderId: service.id, quantity: 1 };
      const [reservations] = await Promise.all([
        Promise.all(Array.from({ length: 4 }, () =>
          api("post", "reservations").send({ ...base, entryKey: uuid() }).expect(201))),
        Promise.all(Array.from({ length: 4 }, () =>
          api("post", "movements").send({ ...base, direction: "OUT", reason: "Saída vinculada", entryKey: uuid() }).expect(201))),
      ]);
      await Promise.all(reservations.map(row =>
        api("post", `reservations/${row.body.id}/consume`).expect(201)));
      expect(await db.inventoryProduct.findUnique({ where: { id: item.id } }))
        .toMatchObject({ onHand: 4, reservedQuantity: 0 });
    });
    it("derives kit availability from unreserved stock and rolls back an incomplete kit withdrawal", async () => {
      const [first, second] = await Promise.all(["KIT-PECA-A", "KIT-PECA-B"].map(sku =>
        db.inventoryProduct.create({ data: {
          orgId: org, sku, name: sku, currency: "BRL", onHand: 4,
        }})
      ));
      const payload = {
        sku: "KIT-TESTE", name: "Kit de teste", expectedCurrency: "BRL", saleCents: 100,
        components: [{ sku: first.sku, quantity: 2 }, { sku: second.sku, quantity: 1 }],
      };
      const kit = (await api("post", "kits").send(payload).expect(201)).body;
      expect(kit).toMatchObject({ availableKits: 2, onHand: 0, kind: "KIT" });
      expect((await api("post", "kits").send({ ...payload, components: [...payload.components].reverse() }).expect(201)).body.id).toBe(kit.id);
      await api("post", "kits", "ADMIN", foreign).send({ ...payload, expectedCurrency: "USD" }).expect(400);
      await api("post", "kits").send({ ...payload, components: [{ sku: kit.sku, quantity: 1 }] }).expect(400);
      const componentIds = [first.id, second.id].sort();
      const limiting = componentIds[1];
      const orderForKit = await db.serviceOrder.create({ data: {
        orgId: org, customerId: customer.id, title: "Reserva de componente",
      }});
      const reserved = (await api("post", "reservations").send({
        productId: limiting, serviceOrderId: orderForKit.id, quantity: 4, entryKey: uuid(),
      }).expect(201)).body;
      expect((await api("get", "products?q=KIT-TESTE").expect(200)).body.items[0].availableKits).toBe(0);
      const path = `kits/${kit.id}/withdrawals`;
      const withdrawal = { entryKey: uuid(), reason: "Saída de kit", quantity: 2 };
      await api("post", path).send(withdrawal).expect(409);
      expect(await db.inventoryProduct.findUnique({ where: { id: componentIds[0] } })).toMatchObject({ onHand: 4 });
      await api("post", `reservations/${reserved.id}/release`).expect(201);
      const replies = await Promise.all(Array.from({ length: 3 }, () => api("post", path).send(withdrawal).expect(201)));
      expect(new Set(replies.map(reply => reply.body.id)).size).toBe(1);
      expect(await db.stockMovement.count({ where: { orgId: org, kitWithdrawalId: replies[0].body.id } })).toBe(2);
      expect(await db.inventoryProduct.findUnique({ where: { id: first.id } })).toMatchObject({ onHand: 0 });
      expect(await db.inventoryProduct.findUnique({ where: { id: second.id } })).toMatchObject({ onHand: 2 });
    });
    it("keeps raw material stock exact in thousandths and rejects fractional scale on whole items", async () => {
      const input = {
        kind: "RAW_MATERIAL", sku: "INSUMO-KG", name: "Insumo a granel",
        expectedCurrency: "BRL", minQuantity: 250, costCents: 1500, saleCents: 0,
      };
      await api("post", "products").send(input).expect(400);
      const material = (await api("post", "products").send({ ...input, rawMaterialUnit: "KG" }).expect(201)).body;
      expect(material).toMatchObject({ rawMaterialUnit: "KG", minQuantity: 250, onHand: 0 });
      const movement = {
        productId: material.id, direction: "IN", quantity: 350,
        reason: "Entrada fracionada", entryKey: uuid(),
      };
      await api("post", "movements").send(movement).expect(400);
      await api("post", "movements").send({ ...movement, productId: product.id, quantityScale: "THOUSANDTHS" }).expect(400);
      const first = await api("post", "movements").send({ ...movement, quantityScale: "THOUSANDTHS" }).expect(201);
      const retry = await api("post", "movements").send({ ...movement, quantityScale: "THOUSANDTHS" }).expect(201);
      expect(retry.body.id).toBe(first.body.id);
      const withdrawal = {
        ...movement, direction: "OUT", quantityScale: "THOUSANDTHS", entryKey: uuid(),
      };
      await api("post", "movements").send({ ...withdrawal, quantity: 351 }).expect(400);
      await api("post", "movements").send({ ...withdrawal, quantity: 125 }).expect(201);
      expect(await db.inventoryProduct.findUnique({ where: { id: material.id } })).toMatchObject({ onHand: 225 });
      const history = await api("get", "movements").expect(200);
      expect(history.body).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: first.body.id, quantity: 350, product: expect.objectContaining({ rawMaterialUnit: "KG" }) }),
      ]));
    });
  },
);
