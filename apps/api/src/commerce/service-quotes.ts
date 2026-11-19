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
  Query,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { createHash, createHmac } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { resolveJwtSecret } from "../auth/jwt-secret";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { Org } from "../auth/decorators/org.decorator";
import { User } from "../auth/decorators/user.decorator";
export class QuoteLineDto {
  @IsUUID() serviceId!: string;
  @Transform(({ obj, key }) => obj[key])
  @IsInt()
  @Min(0)
  @Max(1000000)
  serviceVersion!: number;
  @Transform(({ obj, key }) => obj[key])
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;
  @Transform(({ obj, key }) => obj[key])
  @IsInt()
  @Min(0)
  @Max(2147483647)
  unitCents!: number;
}
export class QuoteValuesDto {
  @IsString() @MinLength(3) @MaxLength(140) title!: string;
  @IsString() @MinLength(10) @MaxLength(3000) conditions!: string;
  @IsString() @Matches(/^[A-Z]{3}$/) expectedCurrency!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineDto)
  items!: QuoteLineDto[];
}
export class QuoteCreateDto extends QuoteValuesDto {
  @IsUUID() customerId!: string;
  @IsUUID() entryKey!: string;
}
export class QuoteReviseDto extends QuoteValuesDto {
  @Transform(({ obj, key }) => obj[key])
  @IsInt()
  @Min(0)
  @Max(1000000)
  expectedVersion!: number;
  @IsString() @MinLength(10) @MaxLength(1000) reason!: string;
}
export class QuoteShareDto {
  @IsUUID() entryKey!: string;
  @Transform(({ obj, key }) => obj[key])
  @IsInt()
  @Min(0)
  @Max(1000000)
  expectedVersion!: number;
}
export class QuoteTokenDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) token!: string;
}
export class QuoteAnswerDto extends QuoteTokenDto {
  @IsUUID() responseKey!: string;
  @IsIn(["ACCEPTED", "REJECTED"]) decision!: "ACCEPTED" | "REJECTED";
  @IsString() @MinLength(2) @MaxLength(120) respondentName!: string;
  @IsOptional() @IsString() @MaxLength(1000) responseNote?: string;
  @Transform(({ obj, key }) => obj[key]) @Equals(true) confirmed!: boolean;
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const publicQuote = (item: any) => ({
  id: item.id,
  customerId: item.customerId,
  customerName: item.customerName,
  version: item.version,
  status: item.status,
  snapshot: item.snapshot,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});
const receiptFields = {
  id: true,
  quoteVersion: true,
  createdAt: true,
  expiresAt: true,
  revokedAt: true,
  decision: true,
  respondentName: true,
  responseNote: true,
  respondedAt: true,
} as const;
const brief = (items: any[]) =>
  items.map((x) => ({
    serviceId: x.serviceId,
    serviceVersion: x.serviceVersion,
    quantity: x.quantity,
    unitCents: x.unitCents,
  }));
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
@Injectable()
export class ServiceQuotesService {
  private secret: string;
  constructor(
    private db: PrismaService,
    config: ConfigService,
  ) {
    this.secret = resolveJwtSecret(config);
  }
  private token(org: string, id: string, key: string) {
    return createHmac("sha256", this.secret)
      .update(`nexo:quote-approval:v1:${org}:${id}:${key}`)
      .digest("hex");
  }
  private async actor(tx: any, orgId: string, id: string) {
    const actor = await tx.user.findFirst({
      where: { id, orgId, active: true },
      select: { id: true, person: { select: { name: true } } },
    });
    if (!actor) throw new UnauthorizedException();
    return { id, name: actor.person?.name || "Responsável" };
  }
  private async lock(tx: any, orgId: string, id: string) {
    const rows = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM "ServiceQuote" WHERE id=${id} AND "orgId"=${orgId} FOR UPDATE`;
    if (!rows.length) throw new NotFoundException("Orçamento não encontrado");
    return tx.serviceQuote.findUnique({ where: { id } });
  }
  private values(input: QuoteValuesDto) {
    if (input.title.trim().length < 3 || input.conditions.trim().length < 10)
      throw new BadRequestException(
        "Revise o título e as condições do orçamento",
      );
    return {
      title: input.title.trim(),
      conditions: input.conditions.trim(),
      currency: input.expectedCurrency,
    };
  }
  private async build(
    tx: any,
    orgId: string,
    input: QuoteValuesDto,
    previous?: any,
  ) {
    const values = this.values(input),
      ids = [...new Set(input.items.map((x) => x.serviceId))].sort();
    await tx.$queryRaw`SELECT id FROM "CatalogService" WHERE "orgId"=${orgId} AND id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`;
    const items = [];
    let totalCents = 0;
    for (const line of input.items) {
      const preserved = previous?.items?.some(
        (x: any) =>
          x.serviceId === line.serviceId &&
          x.serviceVersion === line.serviceVersion,
      );
      const service = await tx.catalogService.findFirst({
        where: { id: line.serviceId, orgId },
      });
      if (
        !service ||
        (!preserved &&
          (!service.active || service.version !== line.serviceVersion))
      )
        throw new ConflictException(
          "Um serviço mudou ou foi arquivado. Revise a seleção antes de salvar.",
        );
      const revision = await tx.catalogServiceRevision.findFirst({
        where: {
          orgId,
          serviceId: line.serviceId,
          version: line.serviceVersion,
        },
      });
      const source = revision?.snapshot as any;
      if (!source || source.currency !== values.currency)
        throw new BadRequestException(
          "Todos os serviços devem usar a moeda do orçamento. Não há conversão automática.",
        );
      const lineCents = line.quantity * line.unitCents;
      totalCents += lineCents;
      if (!Number.isSafeInteger(totalCents) || totalCents > 2147483647)
        throw new BadRequestException("O total excede o limite permitido.");
      items.push({
        ...line,
        code: source.code,
        name: source.name,
        description: source.description,
        durationMinutes: source.durationMinutes,
        lineCents,
      });
    }
    return { ...values, items, totalCents };
  }
  private async log(tx: any, quote: any, action: string, metadata: any) {
    await tx.timelineEvent.create({
      data: {
        orgId: quote.orgId,
        customerId: quote.customerId,
        action: "QUOTE_UPDATED",
        description: action,
        metadata: { ...metadata, quoteId: quote.id },
      },
    });
    await tx.auditEvent.create({
      data: {
        orgId: quote.orgId,
        action: "QUOTE_UPDATED",
        context: "ServiceQuote",
        metadata: { ...metadata, quoteId: quote.id },
      },
    });
  }
  private async revision(tx: any, quote: any, actor: any, reason: string) {
    await tx.serviceQuoteRevision.create({
      data: {
        orgId: quote.orgId,
        quoteId: quote.id,
        version: quote.version,
        snapshot: quote.snapshot,
        reason,
        actorUserId: actor.id,
        actorName: actor.name,
      },
    });
    await this.log(tx, quote, "Orçamento registrado por versão", {
      version: quote.version,
      reason,
      actorUserId: actor.id,
    });
  }
  async list(orgId: string, page = 1) {
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException("Página inválida");
    const where = { orgId };
    const [items, total] = await this.db.$transaction([
      this.db.serviceQuote.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * 10,
        take: 10,
      }),
      this.db.serviceQuote.count({ where }),
    ]);
    return {
      items: items.map(publicQuote),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / 10)),
    };
  }
  async detail(orgId: string, id: string, page = 1) {
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException("Página inválida");
    const item = await this.db.serviceQuote.findFirst({ where: { id, orgId } });
    if (!item) throw new NotFoundException("Orçamento não encontrado");
    const where = { orgId, quoteId: id };
    const [revisions, total, approvals] = await Promise.all([
      this.db.serviceQuoteRevision.findMany({
        where,
        orderBy: { version: "desc" },
        skip: (page - 1) * 5,
        take: 5,
        select: {
          version: true,
          snapshot: true,
          reason: true,
          actorName: true,
          createdAt: true,
        },
      }),
      this.db.serviceQuoteRevision.count({ where }),
      this.db.serviceQuoteApproval.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10,
        select: receiptFields,
      }),
    ]);
    return {
      quote: publicQuote(item),
      revisions,
      approvals,
      page,
      pages: Math.max(1, Math.ceil(total / 5)),
    };
  }
  async create(orgId: string, actorId: string, input: QuoteCreateDto) {
    return this.db.$transaction(async (tx) => {
      const actor = await this.actor(tx, orgId, actorId),
        values = this.values(input);
      const orgs = await tx.$queryRaw<
        Array<{ currency: string }>
      >`SELECT currency FROM "Organization" WHERE id=${orgId} FOR UPDATE`;
      const found = await tx.serviceQuote.findUnique({
        where: { orgId_entryKey: { orgId, entryKey: input.entryKey } },
      });
      if (found) {
        const first = await tx.serviceQuoteRevision.findUnique({
            where: { quoteId_version: { quoteId: found.id, version: 0 } },
          }),
          old = first?.snapshot as any;
        if (
          found.createdByUserId !== actorId ||
          found.customerId !== input.customerId ||
          !old ||
          !equal(
            { ...values, items: brief(input.items) },
            {
              title: old.title,
              conditions: old.conditions,
              currency: old.currency,
              items: brief(old.items),
            },
          )
        )
          throw new ConflictException(
            "Tentativa já utilizada com outros dados",
          );
        return publicQuote(found);
      }
      if (orgs[0]?.currency !== input.expectedCurrency)
        throw new ConflictException(
          "A moeda da empresa mudou. Atualize a página.",
        );
      const customer = await tx.customer.findFirst({
        where: { id: input.customerId, orgId, active: true },
        select: { id: true, name: true },
      });
      if (!customer)
        throw new BadRequestException(
          "Selecione um cliente ativo desta empresa",
        );
      const snapshot = await this.build(tx, orgId, input);
      const item = await tx.serviceQuote.create({
        data: {
          orgId,
          customerId: customer.id,
          customerName: customer.name,
          entryKey: input.entryKey,
          createdByUserId: actorId,
          snapshot,
        },
      });
      await this.revision(tx, item, actor, "Orçamento inicial registrado");
      return publicQuote(item);
    });
  }
  async revise(
    orgId: string,
    id: string,
    actorId: string,
    input: QuoteReviseDto,
  ) {
    return this.db.$transaction(async (tx) => {
      const actor = await this.actor(tx, orgId, actorId),
        item = await this.lock(tx, orgId, id),
        reason = input.reason.trim(),
        values = this.values(input),
        old = item.snapshot as any;
      if (reason.length < 10)
        throw new BadRequestException("Informe o motivo da revisão");
      const matches = equal(
        { ...values, items: brief(input.items) },
        {
          title: old.title,
          conditions: old.conditions,
          currency: old.currency,
          items: brief(old.items),
        },
      );
      if (item.version === input.expectedVersion + 1 && matches) {
        const last = await tx.serviceQuoteRevision.findUnique({
          where: { quoteId_version: { quoteId: id, version: item.version } },
        });
        if (last?.actorUserId === actorId && last.reason === reason)
          return publicQuote(item);
      }
      if (item.status === "ACCEPTED")
        throw new ConflictException(
          "Orçamento aprovado é preservado. Crie outro orçamento para novas condições.",
        );
      if (item.version !== input.expectedVersion)
        throw new ConflictException(
          "O orçamento mudou. Feche e reabra o formulário para revisar a versão atual.",
        );
      if (old.currency !== input.expectedCurrency)
        throw new BadRequestException(
          "A moeda do orçamento não pode ser alterada.",
        );
      const snapshot = await this.build(tx, orgId, input, old);
      await tx.serviceQuoteApproval.updateMany({
        where: { orgId, quoteId: id, respondedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const updated = await tx.serviceQuote.update({
        where: { id },
        data: { version: { increment: 1 }, status: "DRAFT", snapshot },
      });
      await this.revision(tx, updated, actor, reason);
      return publicQuote(updated);
    });
  }
  async share(
    orgId: string,
    id: string,
    actorId: string,
    input: QuoteShareDto,
  ) {
    return this.db.$transaction(async (tx) => {
      await this.actor(tx, orgId, actorId);
      const item = await this.lock(tx, orgId, id),
        token = this.token(orgId, id, input.entryKey),
        now = new Date();
      const existing = await tx.serviceQuoteApproval.findUnique({
        where: {
          orgId_quoteId_entryKey: {
            orgId,
            quoteId: id,
            entryKey: input.entryKey,
          },
        },
      });
      if (existing) {
        if (
          existing.createdByUserId !== actorId ||
          existing.quoteVersion !== input.expectedVersion ||
          existing.quoteVersion !== item.version ||
          existing.revokedAt ||
          existing.respondedAt ||
          existing.expiresAt <= now ||
          existing.tokenHash !== hash(token)
        )
          throw new ConflictException(
            "Tentativa anterior já finalizada. Confira o orçamento e gere um novo link quando permitido.",
          );
        return { id: existing.id, token, expiresAt: existing.expiresAt };
      }
      if (
        item.version !== input.expectedVersion ||
        !["DRAFT", "SHARED"].includes(item.status)
      )
        throw new ConflictException(
          "Revise o orçamento antes de compartilhar esta versão.",
        );
      const org = await tx.organization.findUnique({
        where: { id: orgId },
        select: { name: true },
      });
      await tx.serviceQuoteApproval.updateMany({
        where: { orgId, quoteId: id, respondedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      const link = await tx.serviceQuoteApproval.create({
        data: {
          orgId,
          quoteId: id,
          quoteVersion: item.version,
          entryKey: input.entryKey,
          tokenHash: hash(token),
          companyName: org.name,
          createdByUserId: actorId,
          expiresAt: new Date(now.getTime() + 72 * 3600000),
        },
      });
      await tx.serviceQuote.update({
        where: { id },
        data: { status: "SHARED" },
      });
      await this.log(tx, item, "Link de orçamento gerado", {
        approvalId: link.id,
        version: item.version,
        actorUserId: actorId,
      });
      return { id: link.id, token, expiresAt: link.expiresAt };
    });
  }
  async revoke(orgId: string, id: string, linkId: string, actorId: string) {
    return this.db.$transaction(async (tx) => {
      await this.actor(tx, orgId, actorId);
      const quote = await this.lock(tx, orgId, id),
        record = await tx.serviceQuoteApproval.findFirst({
          where: { id: linkId, quoteId: id, orgId },
        });
      if (!record) throw new NotFoundException("Link não encontrado");
      if (!record.revokedAt) {
        await tx.serviceQuoteApproval.update({
          where: { id: linkId },
          data: { revokedAt: new Date() },
        });
        if (
          !record.respondedAt &&
          record.quoteVersion === quote.version &&
          quote.status === "SHARED"
        )
          await tx.serviceQuote.update({
            where: { id },
            data: { status: "DRAFT" },
          });
        await this.log(tx, quote, "Link de orçamento revogado", {
          approvalId: linkId,
          actorUserId: actorId,
        });
      }
      return { revoked: true };
    });
  }
  private valid(record: any) {
    if (!record || record.revokedAt || record.expiresAt <= new Date())
      throw new NotFoundException(
        "Link indisponível ou expirado. Solicite outro à empresa.",
      );
    return record;
  }
  private async present(tx: any, link: any) {
    const rev = await tx.serviceQuoteRevision.findUnique({
        where: {
          quoteId_version: {
            quoteId: link.quoteId,
            version: link.quoteVersion,
          },
        },
      }),
      s = rev.snapshot as any;
    return {
      companyName: link.companyName,
      version: link.quoteVersion,
      title: s.title,
      conditions: s.conditions,
      currency: s.currency,
      totalCents: s.totalCents,
      items: s.items.map(
        ({
          name,
          description,
          quantity,
          unitCents,
          lineCents,
          durationMinutes,
        }: any) => ({
          name,
          description,
          quantity,
          unitCents,
          lineCents,
          durationMinutes,
        }),
      ),
      expiresAt: link.expiresAt,
      decision: link.decision,
      respondedAt: link.respondedAt,
    };
  }
  async view(token: string) {
    return this.db.$transaction(async (tx) => {
      const found = this.valid(
        await tx.serviceQuoteApproval.findUnique({
          where: { tokenHash: hash(token) },
        }),
      );
      const item = await this.lock(tx, found.orgId, found.quoteId),
        link = this.valid(
          await tx.serviceQuoteApproval.findUnique({ where: { id: found.id } }),
        );
      if (
        !link.respondedAt &&
        (item.version !== link.quoteVersion || item.status !== "SHARED")
      )
        throw new NotFoundException(
          "Link indisponível. Solicite outro à empresa.",
        );
      return this.present(tx, link);
    });
  }
  async respond(input: QuoteAnswerDto) {
    const name = input.respondentName.trim(),
      note = input.responseNote?.trim() || null;
    if (
      !input.confirmed ||
      name.length < 2 ||
      (input.decision === "REJECTED" && (!note || note.length < 10))
    )
      throw new BadRequestException(
        "Confirme sua decisão e descreva o motivo da recusa.",
      );
    return this.db.$transaction(async (tx) => {
      const found = this.valid(
          await tx.serviceQuoteApproval.findUnique({
            where: { tokenHash: hash(input.token) },
          }),
        ),
        quote = await this.lock(tx, found.orgId, found.quoteId),
        link = this.valid(
          await tx.serviceQuoteApproval.findUnique({ where: { id: found.id } }),
        );
      if (link.respondedAt) {
        if (
          link.responseKey !== input.responseKey ||
          link.decision !== input.decision ||
          link.respondentName !== name ||
          link.responseNote !== note
        )
          throw new ConflictException(
            "Este link já recebeu uma resposta. Consulte a empresa.",
          );
        return this.present(tx, link);
      }
      if (quote.version !== link.quoteVersion || quote.status !== "SHARED")
        throw new ConflictException(
          "O orçamento mudou. Solicite outro link à empresa.",
        );
      const updated = await tx.serviceQuoteApproval.update({
        where: { id: link.id },
        data: {
          decision: input.decision,
          responseKey: input.responseKey,
          respondentName: name,
          responseNote: note,
          respondedAt: new Date(),
        },
      });
      await tx.serviceQuote.update({
        where: { id: quote.id },
        data: { status: input.decision },
      });
      await this.log(
        tx,
        quote,
        input.decision === "ACCEPTED"
          ? "Orçamento aprovado por link"
          : "Orçamento recusado por link",
        {
          approvalId: link.id,
          version: link.quoteVersion,
          decision: input.decision,
          identityMethod: "BEARER_LINK_SELF_DECLARED_NAME",
        },
      );
      return this.present(tx, updated);
    });
  }
}
@Controller("service-quotes")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceQuotesController {
  constructor(private service: ServiceQuotesService) {}
  private actor(user: any) {
    const id = user?.userId ?? user?.sub;
    if (!id) throw new UnauthorizedException();
    return String(id);
  }
  @Get() @Roles("ADMIN", "MANAGER", "STAFF", "VIEWER") list(
    @Org() org: string,
    @Query("page") page?: string,
  ) {
    return this.service.list(org, page ? Number(page) : 1);
  }
  @Get(":id") @Roles("ADMIN", "MANAGER", "STAFF", "VIEWER") detail(
    @Org() org: string,
    @Param("id") id: string,
    @Query("page") page?: string,
  ) {
    return this.service.detail(org, id, page ? Number(page) : 1);
  }
  @Post() @Roles("ADMIN", "MANAGER") create(
    @Org() org: string,
    @User() user: any,
    @Body() body: QuoteCreateDto,
  ) {
    return this.service.create(org, this.actor(user), body);
  }
  @Post(":id/revise") @Roles("ADMIN", "MANAGER") revise(
    @Org() org: string,
    @Param("id") id: string,
    @User() user: any,
    @Body() body: QuoteReviseDto,
  ) {
    return this.service.revise(org, id, this.actor(user), body);
  }
  @Post(":id/share") @Roles("ADMIN", "MANAGER") share(
    @Org() org: string,
    @Param("id") id: string,
    @User() user: any,
    @Body() body: QuoteShareDto,
  ) {
    return this.service.share(org, id, this.actor(user), body);
  }
  @Post(":id/approvals/:linkId/revoke") @Roles("ADMIN", "MANAGER") revoke(
    @Org() org: string,
    @Param("id") id: string,
    @Param("linkId") link: string,
    @User() user: any,
  ) {
    return this.service.revoke(org, id, link, this.actor(user));
  }
}
@Controller("quote-approval")
export class PublicQuoteApprovalController {
  constructor(private service: ServiceQuotesService) {}
  @Public() @Post("view") @Header("Cache-Control", "private, no-store") view(
    @Body() body: QuoteTokenDto,
  ) {
    return this.service.view(body.token);
  }
  @Public()
  @Post("respond")
  @Header("Cache-Control", "private, no-store")
  respond(@Body() body: QuoteAnswerDto) {
    return this.service.respond(body);
  }
}
