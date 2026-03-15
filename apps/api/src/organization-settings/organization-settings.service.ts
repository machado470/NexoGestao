import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SubscriptionsService } from '../subscriptions/subscriptions.service'

@Injectable()
export class OrganizationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async getOrganizationSettings(orgId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        currency: true,
      },
    })

    if (!organization) {
      throw new NotFoundException('Organização não encontrada.')
    }

    const subscription =
      await this.subscriptionsService.getOrganizationSubscription(orgId)

    const membersCount = await this.prisma.user.count({
      where: { orgId },
    })

    return {
      ...organization,
      currentPlan: subscription?.plan?.name || 'Nenhum',
      membersCount,
    }
  }

  async updateOrganizationSettings(
    orgId: string,
    data: { name?: string; timezone?: string; currency?: string },
  ) {
    const organization = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.timezone ? { timezone: data.timezone } : {}),
        ...(data.currency ? { currency: data.currency } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        currency: true,
      },
    })

    const subscription =
      await this.subscriptionsService.getOrganizationSubscription(orgId)

    const membersCount = await this.prisma.user.count({
      where: { orgId },
    })

    return {
      ...organization,
      currentPlan: subscription?.plan?.name || 'Nenhum',
      membersCount,
    }
  }
}
