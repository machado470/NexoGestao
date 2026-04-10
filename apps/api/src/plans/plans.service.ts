import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { PlanName } from '@prisma/client'
import {
  buildDefaultPlanCreateData,
  listDefaultPlanDefinitions,
} from '../common/commercial/default-plan-definitions'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class PlansService implements OnModuleInit {
  private readonly logger = new Logger(PlansService.name)

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaultPlans()
  }

  private async ensureDefaultPlans() {
    const plans = listDefaultPlanDefinitions()

    try {
      for (const plan of plans) {
        await this.prisma.plan.upsert({
          where: { name: plan.name },
          update: {
            displayName: plan.displayName,
            priceCents: plan.priceCents,
            limitsJson: plan.limitsJson,
            featuresJson: plan.featuresJson,
          },
          create: buildDefaultPlanCreateData(plan.name),
        })
      }

      this.logger.log('Planos padrão verificados com sucesso')
    } catch (error) {
      this.logger.error(
        `Falha ao criar planos padrão: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  async createPlan(data: { name: PlanName; priceCents: number }) {
    return this.prisma.plan.create({
      data: buildDefaultPlanCreateData(data.name, { priceCents: data.priceCents }),
    })
  }

  async listPlans() {
    return this.prisma.plan.findMany({
      orderBy: { createdAt: 'asc' },
    })
  }

  async findPlanByName(name: PlanName) {
    const plan = await this.prisma.plan.findUnique({
      where: { name },
    })

    if (!plan) {
      throw new NotFoundException(`Plano ${name} não encontrado.`)
    }

    return plan
  }
}
