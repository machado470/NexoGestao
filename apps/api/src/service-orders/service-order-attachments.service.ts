import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { AUDIT_ACTIONS } from '../audit/audit.actions'

@Injectable()
export class ServiceOrderAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async uploadAttachment(params: {
    orgId: string
    serviceOrderId: string
    name: string
    url: string
    type?: string
    size?: number
    uploadedByPersonId?: string
  }) {
    if (!params.orgId) throw new BadRequestException('orgId é obrigatório')
    if (!params.serviceOrderId) throw new BadRequestException('serviceOrderId é obrigatório')
    if (!params.name) throw new BadRequestException('name é obrigatório')
    if (!params.url) throw new BadRequestException('url é obrigatório')

    const serviceOrder = await this.prisma.serviceOrder.findFirst({
      where: { id: params.serviceOrderId, orgId: params.orgId },
    })

    if (!serviceOrder) {
      throw new NotFoundException('Ordem de serviço não encontrada')
    }

    const attachment = await this.prisma.serviceOrderAttachment.create({
      data: {
        orgId: params.orgId,
        serviceOrderId: params.serviceOrderId,
        name: params.name,
        url: params.url,
        type: params.type ?? 'application/octet-stream',
        size: params.size ?? 0,
        uploadedByPersonId: params.uploadedByPersonId ?? null,
      },
    })

    await this.audit.log({
      orgId: params.orgId,
      action: AUDIT_ACTIONS.SERVICE_ORDER_ATTACHMENT_ADDED,
      entityType: 'ServiceOrder',
      entityId: params.serviceOrderId,
      actorPersonId: params.uploadedByPersonId ?? null,
      metadata: {
        attachmentId: attachment.id,
        attachmentName: params.name,
        attachmentSize: params.size,
      },
    })

    return attachment
  }

  async listAttachments(orgId: string, serviceOrderId: string) {
    if (!orgId) throw new BadRequestException('orgId é obrigatório')
    if (!serviceOrderId) throw new BadRequestException('serviceOrderId é obrigatório')

    const serviceOrder = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, orgId },
    })

    if (!serviceOrder) {
      throw new NotFoundException('Ordem de serviço não encontrada')
    }

    return this.prisma.serviceOrderAttachment.findMany({
      where: { orgId, serviceOrderId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async deleteAttachment(params: {
    orgId: string
    serviceOrderId: string
    attachmentId: string
    deletedByPersonId?: string
  }) {
    if (!params.orgId) throw new BadRequestException('orgId é obrigatório')
    if (!params.serviceOrderId) throw new BadRequestException('serviceOrderId é obrigatório')
    if (!params.attachmentId) throw new BadRequestException('attachmentId é obrigatório')

    const attachment = await this.prisma.serviceOrderAttachment.findFirst({
      where: {
        id: params.attachmentId,
        orgId: params.orgId,
        serviceOrderId: params.serviceOrderId,
      },
    })

    if (!attachment) {
      throw new NotFoundException('Anexo não encontrado')
    }

    await this.prisma.serviceOrderAttachment.delete({
      where: { id: params.attachmentId },
    })

    await this.audit.log({
      orgId: params.orgId,
      action: AUDIT_ACTIONS.SERVICE_ORDER_ATTACHMENT_REMOVED,
      entityType: 'ServiceOrder',
      entityId: params.serviceOrderId,
      actorPersonId: params.deletedByPersonId ?? null,
      metadata: {
        attachmentId: params.attachmentId,
        attachmentName: attachment.name,
      },
    })

    return { ok: true }
  }
}
