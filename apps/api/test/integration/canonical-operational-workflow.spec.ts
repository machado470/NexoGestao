import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'

import { AppModule } from '../../src/app.module'
import { PrismaService } from '../../src/prisma/prisma.service'

describe('Canonical Operational Workflow (e2e)', () => {
  let app: INestApplication
  let prisma: any

  const jwt = new JwtService({ secret: process.env.JWT_SECRET || 'dev-secret' })

  const primaryOrgId = randomUUID()
  const secondaryOrgId = randomUUID()
  const primaryPersonId = randomUUID()
  const secondaryPersonId = randomUUID()
  const primaryUserId = randomUUID()
  const secondaryUserId = randomUUID()

  const authFor = (orgId: string, userId: string, personId: string) => {
    const token = jwt.sign({ sub: userId, role: 'ADMIN', orgId, personId })
    return { Authorization: `Bearer ${token}` }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    prisma = app.get(PrismaService)

    await prisma.organization.createMany({
      data: [
        { id: primaryOrgId, name: `Workflow Org ${primaryOrgId.slice(0, 8)}`, slug: `wf-${primaryOrgId.slice(0, 8)}` },
        { id: secondaryOrgId, name: `Isolated Org ${secondaryOrgId.slice(0, 8)}`, slug: `wf-${secondaryOrgId.slice(0, 8)}` },
      ],
    })

    await prisma.person.createMany({
      data: [
        { id: primaryPersonId, orgId: primaryOrgId, name: 'Operator Main', role: 'TECH' },
        { id: secondaryPersonId, orgId: secondaryOrgId, name: 'Operator Isolated', role: 'TECH' },
      ],
    })
  })

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { orgId: { in: [primaryOrgId, secondaryOrgId] } } })
    await prisma.whatsAppMessage.deleteMany({ where: { orgId: { in: [primaryOrgId, secondaryOrgId] } } })
    await prisma.charge.deleteMany({ where: { orgId: { in: [primaryOrgId, secondaryOrgId] } } })
    await prisma.execution.deleteMany({ where: { orgId: { in: [primaryOrgId, secondaryOrgId] } } })
    await prisma.serviceOrder.deleteMany({ where: { orgId: { in: [primaryOrgId, secondaryOrgId] } } })
    await prisma.appointment.deleteMany({ where: { orgId: { in: [primaryOrgId, secondaryOrgId] } } })
    await prisma.customer.deleteMany({ where: { orgId: { in: [primaryOrgId, secondaryOrgId] } } })
    await prisma.timelineEvent.deleteMany({ where: { orgId: { in: [primaryOrgId, secondaryOrgId] } } })
    await prisma.auditEvent.deleteMany({ where: { orgId: { in: [primaryOrgId, secondaryOrgId] } } })
    await prisma.person.deleteMany({ where: { orgId: { in: [primaryOrgId, secondaryOrgId] } } })
    await prisma.organization.deleteMany({ where: { id: { in: [primaryOrgId, secondaryOrgId] } } })
    await app.close()
  })

  it('runs end-to-end operational flow with timeline, finance transitions, risk recalculation, and org isolation', async () => {
    const mainAuth = authFor(primaryOrgId, primaryUserId, primaryPersonId)
    const otherAuth = authFor(secondaryOrgId, secondaryUserId, secondaryPersonId)

    // 1) customer
    const createCustomer = await request(app.getHttpServer())
      .post('/customers')
      .set(mainAuth)
      .send({ name: 'Cliente Canônico', phone: '+55 (11) 99999-0000', email: `workflow.${primaryOrgId}@mail.test` })
      .expect(201)

    const customerId = createCustomer.body.id as string
    const customerDb = await prisma.customer.findFirst({ where: { id: customerId, orgId: primaryOrgId } })
    expect(customerDb).toBeTruthy()
    expect(customerDb?.phone).toBe('5511999990000')

    // tenant isolation check
    await request(app.getHttpServer()).get(`/customers/${customerId}`).set(otherAuth).expect(404)

    // 2) appointment
    const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const endsAt = new Date(Date.now() + 90 * 60 * 1000).toISOString()

    const createAppointment = await request(app.getHttpServer())
      .post('/appointments')
      .set(mainAuth)
      .send({ customerId, title: 'Visita técnica', startsAt, endsAt })
      .expect(201)

    const appointmentId = createAppointment.body.id as string
    const appointmentDb = await prisma.appointment.findFirst({ where: { id: appointmentId, orgId: primaryOrgId } })
    expect(appointmentDb?.status).toBe('SCHEDULED')

    // 3) confirm appointment + whatsapp
    await request(app.getHttpServer())
      .patch(`/appointments/${appointmentId}`)
      .set(mainAuth)
      .send({ status: 'CONFIRMED' })
      .expect(200)

    const confirmedAppointmentDb = await prisma.appointment.findFirst({ where: { id: appointmentId, orgId: primaryOrgId } })
    expect(confirmedAppointmentDb?.status).toBe('CONFIRMED')

    const confirmationMessage = await prisma.whatsAppMessage.findFirst({
      where: {
        orgId: primaryOrgId,
        entityType: 'APPOINTMENT',
        entityId: appointmentId,
        messageType: 'APPOINTMENT_CONFIRMATION',
      },
    })
    expect(confirmationMessage).toBeTruthy()

    // 4) create service order
    const createServiceOrder = await request(app.getHttpServer())
      .post('/service-orders')
      .set(mainAuth)
      .send({
        customerId,
        appointmentId,
        title: 'Execução de serviço completo',
        description: 'Fluxo operacional canônico',
        assignedToPersonId: primaryPersonId,
      })
      .expect(201)

    const serviceOrderId = createServiceOrder.body.id as string
    const serviceOrderDb = await prisma.serviceOrder.findFirst({ where: { id: serviceOrderId, orgId: primaryOrgId } })
    expect(serviceOrderDb?.status).toBe('ASSIGNED')

    // 5) start execution
    const startExecution = await request(app.getHttpServer())
      .post('/executions/start')
      .set(mainAuth)
      .send({ serviceOrderId, notes: 'Iniciado', checklist: [{ key: 'safety', done: true }] })
      .expect(201)

    const executionId = startExecution.body.id as string
    const executionDb = await prisma.execution.findFirst({ where: { id: executionId, orgId: primaryOrgId } })
    expect(executionDb?.serviceOrderId).toBe(serviceOrderId)

    const serviceOrderInProgress = await prisma.serviceOrder.findFirst({ where: { id: serviceOrderId, orgId: primaryOrgId } })
    expect(serviceOrderInProgress?.status).toBe('IN_PROGRESS')

    // 6) complete execution
    await request(app.getHttpServer())
      .post(`/executions/${executionId}/complete`)
      .set(mainAuth)
      .send({ notes: 'Concluído com sucesso', checklist: [{ key: 'final-review', done: true }] })
      .expect(201)

    const completedExecutionDb = await prisma.execution.findFirst({ where: { id: executionId, orgId: primaryOrgId } })
    expect(completedExecutionDb?.endedAt).toBeTruthy()

    const serviceOrderDone = await prisma.serviceOrder.findFirst({ where: { id: serviceOrderId, orgId: primaryOrgId } })
    expect(serviceOrderDone?.status).toBe('DONE')

    // 7) generate charge
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const createCharge = await request(app.getHttpServer())
      .post('/finance/charges')
      .set(mainAuth)
      .send({ customerId, serviceOrderId, amountCents: 15000, dueDate, notes: 'Cobrança do serviço' })
      .expect(201)

    const chargeId = createCharge.body.data.id as string
    const chargeDb = await prisma.charge.findFirst({ where: { id: chargeId, orgId: primaryOrgId } })
    expect(chargeDb?.status).toBe('PENDING')

    // finance transition: cross-tenant fetch must fail
    await request(app.getHttpServer()).get(`/finance/charges/${chargeId}`).set(otherAuth).expect(404)

    // 8) register payment
    const payResponse = await request(app.getHttpServer())
      .post(`/finance/charges/${chargeId}/pay`)
      .set(mainAuth)
      .send({ method: 'PIX', amountCents: 15000 })
      .expect(201)

    expect(payResponse.body.ok).toBe(true)
    expect(payResponse.body.data.paymentId).toBeTruthy()

    const paymentDb = await prisma.payment.findFirst({ where: { chargeId, orgId: primaryOrgId } })
    expect(paymentDb).toBeTruthy()
    expect(paymentDb?.amountCents).toBe(15000)

    const paidChargeDb = await prisma.charge.findFirst({ where: { id: chargeId, orgId: primaryOrgId } })
    expect(paidChargeDb?.status).toBe('PAID')
    expect(paidChargeDb?.paidAt).toBeTruthy()

    // 9) whatsapp notification for receipt
    const receiptMessage = await prisma.whatsAppMessage.findFirst({
      where: {
        orgId: primaryOrgId,
        entityType: 'CHARGE',
        entityId: chargeId,
        messageType: 'RECEIPT',
      },
    })
    expect(receiptMessage).toBeTruthy()

    // 10) timeline events emitted for canonical path
    const timeline = await prisma.timelineEvent.findMany({
      where: { orgId: primaryOrgId },
      orderBy: { createdAt: 'asc' },
      select: { action: true, metadata: true },
    })

    const actions = timeline.map((event) => event.action)
    expect(actions).toEqual(expect.arrayContaining([
      'CUSTOMER_CREATED',
      'APPOINTMENT_CREATED',
      'APPOINTMENT_CONFIRMED',
      'SERVICE_ORDER_CREATED',
      'EXECUTION_STARTED',
      'EXECUTION_DONE',
      'CHARGE_CREATED',
      'CHARGE_PAID',
    ]))

    // 11) recalculate risk from operational events (job endpoint + persisted state)
    await request(app.getHttpServer())
      .post('/admin/operational-state/run-once')
      .set(mainAuth)
      .expect(201)

    const personAfterRiskRun = await prisma.person.findFirst({
      where: { id: primaryPersonId, orgId: primaryOrgId },
      select: {
        operationalRiskScore: true,
        operationalState: true,
        operationalStateUpdatedAt: true,
      },
    })

    expect(personAfterRiskRun).toBeTruthy()
    expect(personAfterRiskRun?.operationalRiskScore).toBeGreaterThanOrEqual(0)
    expect(personAfterRiskRun?.operationalStateUpdatedAt).toBeTruthy()

    const isolatedOrgTimelineCount = await prisma.timelineEvent.count({ where: { orgId: secondaryOrgId } })
    expect(isolatedOrgTimelineCount).toBe(0)
  })
})
