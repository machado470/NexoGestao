import { Injectable } from '@nestjs/common'
import {
  ChargeStatus,
  ServiceOrderStatus,
  WhatsAppConversationPriority,
  WhatsAppDirection,
  WhatsAppInboundIntent,
  WhatsAppMessageStatus,
  WhatsAppSlaStatus,
} from '@prisma/client'

export type WhatsAppSuggestedAction =
  | 'SEND_PAYMENT_LINK'
  | 'CONFIRM_APPOINTMENT'
  | 'RESCHEDULE_APPOINTMENT'
  | 'OPEN_SERVICE_ORDER'
  | 'SEND_SERVICE_UPDATE'
  | 'ESCALATE_TO_OPERATOR'
  | 'MARK_RESOLVED'
  | 'REPLY_WITH_TEMPLATE'

export type RelatedEntity = {
  entityType: 'CUSTOMER' | 'APPOINTMENT' | 'SERVICE_ORDER' | 'CHARGE' | 'PAYMENT' | 'GENERAL'
  entityId: string | null
}

export type IntentDecision = {
  intent: WhatsAppInboundIntent
  reason: string
  confidence: number
  matchedTerms: string[]
}

export type SlaDecision = {
  waitingSince: Date | null
  lastInboundAt: Date | null
  lastOutboundAt: Date | null
  responseDueAt: Date | null
  slaStatus: WhatsAppSlaStatus
  reason: string
}

export type PriorityDecision = {
  priority: WhatsAppConversationPriority
  reason: string
  score: number
  factors: string[]
}

export type SuggestedActionDecision = {
  action: WhatsAppSuggestedAction
  label: string
  reason: string
  confidence: number
  priority: WhatsAppConversationPriority
  relatedEntity: RelatedEntity
}

export type OperationalContextSnapshot = {
  customerId?: string | null
  chargeId?: string | null
  chargeStatus?: ChargeStatus | `${ChargeStatus}` | null
  chargeDueDate?: Date | string | null
  appointmentId?: string | null
  appointmentStartsAt?: Date | string | null
  serviceOrderId?: string | null
  serviceOrderStatus?: ServiceOrderStatus | `${ServiceOrderStatus}` | null
  failedMessageCount?: number
  repeatedInboundWithoutResponse?: number
  customerRiskScore?: number | null
}

export type IntelligenceDecision = {
  intent: IntentDecision
  sla: SlaDecision
  priority: PriorityDecision
  suggestedActions: SuggestedActionDecision[]
  explanation: {
    version: number
    generatedAt: string
    rules: string[]
    intent: IntentDecision
    priority: PriorityDecision
    sla: SlaDecision
  }
}

type IntentRule = {
  intent: WhatsAppInboundIntent
  terms: string[]
  reason: string
}

const INTENT_RULES: IntentRule[] = [
  { intent: 'COMPLAINT_INTENT', terms: ['reclamacao', 'nao gostei', 'problema', 'ruim', 'defeito', 'insatisfeito'], reason: 'Mensagem contém termos de reclamação ou insatisfação.' },
  { intent: 'CANCELLATION_INTENT', terms: ['cancelar', 'cancela', 'nao vou conseguir', 'nao consigo ir', 'desmarcar'], reason: 'Mensagem indica cancelamento ou impossibilidade de comparecer.' },
  { intent: 'RESCHEDULE_INTENT', terms: ['remarcar', 'outro horario', 'mudar data', 'trocar horario', 'alterar horario', 'reagendar'], reason: 'Mensagem pede mudança de data ou horário.' },
  { intent: 'PAYMENT_INTENT', terms: ['vou pagar', 'paguei', 'pix', 'boleto', 'pagamento', 'comprovante'], reason: 'Mensagem contém sinais de pagamento.' },
  { intent: 'QUOTE_REQUEST_INTENT', terms: ['quanto custa', 'orcamento', 'valor', 'preco', 'quanto fica', 'cotacao'], reason: 'Mensagem solicita valor, preço ou orçamento.' },
  { intent: 'SERVICE_STATUS_INTENT', terms: ['ja chegou', 'status', 'andamento', 'como esta', 'previsao', 'chegou?'], reason: 'Mensagem pede status ou andamento do serviço.' },
]

const RESPONSE_TARGET_MINUTES: Record<WhatsAppConversationPriority, number> = {
  CRITICAL: 30,
  HIGH: 60,
  MEDIUM: 240,
  NORMAL: 240,
  LOW: 1440,
}

export function normalizeIntentText(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function classifyInboundIntent(content: string): IntentDecision {
  const normalized = normalizeIntentText(content)
  for (const rule of INTENT_RULES) {
    const matchedTerms = rule.terms.filter((term) => normalized.includes(term))
    if (matchedTerms.length > 0) {
      return {
        intent: rule.intent,
        reason: `${rule.reason} Termos: ${matchedTerms.join(', ')}.`,
        confidence: Math.min(0.95, 0.68 + matchedTerms.length * 0.09),
        matchedTerms,
      }
    }
  }
  return {
    intent: 'GENERAL_INTENT',
    reason: 'Nenhuma regra determinística específica foi acionada; classificado como geral.',
    confidence: 0.45,
    matchedTerms: [],
  }
}

export function computeSlaStatus(input: {
  lastInboundAt?: Date | string | null
  lastOutboundAt?: Date | string | null
  priority: WhatsAppConversationPriority
  now?: Date
}): SlaDecision {
  const now = input.now ?? new Date()
  const lastInboundAt = toDate(input.lastInboundAt)
  const lastOutboundAt = toDate(input.lastOutboundAt)
  const isWaiting = Boolean(lastInboundAt && (!lastOutboundAt || lastInboundAt.getTime() > lastOutboundAt.getTime()))
  if (!isWaiting || !lastInboundAt) {
    return {
      waitingSince: null,
      lastInboundAt,
      lastOutboundAt,
      responseDueAt: null,
      slaStatus: 'OK',
      reason: 'Não há mensagem inbound aguardando resposta operacional.',
    }
  }

  const targetMinutes = RESPONSE_TARGET_MINUTES[input.priority] ?? RESPONSE_TARGET_MINUTES.MEDIUM
  const responseDueAt = new Date(lastInboundAt.getTime() + targetMinutes * 60_000)
  const elapsedMs = now.getTime() - lastInboundAt.getTime()
  const warningMs = targetMinutes * 60_000 * 0.7
  const slaStatus: WhatsAppSlaStatus = now.getTime() > responseDueAt.getTime()
    ? 'BREACHED'
    : elapsedMs >= warningMs
      ? 'WARNING'
      : 'OK'

  return {
    waitingSince: lastInboundAt,
    lastInboundAt,
    lastOutboundAt,
    responseDueAt,
    slaStatus,
    reason: `Cliente aguarda resposta desde ${lastInboundAt.toISOString()}; alvo ${targetMinutes} minutos para prioridade ${input.priority}.`,
  }
}

export function assignOperationalPriority(input: {
  intent: WhatsAppInboundIntent
  status?: string | null
  lastInboundAt?: Date | string | null
  lastOutboundAt?: Date | string | null
  context: OperationalContextSnapshot
  now?: Date
}): PriorityDecision {
  const factors: string[] = []
  let score = 20
  const now = input.now ?? new Date()
  const lastInboundAt = toDate(input.lastInboundAt)
  const lastOutboundAt = toDate(input.lastOutboundAt)
  const waiting = Boolean(lastInboundAt && (!lastOutboundAt || lastInboundAt.getTime() > lastOutboundAt.getTime()))

  if (input.status === 'FAILED' || (input.context.failedMessageCount ?? 0) > 0) {
    score += (input.context.failedMessageCount ?? 1) >= 2 ? 45 : 30
    factors.push('Há mensagens WhatsApp com falha de envio.')
  }
  if (input.context.chargeStatus === 'OVERDUE') {
    score += 35
    factors.push('Cliente possui cobrança vencida no contexto operacional.')
  }
  if (input.context.chargeStatus === 'PENDING') {
    score += 15
    factors.push('Cliente possui cobrança pendente.')
  }
  if (input.context.serviceOrderId && input.context.serviceOrderStatus !== 'DONE' && input.context.serviceOrderStatus !== 'CANCELED') {
    score += 15
    factors.push('Cliente possui ordem de serviço aberta ou em andamento.')
  }
  const appointmentStartsAt = toDate(input.context.appointmentStartsAt)
  if (appointmentStartsAt) {
    const minutesUntilAppointment = (appointmentStartsAt.getTime() - now.getTime()) / 60_000
    if (minutesUntilAppointment >= 0 && minutesUntilAppointment <= 24 * 60) {
      score += 20
      factors.push('Há agendamento previsto para as próximas 24 horas.')
    }
  }
  if (input.intent === 'COMPLAINT_INTENT') {
    score += 45
    factors.push('Intenção de reclamação detectada.')
  } else if (['CANCELLATION_INTENT', 'RESCHEDULE_INTENT'].includes(input.intent)) {
    score += 25
    factors.push('Intenção exige ajuste operacional de agenda/execução.')
  } else if (input.intent === 'PAYMENT_INTENT') {
    score += 15
    factors.push('Intenção financeira detectada.')
  }
  if (waiting) {
    score += 15
    factors.push('Mensagem inbound ainda não recebeu resposta outbound posterior.')
  }
  if ((input.context.repeatedInboundWithoutResponse ?? 0) >= 2) {
    score += 25
    factors.push('Cliente enviou mensagens repetidas sem resposta operacional.')
  }
  if ((input.context.customerRiskScore ?? 0) >= 80) {
    score += 25
    factors.push('Cliente possui risco elevado disponível no contexto.')
  }

  const priority: WhatsAppConversationPriority = score >= 85 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW'
  return {
    priority,
    score,
    factors: factors.length > 0 ? factors : ['Sem fatores críticos; prioridade baixa por regra determinística.'],
    reason: `${priority} por score determinístico ${score}: ${(factors.length > 0 ? factors : ['sem fatores críticos']).join(' ')}`,
  }
}

export function generateSuggestedActions(input: {
  intent: WhatsAppInboundIntent
  priority: WhatsAppConversationPriority
  slaStatus: WhatsAppSlaStatus
  context: OperationalContextSnapshot
}): SuggestedActionDecision[] {
  const suggestions: SuggestedActionDecision[] = []
  const push = (
    action: WhatsAppSuggestedAction,
    label: string,
    reason: string,
    confidence: number,
    relatedEntity: RelatedEntity,
  ) => {
    if (suggestions.some((item) => item.action === action && item.relatedEntity.entityId === relatedEntity.entityId)) return
    suggestions.push({ action, label, reason, confidence, priority: input.priority, relatedEntity })
  }

  if (input.intent === 'COMPLAINT_INTENT' || input.priority === 'CRITICAL' || input.slaStatus === 'BREACHED') {
    push('ESCALATE_TO_OPERATOR', 'Escalar para operador', 'Conversa crítica, reclamação ou SLA violado exige intervenção humana.', 0.9, { entityType: 'GENERAL', entityId: null })
  }
  if (input.context.chargeId && ['OVERDUE', 'PENDING'].includes(String(input.context.chargeStatus ?? ''))) {
    push('SEND_PAYMENT_LINK', 'Enviar link de pagamento', 'Há cobrança pendente/vencida relacionada ao cliente.', 0.86, { entityType: 'CHARGE', entityId: input.context.chargeId })
  }
  if (input.intent === 'RESCHEDULE_INTENT' && input.context.appointmentId) {
    push('RESCHEDULE_APPOINTMENT', 'Remarcar agendamento', 'Cliente solicitou mudança de data ou horário.', 0.88, { entityType: 'APPOINTMENT', entityId: input.context.appointmentId })
  } else if (input.context.appointmentId) {
    push('CONFIRM_APPOINTMENT', 'Confirmar agendamento', 'Existe agendamento futuro no contexto da conversa.', 0.74, { entityType: 'APPOINTMENT', entityId: input.context.appointmentId })
  }
  if (input.intent === 'SERVICE_STATUS_INTENT' && input.context.serviceOrderId) {
    push('SEND_SERVICE_UPDATE', 'Enviar atualização do serviço', 'Cliente pediu status e há ordem de serviço ativa.', 0.88, { entityType: 'SERVICE_ORDER', entityId: input.context.serviceOrderId })
  }
  if (!input.context.serviceOrderId && ['COMPLAINT_INTENT', 'SERVICE_STATUS_INTENT'].includes(input.intent)) {
    push('OPEN_SERVICE_ORDER', 'Abrir ordem de serviço', 'Mensagem indica necessidade operacional sem O.S. ativa vinculada.', 0.68, { entityType: 'CUSTOMER', entityId: input.context.customerId ?? null })
  }
  if (suggestions.length === 0) {
    push('REPLY_WITH_TEMPLATE', 'Responder com template', 'Sem entidade crítica vinculada; sugerida resposta padronizada inicial.', 0.55, { entityType: 'GENERAL', entityId: null })
  }
  if (input.slaStatus === 'OK' && input.intent === 'GENERAL_INTENT') {
    push('MARK_RESOLVED', 'Marcar como resolvido', 'Conversa geral pode ser resolvida após resposta ou validação manual.', 0.42, { entityType: 'GENERAL', entityId: null })
  }
  return suggestions.slice(0, 4)
}

@Injectable()
export class WhatsAppIntelligenceService {
  evaluate(input: {
    content: string
    status?: string | null
    lastInboundAt?: Date | string | null
    lastOutboundAt?: Date | string | null
    context: OperationalContextSnapshot
    now?: Date
  }): IntelligenceDecision {
    const intent = classifyInboundIntent(input.content)
    const priority = assignOperationalPriority({
      intent: intent.intent,
      status: input.status,
      lastInboundAt: input.lastInboundAt,
      lastOutboundAt: input.lastOutboundAt,
      context: input.context,
      now: input.now,
    })
    const sla = computeSlaStatus({
      lastInboundAt: input.lastInboundAt,
      lastOutboundAt: input.lastOutboundAt,
      priority: priority.priority,
      now: input.now,
    })
    const suggestedActions = generateSuggestedActions({
      intent: intent.intent,
      priority: priority.priority,
      slaStatus: sla.slaStatus,
      context: input.context,
    })
    return {
      intent,
      priority,
      sla,
      suggestedActions,
      explanation: {
        version: 1,
        generatedAt: (input.now ?? new Date()).toISOString(),
        rules: ['intent-keyword-match', 'priority-score-v1', 'sla-response-target-v1', 'suggested-actions-v1'],
        intent,
        priority,
        sla,
      },
    }
  }
}

function toDate(value?: Date | string | null): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
