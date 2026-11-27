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
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Prisma } from "@prisma/client";
import { Transform } from "class-transformer";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Org } from "../auth/decorators/org.decorator";
import { User } from "../auth/decorators/user.decorator";

export class ChecklistCreateDto {
  @IsUUID() entryKey!: string;
  @IsString() @MinLength(3) @MaxLength(160) title!: string;
}
export class ChecklistChangeDto {
  @Transform(({ obj, key }) => obj[key]) @IsBoolean() completed!: boolean;
  @Transform(({ obj, key }) => obj[key])
  @IsInt()
  @Min(0)
  @Max(1000000)
  expectedVersion!: number;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
const fields = {
  id: true,
  title: true,
  completed: true,
  completedAt: true,
  completedByName: true,
  version: true,
  createdAt: true,
} as const;
@Injectable()
export class ServiceOrderChecklistService {
  constructor(private readonly db: PrismaService) {}
  private async actor(orgId: string, userId: string) {
    const actor = await this.db.user.findFirst({
      where: { id: userId, orgId, active: true },
      select: { id: true, role: true, person: { select: { id: true, name: true, active: true } } },
    });
    if (!actor) throw new UnauthorizedException();
    return actor;
  }
  private async lock(tx: Prisma.TransactionClient, orgId: string, id: string) {
    const orders = await tx.$queryRaw<
      Array<{ status: string; customerId: string; assignedToPersonId: string | null }>
    >`SELECT status, "customerId", "assignedToPersonId" FROM "ServiceOrder" WHERE id = ${id} AND "orgId" = ${orgId} FOR UPDATE`;
    if (!orders.length) throw new NotFoundException("O.S. não encontrada");
    return orders[0];
  }
  async list(orgId: string, serviceOrderId: string, contractorId?: string) {
    const assignment = contractorId ? { assignedToPersonId: contractorId } : {};
    if (
      !(await this.db.serviceOrder.findFirst({
        where: { id: serviceOrderId, orgId, ...assignment },
        select: { id: true },
      }))
    )
      throw new NotFoundException("O.S. não encontrada");
    return this.db.serviceOrderChecklistItem.findMany({
      where: { orgId, serviceOrderId, serviceOrder: assignment },
      select: fields,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 30,
    });
  }
  private async log(
    tx: Prisma.TransactionClient,
    orgId: string,
    serviceOrderId: string,
    customerId: string,
    actor: Awaited<ReturnType<ServiceOrderChecklistService["actor"]>>,
    description: string,
    detail: Prisma.InputJsonObject,
  ) {
    await tx.timelineEvent.create({
      data: {
        orgId,
        serviceOrderId,
        customerId,
        personId: actor.person?.id,
        action: "SERVICE_ORDER_UPDATED",
        description,
        metadata: { ...detail, actorUserId: actor.id },
      },
    });
    await tx.auditEvent.create({
      data: {
        orgId,
        personId: actor.person?.id,
        action: "SERVICE_ORDER_UPDATED",
        context: "ServiceOrderChecklist",
        metadata: { ...detail, serviceOrderId, actorUserId: actor.id },
      },
    });
  }
  async create(
    orgId: string,
    serviceOrderId: string,
    userId: string,
    input: ChecklistCreateDto,
  ) {
    const title = input.title.trim();
    if (title.length < 3) throw new BadRequestException("Descreva a tarefa");
    const actor = await this.actor(orgId, userId);
    return this.db.$transaction(async (tx) => {
      const order = await this.lock(tx, orgId, serviceOrderId);
      const existing = await tx.serviceOrderChecklistItem.findUnique({
        where: {
          orgId_serviceOrderId_entryKey: {
            orgId,
            serviceOrderId,
            entryKey: input.entryKey,
          },
        },
      });
      if (existing) {
        if (existing.title !== title || existing.createdByUserId !== userId)
          throw new ConflictException(
            "Tentativa já utilizada com outros dados",
          );
        return tx.serviceOrderChecklistItem.findUnique({
          where: { id: existing.id },
          select: fields,
        });
      }
      if (["DONE", "CANCELED"].includes(order.status))
        throw new ConflictException("O.S. encerrada não aceita novas tarefas");
      if (
        (await tx.serviceOrderChecklistItem.count({
          where: { orgId, serviceOrderId },
        })) >= 30
      )
        throw new ConflictException("Limite de 30 tarefas por O.S. atingido");
      const item = await tx.serviceOrderChecklistItem.create({
        data: {
          orgId,
          serviceOrderId,
          entryKey: input.entryKey,
          title,
          createdByUserId: userId,
        },
        select: fields,
      });
      await this.log(
        tx,
        orgId,
        serviceOrderId,
        order.customerId,
        actor,
        "Tarefa adicionada ao checklist da O.S.",
        { checklistItemId: item.id, title },
      );
      return item;
    });
  }
  async change(
    orgId: string,
    serviceOrderId: string,
    id: string,
    userId: string,
    input: ChecklistChangeDto,
  ) {
    const reason = input.completed ? null : input.reason?.trim() || null;
    if (!input.completed && (!reason || reason.length < 5))
      throw new BadRequestException("Informe o motivo para desmarcar a tarefa");
    const actor = await this.actor(orgId, userId);
    return this.db.$transaction(async (tx) => {
      const order = await this.lock(tx, orgId, serviceOrderId);
      if (actor.role === "CONTRACTOR" &&
        (!actor.person?.active || order.assignedToPersonId !== actor.person.id)) {
        throw new NotFoundException("O.S. não encontrada");
      }
      const item = await tx.serviceOrderChecklistItem.findFirst({
        where: { id, orgId, serviceOrderId },
      });
      if (!item) throw new NotFoundException("Tarefa não encontrada");
      if (
        item.version === input.expectedVersion + 1 &&
        item.completed === input.completed &&
        item.lastChangedByUserId === userId &&
        item.lastReason === reason
      )
        return tx.serviceOrderChecklistItem.findUnique({
          where: { id },
          select: fields,
        });
      if (order.status !== "IN_PROGRESS")
        throw new ConflictException(
          "O checklist só pode ser marcado durante a execução da O.S.",
        );
      if (item.version !== input.expectedVersion)
        throw new ConflictException(
          "A tarefa mudou. Atualize o checklist antes de tentar novamente.",
        );
      if (item.completed === input.completed)
        return tx.serviceOrderChecklistItem.findUnique({
          where: { id },
          select: fields,
        });
      const updated = await tx.serviceOrderChecklistItem.update({
        where: { id },
        data: {
          completed: input.completed,
          completedAt: input.completed ? new Date() : null,
          completedByName: input.completed
            ? actor.person?.name || "Profissional"
            : null,
          lastChangedByUserId: userId,
          lastReason: reason,
          version: { increment: 1 },
        },
        select: fields,
      });
      await this.log(
        tx,
        orgId,
        serviceOrderId,
        order.customerId,
        actor,
        input.completed
          ? "Tarefa do checklist concluída"
          : "Marcação do checklist desfeita",
        {
          checklistItemId: id,
          title: item.title,
          completed: input.completed,
          previousVersion: item.version,
          reason,
        },
      );
      return updated;
    });
  }
}
@Controller("service-orders/:serviceOrderId/checklist")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceOrderChecklistController {
  constructor(private readonly service: ServiceOrderChecklistService) {}
  private actor(user: any) {
    const id = user?.userId ?? user?.sub;
    if (!id) throw new UnauthorizedException();
    return String(id);
  }
  @Get()
  @Roles("ADMIN", "MANAGER", "STAFF", "VIEWER", "CONTRACTOR")
  list(
    @Org() org: string,
    @Param("serviceOrderId") id: string,
    @User() user: { role: string; personId?: string },
  ) {
    const contractorId = user.role === "CONTRACTOR" ? user.personId : undefined;
    if (user.role === "CONTRACTOR" && !contractorId) throw new UnauthorizedException();
    return this.service.list(org, id, contractorId);
  }
  @Post()
  @Roles("ADMIN", "MANAGER", "STAFF")
  create(
    @Org() org: string,
    @Param("serviceOrderId") id: string,
    @User() user: any,
    @Body() body: ChecklistCreateDto,
  ) {
    return this.service.create(org, id, this.actor(user), body);
  }
  @Post(":id/state")
  @Roles("ADMIN", "MANAGER", "STAFF", "CONTRACTOR")
  change(
    @Org() org: string,
    @Param("serviceOrderId") order: string,
    @Param("id") id: string,
    @User() user: any,
    @Body() body: ChecklistChangeDto,
  ) {
    return this.service.change(org, order, id, this.actor(user), body);
  }
}
