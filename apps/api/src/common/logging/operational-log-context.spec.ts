import { buildOperationalLogContext, serializeOperationalError } from './operational-log-context'

describe('operational-log-context', () => {
  it('serializa Error com name/message/code sem stack', () => {
    const err = Object.assign(new Error('boom'), { code: 'E_FAIL', secret: 'token' })
    const serialized = serializeOperationalError(err)

    expect(serialized).toEqual({ name: 'Error', message: 'boom', code: 'E_FAIL' })
    expect((serialized as any).stack).toBeUndefined()
    expect((serialized as any).secret).toBeUndefined()
  })

  it('preserva campos operacionais padrão', () => {
    const ctx = buildOperationalLogContext({
      event: 'execution_runner_failed',
      orgId: 'org-1',
      correlationId: 'corr-1',
      jobId: 'job-1',
      entityType: 'CHARGE',
      entityId: 'ch-1',
      actionId: 'action-1',
      deliveryId: 'd-1',
      webhookId: 'wh-1',
      attempt: 2,
    })

    expect(ctx).toEqual(expect.objectContaining({
      event: 'execution_runner_failed',
      orgId: 'org-1',
      correlationId: 'corr-1',
      jobId: 'job-1',
      entityType: 'CHARGE',
      entityId: 'ch-1',
      actionId: 'action-1',
      deliveryId: 'd-1',
      webhookId: 'wh-1',
      attempt: 2,
    }))
  })
})
