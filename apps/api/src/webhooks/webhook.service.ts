import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateWebhookDto } from './dto/create-webhook.dto'
import { UpdateWebhookDto } from './dto/update-webhook.dto'
import { randomBytes } from 'crypto'

@Injectable()
export class WebhookService {
  constructor(private readonly prisma: PrismaService) {}

  async createEndpoint(orgId: string, dto: CreateWebhookDto) {
    return this.prisma.webhookEndpoint.create({
      data: {
        orgId,
        url: dto.url,
        secret: randomBytes(32).toString('hex'),
        active: dto.active ?? true,
        events: dto.events,
      },
      select: {
        id: true,
        url: true,
        active: true,
        events: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async listEndpoints(orgId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        active: true,
        events: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async updateEndpoint(orgId: string, id: string, dto: UpdateWebhookDto) {
    const existing = await this.prisma.webhookEndpoint.findFirst({ where: { id, orgId }, select: { id: true } })
    if (!existing) throw new NotFoundException('Webhook endpoint não encontrado')

    return this.prisma.webhookEndpoint.update({
      where: { id },
      data: {
        url: dto.url,
        events: dto.events,
        active: dto.active,
      },
      select: {
        id: true,
        url: true,
        active: true,
        events: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async deleteEndpoint(orgId: string, id: string) {
    const existing = await this.prisma.webhookEndpoint.findFirst({ where: { id, orgId }, select: { id: true } })
    if (!existing) throw new NotFoundException('Webhook endpoint não encontrado')

    await this.prisma.webhookEndpoint.delete({ where: { id } })
    return { deleted: true }
  }

  async listDeliveries(orgId: string, query?: { eventType?: string; status?: string }) {
    return this.prisma.webhookDelivery.findMany({
      where: {
        endpoint: { orgId },
        ...(query?.eventType ? { eventType: query.eventType } : {}),
        ...(query?.status && ['PENDING', 'SUCCESS', 'FAILED'].includes(query.status)
          ? { status: query.status as 'PENDING' | 'SUCCESS' | 'FAILED' }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        endpoint: {
          select: {
            id: true,
            url: true,
          },
        },
      },
    })
  }

  async createPendingDelivery(input: {
    endpointId: string
    eventType: string
    payload: Record<string, any>
  }) {
    return this.prisma.webhookDelivery.create({
      data: {
        endpointId: input.endpointId,
        eventType: input.eventType,
        payload: input.payload,
        status: 'PENDING',
      },
    })
  }

  async markDeliveryAttempt(input: {
    deliveryId: string
    attempts: number
    status: 'PENDING' | 'SUCCESS' | 'FAILED'
  }) {
    return this.prisma.webhookDelivery.update({
      where: { id: input.deliveryId },
      data: {
        attempts: input.attempts,
        status: input.status,
        lastAttemptAt: new Date(),
      },
    })
  }

  async getDeliveryContext(deliveryId: string) {
    return this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        endpoint: true,
      },
    })
  }

  async getActiveEndpointsByEvent(orgId: string, eventType: string) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        orgId,
        active: true,
      },
      select: {
        id: true,
        events: true,
      },
    })

    return endpoints.filter((endpoint) => {
      const events = Array.isArray(endpoint.events) ? endpoint.events : []
      return events.includes(eventType)
    })
  }
}
