import {ServiceQuotesController,PublicQuoteApprovalController,ServiceQuotesService} from "../src/commerce/service-quotes";
import {ServiceCatalogController,ServiceCatalogService} from "../src/commerce/service-catalog";
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
import { ConfigService } from '@nestjs/config';
import { QuotasService } from '../src/quotas/quotas.service';
import { ServiceOrderReturnsController, ServiceOrderReturnsService } from '../src/service-orders/service-order-returns';
import { ServiceOrderAcceptanceController, PublicServiceAcceptanceController, ServiceOrderAcceptanceService } from '../src/service-orders/service-order-acceptance';
import { ServiceOrderEvidenceController, ServiceOrderEvidenceService } from '../src/service-orders/service-order-evidence';
import { ServiceOrderChecklistController, ServiceOrderChecklistService } from '../src/service-orders/service-order-checklist';
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
    data: { orgId, customerId: customer.id, title: "Manutenção da validação", status: process.env.ACCEPTANCE_AUDIT === '1' || process.env.RETURNS_AUDIT === '1' ? 'DONE' : 'IN_PROGRESS' },
  });
  const returnIssue = process.env.RETURNS_AUDIT === '1' ? await db.serviceOrderAcceptance.create({data:{orgId,serviceOrderId:order.id,entryKey:randomUUID(),tokenHash:randomUUID(),publicTitle:'Problema relatado pelo cliente',publicSummary:'Serviço entregue para validação.',companyName:'Empresa da validação',orderVersion:order.updatedAt,createdByUserId:actor,expiresAt:new Date(Date.now()+3600000),decision:'ISSUE',responseKey:randomUUID(),respondentName:'Cliente local',responseNote:'O equipamento ainda apresenta ruído.',respondedAt:new Date()}}) : null;
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
    controllers: [ServiceQuotesController,PublicQuoteApprovalController,ServiceCatalogController,CommerceController, ServiceOrderEvidenceController, ServiceOrderChecklistController, ServiceOrderAcceptanceController, PublicServiceAcceptanceController, ServiceOrderReturnsController],
    providers: [ServiceQuotesService,ServiceCatalogService,CommerceService, ServiceOrderEvidenceService, ServiceOrderChecklistService, ServiceOrderAcceptanceService, ServiceOrderReturnsService, {provide:QuotasService,useValue:{validateQuota:async()=>{}}}, { provide: PrismaService, useValue: db }, { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: 'isolated-browser-harness-secret-not-production' }) }],
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
    JSON.stringify({ orgId, actor, customer, order, returnIssue }),
  );
  console.log("Isolated commerce API ready on localhost:55440");
  const shutdown = async () => {
    await app.close();
    const where = { orgId };
    await db.serviceQuoteApproval.deleteMany({where});
    await db.serviceQuoteRevision.deleteMany({where});
    await db.serviceQuote.deleteMany({where});
    await db.catalogServiceRevision.deleteMany({where});
    await db.catalogService.deleteMany({where});
    await db.serviceOrderReturn.deleteMany({where});
    await db.serviceOrderAcceptance.deleteMany({ where });
    await db.serviceOrderChecklistItem.deleteMany({ where });
    await db.serviceOrderEvidence.deleteMany({ where });
    await db.timelineEvent.deleteMany({ where });
    await db.auditEvent.deleteMany({ where });
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
