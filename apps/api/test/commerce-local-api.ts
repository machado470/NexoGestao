// Isolated browser-audit server. Never enabled against an application database.
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { ValidationPipe, UnauthorizedException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { writeFileSync } from "fs";
import { CommerceController } from "../src/commerce/commerce.controller";
import { CommerceService } from "../src/commerce/commerce.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard";
const url = "postgresql://nexo@127.0.0.1:55439/postgres";
if (process.env.COMMERCE_TEST_DATABASE_URL !== url)
  throw new Error("Requires the isolated commerce test database");
async function main() {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const orgId = randomUUID(),
    actor = randomUUID();
  await db.organization.create({
    data: {
      id: orgId,
      name: "Empresa da validação",
      slug: orgId,
      timezone: "America/Sao_Paulo",
      currency: "BRL",
    },
  });
  await db.user.create({
    data: {
      id: actor,
      orgId,
      email: actor + "@example.test",
      role: "ADMIN",
      active: true,
    },
  });
  const customer = await db.customer.create({
    data: {
      orgId,
      name: "Cliente das novas seções",
      phone: "11999990000",
      cpfCnpj: "12345678900",
    },
  });
  const order = await db.serviceOrder.create({
    data: { orgId, customerId: customer.id, title: "Manutenção da validação" },
  });
  const charge = await db.charge.create({
    data: {
      orgId,
      customerId: customer.id,
      amountCents: 10000,
      currency: "BRL",
      status: "PENDING",
      dueDate: new Date("2026-11-30T12:00:00Z"),
    },
  });
  await db.payment.create({
    data: {
      orgId,
      chargeId: charge.id,
      amountCents: 4000,
      method: "PIX",
      paidAt: new Date("2026-11-15T15:00:00Z"),
    },
  });
  await db.expense.create({
    data: {
      orgId,
      title: "Despesa antiga da validação",
      amountCents: 500,
      category: "OPERATIONS",
      type: "VARIABLE",
      occurredAt: new Date("2026-11-15T15:00:00Z"),
    },
  });
  const module = await Test.createTestingModule({
    controllers: [CommerceController],
    providers: [CommerceService, { provide: PrismaService, useValue: db }],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (context) => {
        const req = context.switchToHttp().getRequest();
        if (req.headers["x-audit-org"] !== orgId)
          throw new UnauthorizedException();
        req.user = {
          sub: actor,
          orgId,
          role: req.headers["x-audit-role"] || "ADMIN",
        };
        return true;
      },
    })
    .compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(55440, "127.0.0.1");
  writeFileSync(
    "/dev/shm/nexo-commerce-fixture.json",
    JSON.stringify({ orgId, actor, customer, order }),
  );
  console.log("Isolated commerce API ready on localhost:55440");
  const shutdown = async () => {
    await app.close();
    const where = { orgId };
    await db.fiscalDraft.deleteMany({ where });
    await db.stockMovement.deleteMany({ where });
    await db.inventoryProduct.deleteMany({ where });
    await db.paymentRefund.deleteMany({ where });
    await db.payment.deleteMany({ where });
    await db.charge.deleteMany({ where });
    await db.expense.deleteMany({ where });
    await db.serviceOrder.deleteMany({ where });
    await db.customer.deleteMany({ where });
    await db.user.deleteMany({ where });
    await db.organization.delete({ where: { id: orgId } });
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
