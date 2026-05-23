import { OperationalActionsController } from './operational-actions.controller'

describe('OperationalActionsController', () => {
  it('diagnostics usa orgId do req.user', async () => {
    const actions = { getOperationalActionsDiagnostics: jest.fn().mockResolvedValue({ ok: true }) } as any
    const controller = new OperationalActionsController(actions)

    const out = await controller.diagnostics({ user: { orgId: 'org-abc' } })

    expect(out).toEqual({ ok: true })
    expect(actions.getOperationalActionsDiagnostics).toHaveBeenCalledWith('org-abc')
  })
})


it('recoverStuck usa orgId e actor do req.user', async () => {
  const actions = { recoverStuckExecution: jest.fn().mockResolvedValue({ ok: true }) } as any
  const controller = new OperationalActionsController(actions)

  const out = await controller.recoverStuck({ user: { orgId: 'org-1', id: 'u-9' } }, { executionId: 'exec-1', recoveryReason: 'manual' })

  expect(out).toEqual({ ok: true })
  expect(actions.recoverStuckExecution).toHaveBeenCalledWith({ orgId: 'org-1', actorUserId: 'u-9', executionId: 'exec-1', recoveryReason: 'manual' })
})
