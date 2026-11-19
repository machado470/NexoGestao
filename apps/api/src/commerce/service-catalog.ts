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
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Transform } from "class-transformer";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Org } from "../auth/decorators/org.decorator";
import { User } from "../auth/decorators/user.decorator";
export class CatalogValuesDto {
  @IsString() @Matches(/^[a-z0-9][a-z0-9._-]{0,39}$/i) code!: string;
  @IsString() @MinLength(2) @MaxLength(140) name!: string;
  @IsString() @MaxLength(2000) description!: string;
  @IsOptional()
  @Transform(({ obj, key }) => obj[key])
  @IsInt()
  @Min(0)
  @Max(2147483647)
  priceCents?: number | null;
  @IsString() @Matches(/^[A-Z]{3}$/) expectedCurrency!: string;
  @IsOptional()
  @Transform(({ obj, key }) => obj[key])
  @IsInt()
  @Min(1)
  @Max(10080)
  durationMinutes?: number | null;
}
export class CatalogCreateDto extends CatalogValuesDto {
  @IsUUID() entryKey!: string;
}
export class CatalogEditDto extends CatalogValuesDto {
  @Transform(({ obj, key }) => obj[key]) @IsBoolean() active!: boolean;
  @Transform(({ obj, key }) => obj[key])
  @IsInt()
  @Min(0)
  @Max(1000000)
  expectedVersion!: number;
  @IsString() @MinLength(10) @MaxLength(1000) reason!: string;
}
const core = (input: CatalogValuesDto) => ({
  code: input.code.trim().toUpperCase(),
  name: input.name.trim(),
  description: input.description.trim(),
  priceCents: input.priceCents ?? null,
  currency: input.expectedCurrency,
  durationMinutes: input.durationMinutes ?? null,
});
const snapshot = (item: any) => ({
  ...core({ ...item, expectedCurrency: item.currency }),
  active: item.active,
});
const publicItem = (item: any) => {
  const { orgId, entryKey, ...value } = item;
  return value;
};
const same = (a: any, b: any) =>
  Object.keys(b).every((key) => a[key] === b[key]);
@Injectable()
export class ServiceCatalogService {
  constructor(private readonly db: PrismaService) {}
  private async actor(tx: any, orgId: string, userId: string) {
    const actor = await tx.user.findFirst({
      where: { id: userId, orgId, active: true },
      select: { id: true, person: { select: { name: true } } },
    });
    if (!actor) throw new UnauthorizedException();
    return { id: actor.id, name: actor.person?.name || "Responsável" };
  }
  private validate(input: CatalogValuesDto) {
    if (input.name.trim().length < 2)
      throw new BadRequestException("Informe o nome do serviço");
  }
  async list(orgId: string, page = 1, q = "", state = "active") {
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000 ||
      q.length > 120 ||
      !["active", "archived", "all"].includes(state)
    )
      throw new BadRequestException("Filtros inválidos");
    const where = {
      orgId,
      ...(state === "all" ? {} : { active: state === "active" }),
      ...(q.trim()
        ? {
            OR: ["name", "code"].map((field) => ({
              [field]: { contains: q.trim(), mode: "insensitive" as const },
            })),
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.catalogService.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (page - 1) * 20,
        take: 20,
      }),
      this.db.catalogService.count({ where }),
    ]);
    return {
      items: items.map(publicItem),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / 20)),
    };
  }
  async history(orgId: string, id: string, page = 1) {
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException("Página inválida");
    if (
      !(await this.db.catalogService.findFirst({
        where: { id, orgId },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Serviço não encontrado");
    const where = { orgId, serviceId: id };
    const [items, total] = await this.db.$transaction([
      this.db.catalogServiceRevision.findMany({
        where,
        orderBy: { version: "desc" },
        skip: (page - 1) * 10,
        take: 10,
        select: {
          id: true,
          version: true,
          snapshot: true,
          reason: true,
          actorName: true,
          createdAt: true,
        },
      }),
      this.db.catalogServiceRevision.count({ where }),
    ]);
    return { items, total, page, pages: Math.max(1, Math.ceil(total / 10)) };
  }
  private async record(
    tx: any,
    item: any,
    actor: { id: string; name: string },
    reason: string,
  ) {
    await tx.catalogServiceRevision.create({
      data: {
        orgId: item.orgId,
        serviceId: item.id,
        version: item.version,
        snapshot: snapshot(item),
        reason,
        actorUserId: actor.id,
        actorName: actor.name,
      },
    });
    await tx.auditEvent.create({
      data: {
        orgId: item.orgId,
        action: "SERVICE_CATALOG_CHANGED",
        context: "ServiceCatalog",
        metadata: {
          serviceId: item.id,
          version: item.version,
          reason,
          actorUserId: actor.id,
        },
      },
    });
  }
  async create(orgId: string, userId: string, input: CatalogCreateDto) {
    this.validate(input);
    const data = { ...core(input), active: true };
    try {
      return await this.db.$transaction(async (tx) => {
        const actor = await this.actor(tx, orgId, userId);
        // Serializes create retries and confirms the organization currency at commit time.
        const orgs = await tx.$queryRaw<
          Array<{ currency: string }>
        >`SELECT currency FROM "Organization" WHERE id=${orgId} FOR UPDATE`;
        const existing = await tx.catalogService.findUnique({
          where: { orgId_entryKey: { orgId, entryKey: input.entryKey } },
          include: { revisions: { where: { version: 0 } } },
        });
        if (existing) {
          const first = existing.revisions[0];
          if (
            !first ||
            first.actorUserId !== actor.id ||
            !same(first.snapshot, data)
          )
            throw new ConflictException(
              "Tentativa já utilizada com outros dados",
            );
          const { revisions, ...item } = existing;
          return publicItem(item);
        }
        if (!orgs.length) throw new NotFoundException("Empresa não encontrada");
        if (orgs[0].currency !== input.expectedCurrency)
          throw new ConflictException(
            "A moeda da empresa mudou. Atualize a página.",
          );
        const item = await tx.catalogService.create({
          data: { orgId, entryKey: input.entryKey, ...data },
        });
        await this.record(tx, item, actor, "Cadastro inicial do serviço");
        return publicItem(item);
      });
    } catch (e: any) {
      if (e.code === "P2002")
        throw new ConflictException(
          "Já existe um serviço com este código, inclusive nos arquivados.",
        );
      throw e;
    }
  }
  async edit(orgId: string, id: string, userId: string, input: CatalogEditDto) {
    this.validate(input);
    const reason = input.reason.trim();
    if (reason.length < 10)
      throw new BadRequestException("Informe o motivo da alteração");
    try {
      return await this.db.$transaction(async (tx) => {
        const actor = await this.actor(tx, orgId, userId);
        const rows = await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT id FROM "CatalogService" WHERE id=${id} AND "orgId"=${orgId} FOR UPDATE`;
        if (!rows.length) throw new NotFoundException("Serviço não encontrado");
        const item = await tx.catalogService.findUnique({ where: { id } }),
          data = { ...core(input), active: input.active };
        if (
          item.version === input.expectedVersion + 1 &&
          same(snapshot(item), data)
        ) {
          const last = await tx.catalogServiceRevision.findUnique({
            where: {
              serviceId_version: { serviceId: id, version: item.version },
            },
          });
          if (last?.actorUserId === actor.id && last.reason === reason)
            return publicItem(item);
        }
        if (item.version !== input.expectedVersion)
          throw new ConflictException(
            "O serviço mudou. Feche o formulário e revise a versão atual antes de tentar novamente.",
          );
        if (item.currency !== input.expectedCurrency)
          throw new ConflictException(
            "A moeda do serviço não pode ser alterada.",
          );
        if (same(snapshot(item), data))
          throw new BadRequestException(
            "Altere ao menos um campo antes de salvar.",
          );
        const updated = await tx.catalogService.update({
          where: { id },
          data: { ...data, version: { increment: 1 } },
        });
        await this.record(tx, updated, actor, reason);
        return publicItem(updated);
      });
    } catch (e: any) {
      if (e.code === "P2002")
        throw new ConflictException(
          "Já existe um serviço com este código, inclusive nos arquivados.",
        );
      throw e;
    }
  }
}
@Controller("service-catalog")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceCatalogController {
  constructor(private readonly service: ServiceCatalogService) {}
  private actor(user: any) {
    const id = user?.userId ?? user?.sub;
    if (!id) throw new UnauthorizedException();
    return String(id);
  }
  @Get() @Roles("ADMIN", "MANAGER", "STAFF", "VIEWER") list(
    @Org() org: string,
    @Query("page") page?: string,
    @Query("q") q?: string,
    @Query("state") state?: string,
  ) {
    return this.service.list(org, page ? Number(page) : 1, q, state);
  }
  @Get(":id/history") @Roles("ADMIN", "MANAGER", "STAFF", "VIEWER") history(
    @Org() org: string,
    @Param("id") id: string,
    @Query("page") page?: string,
  ) {
    return this.service.history(org, id, page ? Number(page) : 1);
  }
  @Post() @Roles("ADMIN", "MANAGER") create(
    @Org() org: string,
    @User() user: any,
    @Body() body: CatalogCreateDto,
  ) {
    return this.service.create(org, this.actor(user), body);
  }
  @Post(":id") @Roles("ADMIN", "MANAGER") edit(
    @Org() org: string,
    @Param("id") id: string,
    @User() user: any,
    @Body() body: CatalogEditDto,
  ) {
    return this.service.edit(org, id, this.actor(user), body);
  }
}
