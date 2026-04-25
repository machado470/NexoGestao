import {
  AppointmentStatus,
  ChargeStatus,
  OperationalStateValue,
  PaymentMethod,
  PrismaClient,
  ServiceOrderStatus,
  WhatsAppContextType,
  WhatsAppConversationPriority,
  WhatsAppConversationStatus,
  WhatsAppDirection,
  WhatsAppEntityType,
  WhatsAppMessageStatus,
  WhatsAppMessageType,
} from '@prisma/client'

const prisma = new PrismaClient()

function atHour(base: Date, dayOffset: number, hour: number, minute = 0) {
  const date = new Date(base)
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hour, minute, 0, 0)
  return date
}

async function upsertCustomer(params: {
  orgId: string
  name: string
  phone: string
  email: string
  notes?: string
}) {
  const existing = await prisma.customer.findFirst({
    where: {
      orgId: params.orgId,
      email: params.email.toLowerCase(),
    },
  })

  if (existing) {
    return prisma.customer.update({
      where: { id: existing.id },
      data: {
        name: params.name,
        phone: params.phone,
        notes: params.notes ?? null,
        active: true,
      },
    })
  }

  return prisma.customer.create({
    data: {
      orgId: params.orgId,
      name: params.name,
      phone: params.phone,
      email: params.email.toLowerCase(),
      notes: params.notes ?? null,
      active: true,
    },
  })
}

async function upsertAppointment(params: {
  orgId: string
  customerId: string
  startsAt: Date
  endsAt: Date
  status: AppointmentStatus
  notes?: string
}) {
  const existing = await prisma.appointment.findFirst({
    where: {
      orgId: params.orgId,
      customerId: params.customerId,
      startsAt: params.startsAt,
    },
  })

  if (existing) {
    return prisma.appointment.update({
      where: { id: existing.id },
      data: {
        endsAt: params.endsAt,
        status: params.status,
        notes: params.notes ?? null,
      },
    })
  }

  return prisma.appointment.create({
    data: {
      orgId: params.orgId,
      customerId: params.customerId,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      status: params.status,
      notes: params.notes ?? null,
    },
  })
}

async function upsertServiceOrder(params: {
  orgId: string
  customerId: string
  appointmentId?: string
  title: string
  description?: string
  status: ServiceOrderStatus
  priority?: number
  scheduledFor?: Date
  startedAt?: Date | null
  finishedAt?: Date | null
  amountCents?: number
  dueDate?: Date
  outcomeSummary?: string
}) {
  const existing = await prisma.serviceOrder.findFirst({
    where: {
      orgId: params.orgId,
      customerId: params.customerId,
      title: params.title,
    },
  })

  if (existing) {
    return prisma.serviceOrder.update({
      where: { id: existing.id },
      data: {
        appointmentId: params.appointmentId ?? null,
        description: params.description ?? null,
        status: params.status,
        priority: params.priority ?? 2,
        scheduledFor: params.scheduledFor ?? null,
        startedAt: params.startedAt ?? null,
        finishedAt: params.finishedAt ?? null,
        amountCents: params.amountCents ?? null,
        dueDate: params.dueDate ?? null,
        outcomeSummary: params.outcomeSummary ?? null,
      },
    })
  }

  return prisma.serviceOrder.create({
    data: {
      orgId: params.orgId,
      customerId: params.customerId,
      appointmentId: params.appointmentId ?? null,
      title: params.title,
      description: params.description ?? null,
      status: params.status,
      priority: params.priority ?? 2,
      scheduledFor: params.scheduledFor ?? null,
      startedAt: params.startedAt ?? undefined,
      finishedAt: params.finishedAt ?? undefined,
      amountCents: params.amountCents ?? null,
      dueDate: params.dueDate ?? null,
      outcomeSummary: params.outcomeSummary ?? null,
    },
  })
}

async function upsertCharge(params: {
  orgId: string
  customerId: string
  serviceOrderId?: string
  amountCents: number
  dueDate: Date
  status: ChargeStatus
  paidAt?: Date | null
  notes?: string
}) {
  const existing = await prisma.charge.findFirst({
    where: {
      orgId: params.orgId,
      customerId: params.customerId,
      serviceOrderId: params.serviceOrderId ?? null,
      amountCents: params.amountCents,
    },
  })

  if (existing) {
    return prisma.charge.update({
      where: { id: existing.id },
      data: {
        dueDate: params.dueDate,
        status: params.status,
        paidAt: params.paidAt ?? null,
        notes: params.notes ?? null,
      },
    })
  }

  return prisma.charge.create({
    data: {
      orgId: params.orgId,
      customerId: params.customerId,
      serviceOrderId: params.serviceOrderId ?? null,
      amountCents: params.amountCents,
      currency: 'BRL',
      status: params.status,
      dueDate: params.dueDate,
      paidAt: params.paidAt ?? null,
      notes: params.notes ?? null,
    },
  })
}

async function upsertPayment(params: {
  orgId: string
  chargeId: string
  amountCents: number
  method: PaymentMethod
  paidAt: Date
}) {
  const existing = await prisma.payment.findFirst({
    where: {
      orgId: params.orgId,
      chargeId: params.chargeId,
    },
  })

  if (existing) {
    return prisma.payment.update({
      where: { id: existing.id },
      data: {
        amountCents: params.amountCents,
        method: params.method,
        paidAt: params.paidAt,
      },
    })
  }

  return prisma.payment.create({
    data: {
      orgId: params.orgId,
      chargeId: params.chargeId,
      amountCents: params.amountCents,
      method: params.method,
      paidAt: params.paidAt,
    },
  })
}

async function upsertInvoice(params: {
  orgId: string
  customerId?: string
  number: string
  description: string
  amountCents: number
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED'
}) {
  const existing = await prisma.invoice.findFirst({
    where: {
      orgId: params.orgId,
      number: params.number,
    },
  })

  if (existing) {
    return prisma.invoice.update({
      where: { id: existing.id },
      data: {
        customerId: params.customerId ?? null,
        description: params.description,
        amountCents: params.amountCents,
        status: params.status,
      },
    })
  }

  return prisma.invoice.create({
    data: {
      orgId: params.orgId,
      customerId: params.customerId ?? null,
      number: params.number,
      description: params.description,
      amountCents: params.amountCents,
      status: params.status,
    },
  })
}

async function createTimelineIfMissing(params: {
  orgId: string
  action: string
  description: string
  customerId?: string
  appointmentId?: string
  serviceOrderId?: string
  chargeId?: string
  metadata?: Record<string, unknown>
}) {
  const existing = await prisma.timelineEvent.findFirst({
    where: {
      orgId: params.orgId,
      action: params.action,
      customerId: params.customerId ?? null,
      appointmentId: params.appointmentId ?? null,
      serviceOrderId: params.serviceOrderId ?? null,
      chargeId: params.chargeId ?? null,
    },
  })

  if (existing) {
    return prisma.timelineEvent.update({
      where: { id: existing.id },
      data: {
        description: params.description,
        metadata: params.metadata,
      },
    })
  }

  return prisma.timelineEvent.create({
    data: {
      orgId: params.orgId,
      action: params.action,
      description: params.description,
      customerId: params.customerId,
      appointmentId: params.appointmentId,
      serviceOrderId: params.serviceOrderId,
      chargeId: params.chargeId,
      metadata: params.metadata,
    },
  })
}

async function ensureConversation(params: {
  orgId: string
  customerId?: string
  phone: string
  status?: WhatsAppConversationStatus
  priority?: WhatsAppConversationPriority
  contextType?: WhatsAppContextType
  contextId?: string
  title?: string
}) {
  const existing = await prisma.whatsAppConversation.findFirst({
    where: { orgId: params.orgId, customerId: params.customerId ?? null, phone: params.phone },
  })

  if (existing) {
    return prisma.whatsAppConversation.update({
      where: { id: existing.id },
      data: {
        status: params.status ?? existing.status,
        priority: params.priority ?? existing.priority,
        contextType: params.contextType ?? existing.contextType,
        contextId: params.contextId ?? existing.contextId,
        title: params.title ?? existing.title,
      },
    })
  }

  return prisma.whatsAppConversation.create({
    data: {
      orgId: params.orgId,
      customerId: params.customerId ?? null,
      phone: params.phone,
      status: params.status ?? 'OPEN',
      priority: params.priority ?? 'NORMAL',
      contextType: params.contextType ?? 'GENERAL',
      contextId: params.contextId ?? null,
      title: params.title ?? null,
    },
  })
}

async function createWhatsAppIfMissing(params: {
  orgId: string
  conversationId: string
  customerId?: string
  toPhone: string
  fromPhone?: string
  entityType: WhatsAppEntityType
  entityId: string
  messageType: WhatsAppMessageType
  messageKey: string
  renderedText: string
  status?: WhatsAppMessageStatus
  direction?: WhatsAppDirection
}) {
  const existing = await prisma.whatsAppMessage.findFirst({
    where: { orgId: params.orgId, messageKey: params.messageKey },
  })

  if (existing) {
    return prisma.whatsAppMessage.update({
      where: { id: existing.id },
      data: {
        conversationId: params.conversationId,
        customerId: params.customerId ?? null,
        toPhone: params.toPhone,
        fromPhone: params.fromPhone ?? null,
        renderedText: params.renderedText,
        content: params.renderedText,
        status: params.status ?? existing.status,
        direction: params.direction ?? existing.direction,
      },
    })
  }

  return prisma.whatsAppMessage.create({
    data: {
      orgId: params.orgId,
      conversationId: params.conversationId,
      customerId: params.customerId ?? null,
      toPhone: params.toPhone,
      fromPhone: params.fromPhone ?? null,
      entityType: params.entityType,
      entityId: params.entityId,
      messageType: params.messageType,
      messageKey: params.messageKey,
      renderedText: params.renderedText,
      content: params.renderedText,
      direction: params.direction ?? 'OUTBOUND',
      status: params.status ?? WhatsAppMessageStatus.SENT,
      sentAt: params.status === 'SENT' ? new Date() : null,
      failedAt: params.status === 'FAILED' ? new Date() : null,
    },
  })
}


async function ensureDefaultWhatsAppTemplates(orgId: string) {
  const templates = [
    ['appointment_confirmation', 'Confirmação de agendamento', 'APPOINTMENT_CONFIRMATION', 'Olá {{customerName}}, seu agendamento está confirmado para {{appointmentDate}} às {{appointmentTime}}.'],
    ['appointment_reminder', 'Lembrete de agendamento', 'APPOINTMENT_REMINDER', 'Lembrete: atendimento em {{appointmentDate}} às {{appointmentTime}}.'],
    ['payment_reminder', 'Lembrete de cobrança', 'PAYMENT_REMINDER', 'Existe cobrança pendente de {{chargeAmount}} com vencimento {{chargeDueDate}}.'],
    ['payment_link', 'Link de pagamento', 'PAYMENT_LINK', 'Use este link para pagar: {{paymentLink}}.'],
    ['payment_confirmation', 'Pagamento confirmado', 'PAYMENT_CONFIRMATION', 'Pagamento confirmado com sucesso.'],
    ['service_update', 'Atualização da O.S.', 'SERVICE_UPDATE', 'Atualização da ordem {{serviceOrderNumber}}.'],
    ['manual_followup', 'Follow-up manual', 'MANUAL', 'Seguimos à disposição para ajudar.'],
  ] as const

  for (const [key, name, messageType, content] of templates) {
    await prisma.whatsAppTemplate.upsert({
      where: { orgId_key: { orgId, key } },
      create: { orgId, key, name, messageType, body: content, content, isActive: true },
      update: { name, messageType, body: content, content, isActive: true },
    })
  }
}

export async function seedDemoOrg(orgId: string) {
  const now = new Date()

  await ensureDefaultWhatsAppTemplates(orgId)

  const c1 = await upsertCustomer({
    orgId,
    name: 'Ana Oliveira',
    phone: '5511999990001',
    email: 'ana.oliveira@exemplo.com',
    notes: 'Cliente demo — consultoria mensal',
  })

  const c2 = await upsertCustomer({
    orgId,
    name: 'Carlos Ferreira',
    phone: '5511999990002',
    email: 'carlos.ferreira@exemplo.com',
    notes: 'Cliente demo — suporte técnico',
  })

  const c3 = await upsertCustomer({
    orgId,
    name: 'Empresa Beta Ltda',
    phone: '5511999990003',
    email: 'contato@empresabeta.com',
    notes: 'Cliente demo — contrato anual',
  })

  const apt1Start = atHour(now, 1, 10, 0)
  const apt2Start = atHour(now, 2, 14, 0)

  const apt1 = await upsertAppointment({
    orgId,
    customerId: c1.id,
    startsAt: apt1Start,
    endsAt: atHour(now, 1, 11, 0),
    status: AppointmentStatus.CONFIRMED,
    notes: 'Trazer proposta comercial',
  })

  const apt2 = await upsertAppointment({
    orgId,
    customerId: c2.id,
    startsAt: apt2Start,
    endsAt: atHour(now, 2, 15, 30),
    status: AppointmentStatus.SCHEDULED,
    notes: 'Acesso remoto necessário',
  })

  const so1 = await upsertServiceOrder({
    orgId,
    customerId: c1.id,
    appointmentId: apt1.id,
    title: 'Consultoria operacional demo',
    description: 'Diagnóstico inicial e plano de ação',
    status: ServiceOrderStatus.IN_PROGRESS,
    priority: 1,
    scheduledFor: apt1Start,
    startedAt: atHour(now, 1, 10, 15),
    amountCents: 150000,
    dueDate: atHour(now, 8, 12, 0),
  })

  const so2 = await upsertServiceOrder({
    orgId,
    customerId: c3.id,
    title: 'Implementação de sistema demo',
    description: 'Configuração inicial do ambiente e parametrização',
    status: ServiceOrderStatus.DONE,
    priority: 2,
    scheduledFor: atHour(now, -4, 9, 0),
    startedAt: atHour(now, -4, 9, 30),
    finishedAt: atHour(now, -3, 17, 0),
    amountCents: 300000,
    dueDate: atHour(now, -1, 12, 0),
    outcomeSummary: 'Entrega concluída e ambiente liberado para uso.',
  })

  const charge1 = await upsertCharge({
    orgId,
    customerId: c1.id,
    serviceOrderId: so1.id,
    amountCents: 150000,
    dueDate: atHour(now, 8, 12, 0),
    status: ChargeStatus.PENDING,
    notes: 'Cobrança pendente da consultoria demo.',
  })

  const charge2 = await upsertCharge({
    orgId,
    customerId: c3.id,
    serviceOrderId: so2.id,
    amountCents: 300000,
    dueDate: atHour(now, -5, 12, 0),
    paidAt: atHour(now, -3, 15, 0),
    status: ChargeStatus.PAID,
    notes: 'Cobrança quitada após entrega do projeto demo.',
  })

  await upsertPayment({
    orgId,
    chargeId: charge2.id,
    amountCents: 300000,
    method: PaymentMethod.PIX,
    paidAt: atHour(now, -3, 15, 0),
  })

  const convChargeOverdue = await ensureConversation({
    orgId,
    customerId: c1.id,
    phone: c1.phone,
    status: 'OPEN',
    priority: 'CRITICAL',
    contextType: 'CHARGE',
    contextId: charge1.id,
    title: 'Cobrança vencida',
  })

  const convAppointment = await ensureConversation({
    orgId,
    customerId: c2.id,
    phone: c2.phone,
    status: 'PENDING',
    priority: 'HIGH',
    contextType: 'APPOINTMENT',
    contextId: apt2.id,
    title: 'Confirmação de agendamento pendente',
  })

  const convService = await ensureConversation({
    orgId,
    customerId: c3.id,
    phone: c3.phone,
    status: 'OPEN',
    priority: 'NORMAL',
    contextType: 'SERVICE_ORDER',
    contextId: so2.id,
    title: 'O.S. em andamento',
  })

  const convFailed = await ensureConversation({
    orgId,
    customerId: c3.id,
    phone: c3.phone,
    status: 'FAILED',
    priority: 'HIGH',
    contextType: 'CHARGE',
    contextId: charge2.id,
    title: 'Falha de envio',
  })

  await createWhatsAppIfMissing({
    orgId,
    conversationId: convChargeOverdue.id,
    customerId: c1.id,
    toPhone: c1.phone,
    entityType: 'CHARGE',
    entityId: charge1.id,
    messageType: 'PAYMENT_REMINDER',
    messageKey: `seed-demo-org:payment-reminder:${orgId}:${charge1.id}`,
    renderedText: 'Olá Ana, sua cobrança está vencida. Podemos te enviar um novo link?',
    status: 'SENT',
    direction: 'OUTBOUND',
  })

  await createWhatsAppIfMissing({
    orgId,
    conversationId: convChargeOverdue.id,
    customerId: c1.id,
    toPhone: c1.phone,
    fromPhone: c1.phone,
    entityType: 'CUSTOMER',
    entityId: c1.id,
    messageType: 'MANUAL',
    messageKey: `seed-demo-org:customer-reply:${orgId}:${c1.id}`,
    renderedText: 'Recebi! Vou pagar ainda hoje.',
    status: 'DELIVERED',
    direction: 'INBOUND',
  })

  await createWhatsAppIfMissing({
    orgId,
    conversationId: convAppointment.id,
    customerId: c2.id,
    toPhone: c2.phone,
    entityType: 'APPOINTMENT',
    entityId: apt2.id,
    messageType: 'APPOINTMENT_REMINDER',
    messageKey: `seed-demo-org:appointment-reminder:${orgId}:${apt2.id}`,
    renderedText: 'Carlos, confirmando seu horário de amanhã às 14h.',
    status: 'QUEUED',
    direction: 'OUTBOUND',
  })

  await createWhatsAppIfMissing({
    orgId,
    conversationId: convService.id,
    customerId: c3.id,
    toPhone: c3.phone,
    entityType: 'SERVICE_ORDER',
    entityId: so2.id,
    messageType: 'SERVICE_UPDATE',
    messageKey: `seed-demo-org:service-update:${orgId}:${so2.id}`,
    renderedText: 'Atualização da O.S.: implantação em andamento com equipe técnica.',
    status: 'SENT',
    direction: 'OUTBOUND',
  })

  await createWhatsAppIfMissing({
    orgId,
    conversationId: convFailed.id,
    customerId: c3.id,
    toPhone: c3.phone,
    entityType: 'CHARGE',
    entityId: charge2.id,
    messageType: 'PAYMENT_CONFIRMATION',
    messageKey: `seed-demo-org:payment-confirmation:${orgId}:${charge2.id}`,
    renderedText: 'Pagamento confirmado com sucesso. Obrigado pela confiança no atendimento da NexoGestão.',
    status: 'FAILED',
    direction: 'OUTBOUND',
  })

  const adminPerson = await prisma.person.findFirst({
    where: { orgId, role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (adminPerson) {
    await prisma.person.update({
      where: { id: adminPerson.id },
      data: {
        operationalState: OperationalStateValue.WARNING,
        operationalRiskScore: 58,
      },
    })
  }

  const bucket = `seed-demo-${now.toISOString().slice(0, 10)}`
  await prisma.governanceRun.upsert({
    where: { orgId_bucket: { orgId, bucket } },
    create: {
      orgId,
      bucket,
      startedAt: new Date(now.getTime() - 2 * 60 * 1000),
      finishedAt: new Date(now.getTime() - 60 * 1000),
      evaluated: 1,
      warnings: 1,
      correctives: 0,
      institutionalRiskScore: 58,
      restrictedCount: 0,
      suspendedCount: 0,
      openCorrectivesCount: 0,
      durationMs: 60000,
    },
    update: {
      evaluated: 1,
      warnings: 1,
      correctives: 0,
      institutionalRiskScore: 58,
      restrictedCount: 0,
      suspendedCount: 0,
      openCorrectivesCount: 0,
      durationMs: 60000,
      finishedAt: new Date(now.getTime() - 60 * 1000),
    },
  })

  const year = now.getFullYear()

  await upsertInvoice({
    orgId,
    customerId: c1.id,
    number: `INV-${year}-001`,
    description: 'Fatura de consultoria operacional demo',
    amountCents: 150000,
    status: 'ISSUED',
  })

  await upsertInvoice({
    orgId,
    customerId: c3.id,
    number: `INV-${year}-002`,
    description: 'Fatura de implementação de sistema demo',
    amountCents: 300000,
    status: 'PAID',
  })

  await createTimelineIfMissing({
    orgId,
    action: 'DEMO_SEED_CREATED',
    description: 'Seed demo executada com fluxo operacional mínimo.',
    metadata: {
      customers: 3,
      appointments: 2,
      serviceOrders: 2,
      charges: 2,
    },
  })

  await createTimelineIfMissing({
    orgId,
    action: 'CUSTOMER_OPERATIONAL_RISK_UPDATED',
    description: 'Risco operacional recalculado após cobrança vencida.',
    customerId: c1.id,
    metadata: {
      customerId: c1.id,
      score: 45,
      factors: { noShowCount: 0, overdueCount: 1, canceledCount: 0 },
      reason: 'seed-demo-org',
    },
  })

  await createTimelineIfMissing({
    orgId,
    action: 'GOVERNANCE_RUN_COMPLETED',
    description: 'Execução de governança registrada pela seed demo.',
    personId: adminPerson?.id,
    metadata: {
      institutionalRiskScore: 58,
      evaluated: 1,
      warnings: 1,
      restrictedCount: 0,
      suspendedCount: 0,
      source: 'seed-demo-org',
    },
  })

  await createTimelineIfMissing({
    orgId,
    action: 'CUSTOMER_CREATED',
    description: `Cliente ${c1.name} inserido na seed demo.`,
    customerId: c1.id,
    metadata: { source: 'seed-demo-org' },
  })

  await createTimelineIfMissing({
    orgId,
    action: 'APPOINTMENT_CREATED',
    description: `Agendamento criado para ${c1.name}.`,
    customerId: c1.id,
    appointmentId: apt1.id,
    metadata: {
      startsAt: apt1.startsAt.toISOString(),
      endsAt: apt1.endsAt.toISOString(),
      status: apt1.status,
    },
  })

  await createTimelineIfMissing({
    orgId,
    action: 'SERVICE_ORDER_CREATED',
    description: 'Ordem de serviço demo criada para consultoria.',
    customerId: c1.id,
    appointmentId: apt1.id,
    serviceOrderId: so1.id,
    metadata: {
      title: so1.title,
      status: so1.status,
    },
  })

  await createTimelineIfMissing({
    orgId,
    action: 'CHARGE_CREATED',
    description: 'Cobrança demo gerada para consultoria.',
    customerId: c1.id,
    serviceOrderId: so1.id,
    chargeId: charge1.id,
    metadata: {
      amountCents: charge1.amountCents,
      dueDate: charge1.dueDate.toISOString(),
      status: charge1.status,
    },
  })

  await createTimelineIfMissing({
    orgId,
    action: 'PAYMENT_RECEIVED',
    description: 'Pagamento demo registrado para implementação.',
    customerId: c3.id,
    serviceOrderId: so2.id,
    chargeId: charge2.id,
    metadata: {
      amountCents: charge2.amountCents,
      paidAt: charge2.paidAt?.toISOString() ?? null,
      status: charge2.status,
    },
  })

  console.log('✅ Demo org seed OK')
}
