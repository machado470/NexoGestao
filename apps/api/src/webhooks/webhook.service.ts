import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateWebhookDto } from './dto/create-webhook.dto'
import { UpdateWebhookDto } from './dto/update-webhook.dto'
import { randomBytes } from 'crypto'

@Injectable()
export class WebhookService {
  constructor(private readonly prisma: PrismaService) {}

  private get webhookEndpointDelegate(): any | null {
    const prismaAny = this.prisma as any
    return prismaAny.webhookEndpoint ?? null
  }

  private get webhookDeliveryDelegate(): any | null {
    const prismaAny = this.prisma as any
    return prismaAny.webhookDelivery ?? null
  }

  async createEndpoint(orgId: string, dto: CreateWebhookDto) {
    const delegate = this.webhookEndpointDelegate
    if (!delegate) {
      return {
        disabled: true,
        reason: 'WebhookEndpoint model não está disponível no Prisma atual.',
      }
    }

    return delegate.create({
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
    const delegate = this.webhookEndpointDelegate
    if (!delegate) return []

    return delegate.findMany({
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
    const delegate = this.webhookEndpointDelegate
    if (!delegate) {
      throw new NotFoundException('Webhook endpoint não disponível neste ambiente')
    }

    const existing = await delegate.findFirst({
      where: { id, orgId },
      select: { id: true },
    })

    if (!existing) throw new NotFoundException('Webhook endpoint não encontrado')

    return delegate.update({
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
    const delegate = this.webhookEndpointDelegate
    if (!delegate) {
      return { deleted: false, disabled: true }
    }

    const existing = await delegate.findFirst({
      where: { id, orgId },
      select: { id: true },
    })

    if (!existing) throw new NotFoundException('Webhook endpoint não encontrado')

    await delegate.delete({ where: { id } })
    return { deleted: true }
  }

  async listDeliveries(orgId: string, query?: { eventType?: string; status?: string }) {
    const delegate = this.webhookDeliveryDelegate
    if (!delegate) return []

    return delegate.findMany({
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
    const delegate = this.webhookDeliveryDelegate
    if (!delegate) {
      return {
        id: `disabled-${Date.now()}`,
        endpointId: input.endpointId,
        eventType: input.eventType,
        payload: input.payload,
        status: 'FAILED',
        attempts: 0,
        disabled: true,
      }
    }

    return delegate.create({
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
    const delegate = this.webhookDeliveryDelegate
    if (!delegate) {
      return {
        id: input.deliveryId,
        attempts: input.attempts,
        status: input.status,
        disabled: true,
      }
    }

    return delegate.update({
      where: { id: input.deliveryId },
      data: {
        attempts: input.attempts,
        status: input.status,
        lastAttemptAt: new Date(),
      },
    })
  }

  async getDeliveryContext(deliveryId: string) {
    const delegate = this.webhookDeliveryDelegate
    if (!delegate) return null

    return delegate.findUnique({
      where: { id: deliveryId },
      include: {
        endpoint: true,
      },
    })
  }

  async getActiveEndpointsByEvent(orgId: string, eventType: string) {
    const delegate = this.webhookEndpointDelegate
    if (!delegate) return []

    const endpoints = await delegate.findMany({
      where: {
        orgId,
        active: true,
      },
      select: {
        id: true,
        events: true,
      },
    })

    return endpoints.filter((endpoint: any) => {
      const events = Array.isArray(endpoint.events) ? endpoint.events : []
      return events.includes(eventType)
    })
  }
}
