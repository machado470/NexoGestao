import { PlanName, Prisma } from '@prisma/client'

export type PlanCommercialDefinition = {
  name: PlanName
  displayName: string
  priceCents: number
  limitsJson: Prisma.InputJsonValue
  featuresJson: Prisma.InputJsonValue
}

const PLAN_COMMERCIAL_DEFINITIONS: Record<PlanName, PlanCommercialDefinition> = {
  FREE: {
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
  STARTER: {
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
  PRO: {
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
  BUSINESS: {
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
}

export function listDefaultPlanDefinitions(): PlanCommercialDefinition[] {
  return Object.values(PLAN_COMMERCIAL_DEFINITIONS)
}

export function getDefaultPlanDefinition(name: PlanName): PlanCommercialDefinition {
  return PLAN_COMMERCIAL_DEFINITIONS[name]
}

export function buildDefaultPlanCreateData(
  name: PlanName,
  overrides?: Partial<Pick<PlanCommercialDefinition, 'priceCents'>>,
): Prisma.PlanCreateInput {
  const definition = getDefaultPlanDefinition(name)

  return {
    name: definition.name,
    displayName: definition.displayName,
    priceCents: overrides?.priceCents ?? definition.priceCents,
    limitsJson: definition.limitsJson,
    featuresJson: definition.featuresJson,
  }
}
