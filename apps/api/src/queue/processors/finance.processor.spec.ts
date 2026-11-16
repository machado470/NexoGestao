import { FinanceProcessor } from './finance.processor'

describe('Finance worker outcome handling', () => {
  const build = () => {
    const finance = { createAutomationCharge: jest.fn(), sendPaymentReminder: jest.fn().mockResolvedValue({ status: 'queued', messageId: 'm1' }), sendPaymentReminderWhatsApp: jest.fn() }
    const queues = { updateJobStatus: jest.fn() }
    return { finance, queues, processor: new FinanceProcessor({} as any, finance as any, queues as any) }
  }
  it('runs the tenant-scoped reminder once and returns its actual result', async () => {
    const { finance, queues, processor } = build()
    await expect(processor.processJob({ id: '1', name: 'payment-reminder', data: { orgId: 'org', chargeId: 'charge' } })).resolves.toEqual({ status: 'queued', messageId: 'm1' })
    expect(finance.sendPaymentReminder).toHaveBeenCalledTimes(1)
    expect(finance.sendPaymentReminderWhatsApp).not.toHaveBeenCalled()
    expect(queues.updateJobStatus).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'COMPLETED', completed: true }))
  })
  it('does not report completion when a financial action fails', async () => {
    const { finance, queues, processor } = build()
    finance.createAutomationCharge.mockRejectedValue(new Error('Unavailable'))
    await expect(processor.processJob({ id: '1', name: 'create-charge', data: {} })).rejects.toThrow('Unavailable')
    expect(queues.updateJobStatus).not.toHaveBeenCalledWith(expect.objectContaining({ completed: true }))
  })
  it('rejects unknown jobs instead of treating them as completed', async () => {
    const { finance, queues, processor } = build()
    await expect(processor.processJob({ id: '1', name: 'unknown', data: {} })).rejects.toThrow('não suportado')
    expect(finance.sendPaymentReminder).not.toHaveBeenCalled()
    expect(queues.updateJobStatus).not.toHaveBeenCalledWith(expect.objectContaining({ completed: true }))
  })
})
