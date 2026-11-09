import { ServiceUnavailableException } from '@nestjs/common'
import { AutomationService } from './automation.service'

describe('Automation execution safety while the engine is unavailable', () => {
  it.each(['CREATE_CHARGE', 'SEND_WHATSAPP_MESSAGE', 'CREATE_NOTIFICATION', 'UPDATE_RISK'])('fails %s explicitly without creating another job', async type => {
    const queue = { addJob: jest.fn() }
    const service = new AutomationService({} as any, {} as any, {} as any, {} as any, queue as any, {} as any, {} as any)
    await expect(service.executeActionJob({ orgId: 'org', action: { type }, payload: {} })).rejects.toBeInstanceOf(ServiceUnavailableException)
    expect(queue.addJob).not.toHaveBeenCalled()
    await expect(service.executeTrigger({ orgId: 'org', trigger: 'test', payload: {} })).resolves.toMatchObject({ disabled: true, matchedRules: 0 })
  })
})
