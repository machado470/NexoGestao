import { Throttle } from "@nestjs/throttler";
import { MINUTE_MS, bodyTokenTracker } from "../common/throttling/throttling";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  Injectable,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Equals,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { Transform } from "class-transformer";
import { createHash, createHmac, randomUUID } from "crypto";
import { Prisma, ServiceOrderAcceptance } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { resolveJwtSecret } from "../auth/jwt-secret";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { Org } from "../auth/decorators/org.decorator";
import { User } from "../auth/decorators/user.decorator";
export class AcceptanceCreateDto {
  @IsUUID() entryKey!: string;
  @IsString() @MinLength(3) @MaxLength(160) publicTitle!: string;
  @IsString() @MinLength(10) @MaxLength(1000) publicSummary!: string;
}
export class AcceptanceTokenDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) token!: string;
}
export class AcceptanceResponseDto extends AcceptanceTokenDto {
  @IsUUID() responseKey!: string;
  @IsIn(["ACCEPTED", "ISSUE"]) decision!: "ACCEPTED" | "ISSUE";
  @IsString() @MinLength(2) @MaxLength(120) respondentName!: string;
  @IsOptional() @IsString() @MaxLength(1000) responseNote?: string;
  @Transform(({ obj, key }) => obj[key]) @Equals(true) confirmed!: boolean;
}
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const fields = {
  id: true,
  publicTitle: true,
  publicSummary: true,
  createdAt: true,
  expiresAt: true,
  revokedAt: true,
  decision: true,
  respondentName: true,
  responseNote: true,
  respondedAt: true,
} as const;
@Injectable()
export class ServiceOrderAcceptanceService {
  private readonly secret: string;
  constructor(
    private readonly db: PrismaService,
    config: ConfigService,
  ) {
    this.secret = resolveJwtSecret(config);
  }
  private token(org: string, order: string, key: string) {
    return createHmac("sha256", this.secret)
      .update(`nexo:service-acceptance:v1:${org}:${order}:${key}`)
      .digest("hex");
  }
  private async lockOrder(
    tx: Prisma.TransactionClient,
    org: string,
    id: string,
  ) {
    const orders = await tx.$queryRaw<
      Array<{ status: string; updatedAt: Date; customerId: string }>
    >`SELECT status, "updatedAt", "customerId" FROM "ServiceOrder" WHERE id = ${id} AND "orgId" = ${org} FOR UPDATE`;
    if (!orders.length) throw new NotFoundException("O.S. não encontrada");
    return orders[0];
  }
  private async log(
    tx: Prisma.TransactionClient,
    orgId: string,
    serviceOrderId: string,
    customerId: string,
    description: string,
    metadata: Prisma.InputJsonObject,
  ) {
    await tx.timelineEvent.create({
      data: {
        orgId,
        serviceOrderId,
        customerId,
        action: "SERVICE_ORDER_UPDATED",
        description,
        metadata,
      },
    });
    await tx.auditEvent.create({
      data: {
        orgId,
        action: "SERVICE_ORDER_UPDATED",
        context: "ServiceOrderAcceptance",
        metadata: { ...metadata, serviceOrderId },
      },
    });
  }
  async list(orgId: string, serviceOrderId: string) {
    if (
      !(await this.db.serviceOrder.findFirst({
        where: { id: serviceOrderId, orgId },
        select: { id: true },
      }))
    )
      throw new NotFoundException("O.S. não encontrada");
    return this.db.serviceOrderAcceptance.findMany({
      where: { orgId, serviceOrderId },
      select: fields,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
    });
  }
  async create(
    orgId: string,
    serviceOrderId: string,
    actorId: string,
    input: AcceptanceCreateDto,
  ) {
    const publicTitle = input.publicTitle.trim(),
      publicSummary = input.publicSummary.trim();
    if (publicTitle.length < 3 || publicSummary.length < 10)
      throw new BadRequestException(
        "Revise o título e o resumo compartilhados",
      );
    const actor = await this.db.user.findFirst({
      where: { id: actorId, orgId, active: true },
      select: { id: true },
    });
    if (!actor) throw new UnauthorizedException();
    const token = this.token(orgId, serviceOrderId, input.entryKey);
    return this.db.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, orgId, serviceOrderId);
      const existing = await tx.serviceOrderAcceptance.findUnique({
        where: {
          orgId_serviceOrderId_entryKey: {
            orgId,
            serviceOrderId,
            entryKey: input.entryKey,
          },
        },
      });
      if (existing) {
        if (
          existing.publicTitle !== publicTitle ||
          existing.publicSummary !== publicSummary ||
          existing.createdByUserId !== actorId ||
          existing.tokenHash !== hash(token)
        )
          throw new ConflictException(
            "Tentativa já utilizada com outros dados",
          );
        if (
          existing.revokedAt ||
          existing.respondedAt ||
          existing.expiresAt <= new Date() ||
          existing.orderVersion.getTime() !== order.updatedAt.getTime() ||
          order.status !== "DONE"
        )
          throw new ConflictException(
            "Este link não está mais disponível. Confira o histórico antes de gerar outro.",
          );
        return { id: existing.id, token, expiresAt: existing.expiresAt };
      }
      if (order.status !== "DONE")
        throw new ConflictException("Conclua a O.S. antes de solicitar aceite");
      if (
        (await tx.serviceOrderAcceptance.count({
          where: { orgId, serviceOrderId },
        })) >= 20
      )
        throw new ConflictException(
          "Limite de 20 solicitações por O.S. atingido",
        );
      const org = await tx.organization.findUnique({
        where: { id: orgId },
        select: { name: true },
      });
      const now = new Date();
      await tx.serviceOrderAcceptance.updateMany({
        where: { orgId, serviceOrderId, respondedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      const record = await tx.serviceOrderAcceptance.create({
        data: {
          id: randomUUID(),
          orgId,
          serviceOrderId,
          entryKey: input.entryKey,
          tokenHash: hash(token),
          publicTitle,
          publicSummary,
          companyName: org.name,
          orderVersion: order.updatedAt,
          createdByUserId: actorId,
          createdAt: now,
          expiresAt: new Date(now.getTime() + 72 * 3600000),
        },
      });
      await this.log(
        tx,
        orgId,
        serviceOrderId,
        order.customerId,
        "Link de aceite do cliente gerado",
        { acceptanceId: record.id, actorUserId: actorId },
      );
      return { id: record.id, token, expiresAt: record.expiresAt };
    });
  }
  async revoke(
    orgId: string,
    serviceOrderId: string,
    id: string,
    actorId: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, orgId, serviceOrderId);
      const record = await tx.serviceOrderAcceptance.findFirst({
        where: { id, orgId, serviceOrderId },
      });
      if (!record) throw new NotFoundException("Solicitação não encontrada");
      if (!record.revokedAt) {
        await tx.serviceOrderAcceptance.update({
          where: { id },
          data: { revokedAt: new Date() },
        });
        await this.log(
          tx,
          orgId,
          serviceOrderId,
          order.customerId,
          "Link de aceite revogado",
          { acceptanceId: id, actorUserId: actorId },
        );
      }
      return { revoked: true };
    });
  }
  private valid(record: ServiceOrderAcceptance | null) {
    if (!record || record.revokedAt || record.expiresAt <= new Date())
      throw new NotFoundException(
        "Link indisponível ou expirado. Solicite um novo link à empresa.",
      );
    return record;
  }
  private present(record: ServiceOrderAcceptance) {
    return {
      companyName: record.companyName,
      publicTitle: record.publicTitle,
      publicSummary: record.publicSummary,
      expiresAt: record.expiresAt,
      decision: record.decision,
      respondedAt: record.respondedAt,
    };
  }
  async view(token: string) {
    const record = this.valid(
      await this.db.serviceOrderAcceptance.findUnique({
        where: { tokenHash: hash(token) },
      }),
    );
    if (!record.respondedAt) {
      const order = await this.db.serviceOrder.findFirst({
        where: {
          id: record.serviceOrderId,
          orgId: record.orgId,
          status: "DONE",
          updatedAt: record.orderVersion,
        },
        select: { id: true },
      });
      if (!order)
        throw new NotFoundException(
          "Link indisponível. Solicite um novo link à empresa.",
        );
    }
    return this.present(record);
  }
  async respond(input: AcceptanceResponseDto) {
    const name = input.respondentName.trim(),
      note = input.responseNote?.trim() || null;
    if (
      !input.confirmed ||
      name.length < 2 ||
      (input.decision === "ISSUE" && (!note || note.length < 10))
    )
      throw new BadRequestException(
        "Informe seu nome, confirme a decisão e descreva o problema quando necessário",
      );
    const found = await this.db.serviceOrderAcceptance.findUnique({
      where: { tokenHash: hash(input.token) },
    });
    this.valid(found);
    return this.db.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, found.orgId, found.serviceOrderId);
      const record = this.valid(
        await tx.serviceOrderAcceptance.findUnique({ where: { id: found.id } }),
      );
      if (record.respondedAt) {
        if (
          record.responseKey !== input.responseKey ||
          record.decision !== input.decision ||
          record.respondentName !== name ||
          record.responseNote !== note
        )
          throw new ConflictException(
            "Este link já recebeu uma resposta. Consulte a empresa para solicitar revisão.",
          );
        return this.present(record);
      }
      if (
        order.status !== "DONE" ||
        order.updatedAt.getTime() !== record.orderVersion.getTime()
      )
        throw new ConflictException(
          "O serviço mudou. Solicite um novo link à empresa.",
        );
      const updated = await tx.serviceOrderAcceptance.update({
        where: { id: record.id },
        data: {
          decision: input.decision,
          respondentName: name,
          responseNote: note,
          responseKey: input.responseKey,
          respondedAt: new Date(),
        },
      });
      await this.log(
        tx,
        found.orgId,
        found.serviceOrderId,
        order.customerId,
        input.decision === "ACCEPTED"
          ? "Cliente confirmou a entrega por link"
          : "Cliente apontou problema na entrega",
        {
          acceptanceId: found.id,
          decision: input.decision,
          identityMethod: "BEARER_LINK_SELF_DECLARED_NAME",
        },
      );
      return this.present(updated);
    });
  }
}
@Controller("service-orders/:serviceOrderId/acceptances")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceOrderAcceptanceController {
  constructor(private readonly service: ServiceOrderAcceptanceService) {}
  private actor(user: any) {
    const id = user?.userId ?? user?.sub;
    if (!id) throw new UnauthorizedException();
    return String(id);
  }
  @Get() @Roles("ADMIN", "MANAGER", "STAFF", "VIEWER") list(
    @Org() org: string,
    @Param("serviceOrderId") id: string,
  ) {
    return this.service.list(org, id);
  }
  @Post() @Roles("ADMIN", "MANAGER", "STAFF") create(
    @Org() org: string,
    @Param("serviceOrderId") id: string,
    @User() user: any,
    @Body() body: AcceptanceCreateDto,
  ) {
    return this.service.create(org, id, this.actor(user), body);
  }
  @Post(":id/revoke") @Roles("ADMIN", "MANAGER", "STAFF") revoke(
    @Org() org: string,
    @Param("serviceOrderId") order: string,
    @Param("id") id: string,
    @User() user: any,
  ) {
    return this.service.revoke(org, order, id, this.actor(user));
  }
}
@Throttle({ default: { limit: 30, ttl: MINUTE_MS, getTracker: bodyTokenTracker } })
@Controller("service-acceptance")
export class PublicServiceAcceptanceController {
  constructor(private readonly service: ServiceOrderAcceptanceService) {}
  @Public() @Post("view") @Header("Cache-Control", "private, no-store") view(
    @Body() input: AcceptanceTokenDto,
  ) {
    return this.service.view(input.token);
  }
  @Public()
  @Post("respond")
  @Header("Cache-Control", "private, no-store")
  respond(@Body() input: AcceptanceResponseDto) {
    return this.service.respond(input);
  }
}
