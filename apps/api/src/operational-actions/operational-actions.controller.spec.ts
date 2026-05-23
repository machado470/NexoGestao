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
