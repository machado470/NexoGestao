import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ArrayMaxSize,
  IsArray,
  IsUUID,
  IsInt,
  Max,
  Min,
} from "class-validator";
import { Transform } from "class-transformer";
import { PrismaService } from "../prisma/prisma.service";
import { QuotasService } from "../quotas/quotas.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Org } from "../auth/decorators/org.decorator";
import { User } from "../auth/decorators/user.decorator";
export class QuoteConvertDto {
  @Transform(({ obj, key }) => obj[key])
  @IsInt()
  @Min(0)
  @Max(1000000)
  expectedVersion!: number;
}
export class OrderCurrencyDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID("all", { each: true })
  serviceOrderIds!: string[];
}
export const conversionFields = {
  quoteId: true,
  quoteVersion: true,
  serviceOrderId: true,
  amountCents: true,
  currency: true,
  createdByName: true,
  createdAt: true,
  serviceOrder: {
    select: { id: true, title: true, status: true, amountCents: true },
  },
} as const;
@Injectable()
export class QuoteOrderService {
  constructor(
    private db: PrismaService,
    private quotas: QuotasService,
  ) {}
  async currencyContext(orgId: string, ids: string[]) {
    const orders = await this.db.serviceOrder.findMany({
      where: { orgId, id: { in: [...new Set(ids)] } },
      select: {
        id: true,
        amountCents: true,
        quoteOrigin: { select: { currency: true } },
        charges: {
          where: { orgId },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { currency: true },
        },
      },
    });
    return {
      items: orders.map((order) => ({
        serviceOrderId: order.id,
        currency:
          order.quoteOrigin?.currency ??
          (order.amountCents == null
            ? order.charges[0]?.currency
            : undefined) ??
          "BRL",
        source: order.quoteOrigin
          ? "QUOTE"
          : order.amountCents == null && order.charges[0]
            ? "CHARGE"
            : "LEGACY_BRL",
      })),
    };
  }
  private async existing(orgId: string, quoteId: string, version: number) {
    const row = await this.db.serviceQuoteOrder.findFirst({
      where: { orgId, quoteId },
      select: conversionFields,
    });
    if (row && row.quoteVersion !== version)
      throw new ConflictException("Confira a versão que originou a O.S.");
    return row;
  }
  async origin(orgId: string, serviceOrderId: string) {
    if (
      !(await this.db.serviceOrder.findFirst({
        where: { id: serviceOrderId, orgId },
        select: { id: true },
      }))
    )
      throw new NotFoundException("O.S. não encontrada");
    const row = await this.db.serviceQuoteOrder.findFirst({
      where: { orgId, serviceOrderId },
      select: conversionFields,
    });
    if (!row) return null;
    const revision = await this.db.serviceQuoteRevision.findFirst({
      where: { orgId, quoteId: row.quoteId, version: row.quoteVersion },
      select: { snapshot: true },
    });
    return { ...row, snapshot: revision.snapshot };
  }
  async convert(
    orgId: string,
    id: string,
    actorId: string,
    input: QuoteConvertDto,
  ) {
    const actor = await this.db.user.findFirst({
      where: { id: actorId, orgId, active: true },
      select: { id: true, person: { select: { id: true, name: true } } },
    });
    if (!actor) throw new UnauthorizedException();
    const replay = await this.existing(orgId, id, input.expectedVersion);
    if (replay) return replay;
    // Admission must not wait for a second pool connection while holding the conversion transaction.
    const candidate = await this.db.serviceQuote.findFirst({
      where: { id, orgId },
      select: { status: true, version: true },
    });
    if (!candidate) throw new NotFoundException("Orçamento não encontrado");
    if (
      candidate.status !== "ACCEPTED" ||
      candidate.version !== input.expectedVersion
    )
      throw new ConflictException(
        "Somente a versão aprovada pode originar uma O.S.",
      );
    await this.quotas.validateQuota(orgId, "CREATE_SERVICE_ORDER");
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM "ServiceQuote" WHERE id=${id} AND "orgId"=${orgId} FOR UPDATE`;
      if (!rows.length) throw new NotFoundException("Orçamento não encontrado");
      const existing = await tx.serviceQuoteOrder.findFirst({
        where: { orgId, quoteId: id },
        select: conversionFields,
      });
      if (existing) {
        if (existing.quoteVersion !== input.expectedVersion)
          throw new ConflictException("Confira a versão que originou a O.S.");
        return existing;
      }
      const quote = await tx.serviceQuote.findUnique({ where: { id } });
      if (
        quote.status !== "ACCEPTED" ||
        quote.version !== input.expectedVersion
      )
        throw new ConflictException(
          "Somente a versão aprovada pode originar uma O.S.",
        );
      const approval = await tx.serviceQuoteApproval.findFirst({
        where: {
          orgId,
          quoteId: id,
          quoteVersion: quote.version,
          decision: "ACCEPTED",
          respondedAt: { not: null },
        },
        select: { id: true },
      });
      if (!approval)
        throw new ConflictException(
          "Não há aprovação registrada para esta versão.",
        );
      const orgs = await tx.$queryRaw<
        Array<{ currency: string }>
      >`SELECT currency FROM "Organization" WHERE id=${orgId} FOR UPDATE`;
      const snapshot = quote.snapshot as any;
      if (orgs[0]?.currency !== snapshot.currency)
        throw new ConflictException(
          "A moeda da empresa difere do orçamento aprovado. Não há conversão cambial automática.",
        );
      const customer = await tx.customer.findFirst({
        where: { id: quote.customerId, orgId, active: true },
        select: { id: true },
      });
      if (!customer)
        throw new BadRequestException(
          "Reative o cliente antes de criar a O.S.",
        );
      const money = (cents: number) =>
        new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: snapshot.currency,
        }).format(cents / 100);
      const description = [
        `Origem: orçamento aprovado, versão ${quote.version + 1}.`,
        ...snapshot.items.map(
          (x: any) =>
            `${x.quantity} × ${x.name} — ${money(x.unitCents)} por unidade\n${x.description}`,
        ),
        `Condições aprovadas:\n${snapshot.conditions}`,
      ].join("\n\n");
      const order = await tx.serviceOrder.create({
        data: {
          orgId,
          customerId: quote.customerId,
          title: snapshot.title,
          description,
          amountCents: snapshot.totalCents,
          billingTreatment:
            snapshot.totalCents === 0 ? "QUOTE_NO_CHARGE" : "STANDARD",
          status: "OPEN",
          priority: 2,
        },
      });
      const record = await tx.serviceQuoteOrder.create({
        data: {
          orgId,
          quoteId: id,
          quoteVersion: quote.version,
          approvalId: approval.id,
          serviceOrderId: order.id,
          amountCents: snapshot.totalCents,
          currency: snapshot.currency,
          createdByUserId: actorId,
          createdByName: actor.person?.name || "Responsável",
        },
        select: conversionFields,
      });
      const metadata = {
        quoteId: id,
        quoteVersion: quote.version,
        serviceOrderId: order.id,
        approvalId: approval.id,
        actorUserId: actorId,
        amountCents: snapshot.totalCents,
        currency: snapshot.currency,
      };
      await tx.timelineEvent.create({
        data: {
          orgId,
          customerId: quote.customerId,
          serviceOrderId: order.id,
          personId: actor.person?.id,
          action: "SERVICE_ORDER_CREATED",
          description: "O.S. criada a partir de orçamento aprovado",
          metadata,
        },
      });
      await tx.auditEvent.create({
        data: {
          orgId,
          personId: actor.person?.id,
          action: "SERVICE_ORDER_CREATED",
          context: "QuoteOrderConversion",
          metadata,
        },
      });
      return record;
    });
  }
}
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteOrderController {
  constructor(private service: QuoteOrderService) {}
  @Post("service-orders/currency-context")
  @Roles("ADMIN", "MANAGER", "STAFF", "VIEWER")
  currencyContext(@Org() org: string, @Body() body: OrderCurrencyDto) {
    return this.service.currencyContext(org, body.serviceOrderIds);
  }
  @Get("service-orders/:id/quote-origin")
  @Roles("ADMIN", "MANAGER", "STAFF", "VIEWER")
  origin(@Org() org: string, @Param("id") id: string) {
    return this.service.origin(org, id).then((origin) => ({ origin }));
  }
  @Post("service-quotes/:id/convert") @Roles("ADMIN", "MANAGER") convert(
    @Org() org: string,
    @Param("id") id: string,
    @User() user: any,
    @Body() body: QuoteConvertDto,
  ) {
    const actor = user?.userId ?? user?.sub;
    if (!actor) throw new UnauthorizedException();
    return this.service.convert(org, id, String(actor), body);
  }
}
