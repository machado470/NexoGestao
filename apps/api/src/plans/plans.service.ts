import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { PlanName } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class PlansService implements OnModuleInit {
  private readonly logger = new Logger(PlansService.name)

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaultPlans()
  }

  private async ensureDefaultPlans() {
    const plans: Array<{
      name: PlanName
      displayName: string
      priceCents: number
      limitsJson: Record<string, number>
      featuresJson: Record<string, boolean>
    }> = [
      {
        name: PlanName.FREE,
        displayName: 'Free',
        priceCents: 0,
        limitsJson: {
          automation_executions: 200,
          message_sends: 300,
          finance_critical_actions: 100,
          configurable_automations: 3,
        },
        featuresJson: {
          advanced_automation: false,
          premium_integrations: false,
          high_limits: false,
          priority_support: false,
        },
      },
      {
        name: PlanName.STARTER,
        displayName: 'Basic',
        priceCents: 9900,
        limitsJson: {
          automation_executions: 2500,
          message_sends: 2000,
          finance_critical_actions: 800,
          configurable_automations: 20,
        },
        featuresJson: {
          advanced_automation: false,
          premium_integrations: false,
          high_limits: false,
          priority_support: false,
        },
      },
      {
        name: PlanName.PRO,
        displayName: 'Pro',
        priceCents: 19900,
        limitsJson: {
          automation_executions: 15000,
          message_sends: 8000,
          finance_critical_actions: 4000,
          configurable_automations: 100,
        },
        featuresJson: {
          advanced_automation: true,
          premium_integrations: true,
          high_limits: true,
          priority_support: false,
        },
      },
      {
        name: PlanName.BUSINESS,
        displayName: 'Enterprise',
        priceCents: 39900,
        limitsJson: {
          automation_executions: 100000,
          message_sends: 50000,
          finance_critical_actions: 20000,
          configurable_automations: 1000,
        },
        featuresJson: {
          advanced_automation: true,
          premium_integrations: true,
          high_limits: true,
          priority_support: true,
        },
      },
    ]

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
          create: {
            name: plan.name,
            displayName: plan.displayName,
            priceCents: plan.priceCents,
            limitsJson: plan.limitsJson,
            featuresJson: plan.featuresJson,
          },
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
      data: {
        name: data.name,
        displayName: data.name,
        priceCents: data.priceCents,
      },
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
