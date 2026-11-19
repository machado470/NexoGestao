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
  Query,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { QuotasService } from "../quotas/quotas.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Org } from "../auth/decorators/org.decorator";
import { User } from "../auth/decorators/user.decorator";
export class ReturnCreateDto {
  @IsUUID() entryKey!: string;
  @IsIn(["WARRANTY", "REWORK"]) kind!: "WARRANTY" | "REWORK";
  @IsString() @MinLength(3) @MaxLength(140) title!: string;
  @IsString() @MinLength(10) @MaxLength(2000) reason!: string;
  @IsOptional() @IsUUID() sourceAcceptanceId?: string;
}
const orderFields = { id: true, title: true, status: true } as const;
const fields = {
  id: true,
  kind: true,
  title: true,
  reason: true,
  originalTitle: true,
  sourceAcceptanceId: true,
  createdByName: true,
  createdAt: true,
  child: { select: orderFields },
  original: { select: orderFields },
} as const;
@Injectable()
export class ServiceOrderReturnsService {
  constructor(
    private readonly db: PrismaService,
    private readonly quotas: QuotasService,
  ) {}
  async list(orgId: string, orderId: string, page = 1) {
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException("Página inválida");
    if (
      !(await this.db.serviceOrder.findFirst({
        where: { id: orderId, orgId },
        select: { id: true },
      }))
    )
      throw new NotFoundException("O.S. não encontrada");
    const where = { orgId, originalOrderId: orderId };
    const [items, total, origin, issues] = await Promise.all([
      this.db.serviceOrderReturn.findMany({
        where,
        select: fields,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * 10,
        take: 10,
      }),
      this.db.serviceOrderReturn.count({ where }),
      this.db.serviceOrderReturn.findFirst({
        where: { orgId, childOrderId: orderId },
        select: fields,
      }),
      this.db.serviceOrderAcceptance.findMany({
        where: { orgId, serviceOrderId: orderId, decision: "ISSUE" },
        select: {
          id: true,
          publicTitle: true,
          responseNote: true,
          respondedAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
      }),
    ]);
    return {
      items,
      total,
      origin,
      issues,
      page,
      pages: Math.max(1, Math.ceil(total / 10)),
    };
  }
  async create(
    orgId: string,
    originalOrderId: string,
    actorId: string,
    input: ReturnCreateDto,
  ) {
    const title = input.title.trim(),
      reason = input.reason.trim(),
      sourceAcceptanceId = input.sourceAcceptanceId || null;
    if (title.length < 3 || reason.length < 10)
      throw new BadRequestException(
        "Revise o título e descreva o motivo do retorno",
      );
    const actor = await this.db.user.findFirst({
      where: { id: actorId, orgId, active: true },
      select: { id: true, person: { select: { id: true, name: true } } },
    });
    if (!actor) throw new UnauthorizedException();
    const replay = await this.db.serviceOrderReturn.findUnique({
      where: {
        orgId_originalOrderId_entryKey: {
          orgId,
          originalOrderId,
          entryKey: input.entryKey,
        },
      },
    });
    if (replay) {
      if (
        replay.title !== title ||
        replay.reason !== reason ||
        replay.kind !== input.kind ||
        replay.sourceAcceptanceId !== sourceAcceptanceId ||
        replay.createdByUserId !== actorId
      )
        throw new ConflictException("Tentativa já utilizada com outros dados");
      return this.db.serviceOrderReturn.findUnique({
        where: { id: replay.id },
        select: fields,
      });
    }
    // Admission uses the regular Prisma pool; never hold an interactive transaction
    // while asking QuotasService to obtain another connection from that same pool.
    await this.quotas.validateQuota(orgId, "CREATE_SERVICE_ORDER");
    return this.db.$transaction(async (tx) => {
      const orders = await tx.$queryRaw<
        Array<{ status: string; title: string; customerId: string }>
      >`SELECT status, title, "customerId" FROM "ServiceOrder" WHERE id = ${originalOrderId} AND "orgId" = ${orgId} FOR UPDATE`;
      if (!orders.length) throw new NotFoundException("O.S. não encontrada");
      const original = orders[0];
      const existing = await tx.serviceOrderReturn.findUnique({
        where: {
          orgId_originalOrderId_entryKey: {
            orgId,
            originalOrderId,
            entryKey: input.entryKey,
          },
        },
      });
      if (existing) {
        if (
          existing.title !== title ||
          existing.reason !== reason ||
          existing.kind !== input.kind ||
          existing.sourceAcceptanceId !== sourceAcceptanceId ||
          existing.createdByUserId !== actorId
        )
          throw new ConflictException(
            "Tentativa já utilizada com outros dados",
          );
        return tx.serviceOrderReturn.findUnique({
          where: { id: existing.id },
          select: fields,
        });
      }
      if (original.status !== "DONE")
        throw new ConflictException(
          "Somente uma O.S. concluída pode originar um retorno",
        );
      if (
        sourceAcceptanceId &&
        !(await tx.serviceOrderAcceptance.findFirst({
          where: {
            id: sourceAcceptanceId,
            orgId,
            serviceOrderId: originalOrderId,
            decision: "ISSUE",
          },
          select: { id: true },
        }))
      )
        throw new BadRequestException(
          "O relato deve ser um problema registrado nesta O.S.",
        );
      // Deliberate return operation: no inherited money, dates, assignee or messaging.
      const child = await tx.serviceOrder.create({
        data: {
          orgId,
          customerId: original.customerId,
          title,
          description: reason,
          status: "OPEN",
          priority: 2,
        },
      });
      const record = await tx.serviceOrderReturn.create({
        data: {
          orgId,
          originalOrderId,
          childOrderId: child.id,
          entryKey: input.entryKey,
          kind: input.kind,
          title,
          reason,
          originalTitle: original.title,
          sourceAcceptanceId,
          createdByUserId: actorId,
          createdByName: actor.person?.name || "Profissional",
        },
        select: fields,
      });
      const metadata = {
        returnCaseId: record.id,
        originalServiceOrderId: originalOrderId,
        childServiceOrderId: child.id,
        kind: input.kind,
        sourceAcceptanceId,
        actorUserId: actorId,
      };
      await tx.timelineEvent.createMany({
        data: [
          {
            orgId,
            serviceOrderId: originalOrderId,
            customerId: original.customerId,
            personId: actor.person?.id,
            action: "SERVICE_ORDER_UPDATED",
            description: `Retorno aberto: ${title}`,
            metadata,
          },
          {
            orgId,
            serviceOrderId: child.id,
            customerId: original.customerId,
            personId: actor.person?.id,
            action: "SERVICE_ORDER_CREATED",
            description: `O.S. de retorno criada: ${title}`,
            metadata,
          },
        ],
      });
      await tx.auditEvent.create({
        data: {
          orgId,
          personId: actor.person?.id,
          action: "SERVICE_ORDER_CREATED",
          context: "ServiceOrderReturn",
          metadata,
        },
      });
      return record;
    });
  }
}
@Controller("service-orders/:serviceOrderId/returns")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceOrderReturnsController {
  constructor(private readonly service: ServiceOrderReturnsService) {}
  @Get()
  @Roles("ADMIN", "MANAGER", "STAFF", "VIEWER")
  list(
    @Org() org: string,
    @Param("serviceOrderId") id: string,
    @Query("page") page?: string,
  ) {
    return this.service.list(org, id, page ? Number(page) : 1);
  }
  @Post()
  @Roles("ADMIN", "MANAGER", "STAFF")
  create(
    @Org() org: string,
    @Param("serviceOrderId") id: string,
    @User() user: any,
    @Body() body: ReturnCreateDto,
  ) {
    const actorId = user?.userId ?? user?.sub;
    if (!actorId) throw new UnauthorizedException();
    return this.service.create(org, id, actorId, body);
  }
}
