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
import {
  Equals,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Org } from "../auth/decorators/org.decorator";
import { User } from "../auth/decorators/user.decorator";

export class EvidenceDto {
  @IsUUID() entryKey!: string;
  @IsString() @MinLength(5) @MaxLength(1000) description!: string;
  @IsString() @MaxLength(87384) imageBase64!: string;
  @Equals(true) professionalConfirmed!: boolean;
}
const metadata = {
  id: true,
  description: true,
  uploadedByUserId: true,
  uploadedByName: true,
  createdAt: true,
} as const;

@Injectable()
export class ServiceOrderEvidenceService {
  constructor(private readonly db: PrismaService) {}
  private async order(orgId: string, serviceOrderId: string, contractorId?: string) {
    const order = await this.db.serviceOrder.findFirst({
      where: { id: serviceOrderId, orgId, ...(contractorId ? { assignedToPersonId: contractorId } : {}) },
      select: { id: true },
    });
    if (!order) throw new NotFoundException("O.S. não encontrada");
  }
  async list(orgId: string, serviceOrderId: string, contractorId?: string) {
    await this.order(orgId, serviceOrderId, contractorId);
    return this.db.serviceOrderEvidence.findMany({
      where: { orgId, serviceOrderId, ...(contractorId ? { serviceOrder: { assignedToPersonId: contractorId } } : {}) },
      select: metadata,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 12,
    });
  }
  async image(orgId: string, serviceOrderId: string, id: string, contractorId?: string) {
    const photo = await this.db.serviceOrderEvidence.findFirst({
      where: { id, orgId, serviceOrderId, ...(contractorId ? { serviceOrder: { assignedToPersonId: contractorId } } : {}) },
      select: { content: true },
    });
    if (!photo) throw new NotFoundException("Foto não encontrada");
    return { imageBase64: photo.content.toString("base64") };
  }
  async add(
    orgId: string,
    serviceOrderId: string,
    userId: string,
    input: EvidenceDto,
  ) {
    const description = input.description.trim();
    if (input.professionalConfirmed !== true || description.length < 5)
      throw new BadRequestException(
        "Descreva a execução e confirme o registro",
      );
    if (!input.imageBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.imageBase64))
      throw new BadRequestException("Foto inválida");
    const content = Buffer.from(input.imageBase64, "base64");
    if (
      content.length < 4 ||
      content.length > 65536 ||
      content.toString("base64") !== input.imageBase64 ||
      content[0] !== 255 ||
      content[1] !== 216 ||
      content[2] !== 255 ||
      content[content.length - 2] !== 255 ||
      content[content.length - 1] !== 217
    ) {
      throw new BadRequestException(
        "Envie uma foto JPEG otimizada de até 64 KB",
      );
    }
    const sha256 = createHash("sha256").update(content).digest("hex");
    const actor = await this.db.user.findFirst({
      where: { id: userId, orgId, active: true },
      select: { id: true, role: true, person: { select: { id: true, name: true, active: true } } },
    });
    if (!actor) throw new UnauthorizedException();
    return this.db.$transaction(async (tx) => {
      // Serialize additions per order: enforce the limit even with simultaneous uploads.
      const locked = await tx.$queryRaw<
        Array<{ status: string; customerId: string; assignedToPersonId: string | null }>
      >`SELECT status, "customerId", "assignedToPersonId" FROM "ServiceOrder" WHERE id = ${serviceOrderId} AND "orgId" = ${orgId} FOR UPDATE`;
      if (!locked.length || (actor.role === "CONTRACTOR" &&
        (!actor.person?.active || locked[0].assignedToPersonId !== actor.person.id))) {
        throw new NotFoundException("O.S. não encontrada");
      }
      const existing = await tx.serviceOrderEvidence.findUnique({
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
          existing.sha256 !== sha256 ||
          existing.description !== description ||
          existing.uploadedByUserId !== userId
        )
          throw new ConflictException(
            "Tentativa já utilizada com outros dados",
          );
        const {
          content: _content,
          sha256: _hash,
          entryKey: _key,
          orgId: _org,
          serviceOrderId: _order,
          ...result
        } = existing;
        return result;
      }
      if (!["IN_PROGRESS", "DONE"].includes(locked[0].status))
        throw new ConflictException(
          "Inicie a O.S. antes de registrar fotos. O.S. cancelada não aceita novos registros.",
        );
      if (
        (await tx.serviceOrderEvidence.count({
          where: { orgId, serviceOrderId },
        })) >= 12
      )
        throw new ConflictException("Limite de 12 fotos por O.S. atingido");
      const photo = await tx.serviceOrderEvidence.create({
        data: {
          orgId,
          serviceOrderId,
          entryKey: input.entryKey,
          description,
          content,
          sha256,
          uploadedByUserId: userId,
          uploadedByName: actor.person?.name || "Profissional",
        },
        select: metadata,
      });
      await tx.timelineEvent.create({
        data: {
          orgId,
          serviceOrderId,
          customerId: locked[0].customerId,
          personId: actor.person?.id,
          action: "SERVICE_ORDER_UPDATED",
          description: "Foto de execução registrada pelo profissional",
          metadata: {
            evidenceId: photo.id,
            actorUserId: userId,
            professionalConfirmed: true,
          },
        },
      });
      await tx.auditEvent.create({
        data: {
          orgId,
          personId: actor.person?.id,
          action: "SERVICE_ORDER_ATTACHMENT_ADDED",
          context: "ServiceOrder",
          metadata: {
            entityId: serviceOrderId,
            evidenceId: photo.id,
            actorUserId: userId,
            sha256,
            professionalConfirmed: true,
          },
        },
      });
      return photo;
    });
  }
}

@Controller("service-orders/:serviceOrderId/evidence")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceOrderEvidenceController {
  constructor(private readonly service: ServiceOrderEvidenceService) {}
  @Get()
  @Header("Cache-Control", "private, no-store")
  @Roles("ADMIN", "MANAGER", "STAFF", "VIEWER", "CONTRACTOR")
  list(@Org() org: string, @Param("serviceOrderId") id: string, @User() user: { role: string; personId?: string }) {
    return this.service.list(org, id, this.contractorPersonId(user));
  }
  @Get(":id")
  @Header("Cache-Control", "private, no-store")
  @Roles("ADMIN", "MANAGER", "STAFF", "VIEWER", "CONTRACTOR")
  image(
    @Org() org: string,
    @Param("serviceOrderId") orderId: string,
    @Param("id") id: string,
    @User() user: { role: string; personId?: string },
  ) {
    return this.service.image(org, orderId, id, this.contractorPersonId(user));
  }
  private contractorPersonId(user: { role: string; personId?: string }) {
    if (user.role !== "CONTRACTOR") return undefined;
    if (!user.personId) throw new UnauthorizedException();
    return user.personId;
  }
  @Post()
  @Roles("ADMIN", "MANAGER", "STAFF", "CONTRACTOR")
  add(
    @Org() org: string,
    @Param("serviceOrderId") id: string,
    @User() user: any,
    @Body() body: EvidenceDto,
  ) {
    const actor = user?.userId ?? user?.sub;
    if (!actor) throw new UnauthorizedException();
    return this.service.add(org, id, actor, body);
  }
}
