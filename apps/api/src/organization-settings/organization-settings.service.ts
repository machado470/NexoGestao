import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class OrganizationSettingsService {
  private readonly logger = new Logger(OrganizationSettingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  async getOrganizationSettings(orgId: string) {
    try {
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

      return {
        ...organization,
        currentPlan: 'Nenhum',
        membersCount: 0,
      }
    } catch (error) {
      this.logger.error(
        `Erro ao buscar configurações da organização ${orgId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      )
      throw error
    }
  }

  async updateOrganizationSettings(
    orgId: string,
    data: { name?: string; timezone?: string; currency?: string },
  ) {
    try {
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

      return {
        ...organization,
        currentPlan: 'Nenhum',
        membersCount: 0,
      }
    } catch (error) {
      this.logger.error(
        `Erro ao atualizar configurações da organização ${orgId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      )
      throw error
    }
  }
}
