import { OperationalSignalsService } from './operational-signals.service'

describe('OperationalSignalsService', () => {
  const orgId = 'org-1'
  const diagnostics = {
    runForOrg: jest.fn().mockResolvedValue({
      findings: [
        { id: 'CHARGE_PAID_WITHOUT_PAYMENT:c1', severity: 'CRITICAL', area: 'FINANCE', code: 'CHARGE_PAID_WITHOUT_PAYMENT', title: 'Cobrança paga sem pagamento', description: 'x', entityType: 'Charge', entityId: 'c1', detectedAt: '2026-05-20T00:00:00.000Z', suggestedAction: 'Revisar' },
      ],
    }),
  }
  const prisma: any = {
    charge: { findMany: jest.fn().mockResolvedValue([{ id: 'c2', customerId: 'cust-1', amountCents: 600000, dueDate: new Date('2026-04-01T00:00:00.000Z'), updatedAt: new Date('2026-05-20T00:00:00.000Z') }]) },
    whatsAppMessage: { findMany: jest.fn().mockResolvedValue([{ id: 'm1', customerId: 'cust-1', updatedAt: new Date('2026-05-20T00:00:00.000Z'), errorCode: 'TIMEOUT' }]) },
  }

  it('transforma diagnostic critical e calcula prioridade', async () => {
    const service = new OperationalSignalsService(prisma, diagnostics as any)
    const result = await service.listForOrg(orgId, 20)
    expect(result.signals[0].severity).toBe('CRITICAL')
    expect(result.signals[0].priorityScore).toBeGreaterThanOrEqual(100)
  })

  it('ordena por prioridade e limita resultados', async () => {
    const service = new OperationalSignalsService(prisma, diagnostics as any)
    const result = await service.listForOrg(orgId, 1)
    expect(result.signals).toHaveLength(1)
  })

  it('retorna next best action específica', async () => {
    const service = new OperationalSignalsService(prisma, diagnostics as any)
    const result = await service.getNextBestAction(orgId)
    expect(result?.actionType).toBeTruthy()
    expect(result?.entityId).toBeTruthy()
  })

  it('não retorna dados sensíveis', async () => {
    const service = new OperationalSignalsService(prisma, diagnostics as any)
    const result = await service.listForOrg(orgId, 20)
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('phone')
    expect(serialized).not.toContain('content')
    expect(serialized).not.toContain('token')
  })
})
