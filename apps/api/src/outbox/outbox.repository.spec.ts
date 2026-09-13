import { OutboxRepository } from './outbox.repository'

describe('OutboxRepository factualSnapshot', () => {
  it('consulta somente estados persistidos e preserva ausência de pending', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{
        pending: 0n,
        failed: 3n,
        processing: 1n,
        oldestPendingAt: null,
      }]),
    }
    const repository = new OutboxRepository(prisma as any)

    await expect(repository.factualSnapshot()).resolves.toEqual({
      pending: 0,
      failed: 3,
      processing: 1,
      oldestPendingAt: null,
    })
    expect(prisma.$queryRaw.mock.calls[0][0].strings.join('')).toContain('OperationalOutboxEvent')
  })

  it('propaga falha de consulta para o contrato representar unknown', async () => {
    const repository = new OutboxRepository({ $queryRaw: jest.fn().mockRejectedValue(new Error('postgres unavailable')) } as any)
    await expect(repository.factualSnapshot()).rejects.toThrow('postgres unavailable')
  })
})
