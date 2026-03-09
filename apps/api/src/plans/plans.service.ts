import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { PlanName } from '@prisma/client'
import { CreatePlanDto } from './dto/create-plan.dto'

@Injectable()
export class PlansService implements OnModuleInit {
  private readonly logger = new Logger(PlansService.name)

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.createDefaultPlans()
      this.logger.log('Planos padrão verificados')
    } catch (err) {
      const error = err as Error
      this.logger.error(`Falha ao criar planos padrão: ${error.message}`)
    }
  }

  async createDefaultPlans() {
    const plans = [
      {
        name: PlanName.STARTER,
        description: 'Plano inicial com funcionalidades básicas.',
        priceCents: 0,
        features: { maxUsers: 1, storageGb: 1, support: 'email' },
      },
      {
        name: PlanName.PRO,
        description: 'Plano profissional com mais recursos.',
        priceCents: 9900,
        features: { maxUsers: 5, storageGb: 10, support: 'chat' },
      },
      {
        name: PlanName.BUSINESS,
        description: 'Plano empresarial com todos os recursos.',
        priceCents: 29900,
        features: { maxUsers: 20, storageGb: 100, support: 'phone' },
      },
    ]

    for (const planData of plans) {
      await this.prisma.plan.upsert({
        where: { name: planData.name },
        update: {
          description: planData.description,
          priceCents: planData.priceCents,
          features: planData.features as any,
        },
        create: {
          ...planData,
          features: planData.features as any,
        },
      })
    }
  }

  async createPlan(createPlanDto: CreatePlanDto) {
    return this.prisma.plan.create({
      data: {
        ...createPlanDto,
        features: JSON.parse(createPlanDto.features as string) as any,
      },
    })
  }

  async findAllPlans() {
    return this.prisma.plan.findMany()
  }

  async findPlanByName(name: PlanName) {
    return this.prisma.plan.findUnique({
      where: { name },
    })
  }
}
