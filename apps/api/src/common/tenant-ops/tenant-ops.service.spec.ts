import { TenantOperationsService } from './tenant-ops.service'

describe('TenantOperationsService', () => {
  it('aplica limite por orgId e por escopo', () => {
    const service = new TenantOperationsService()

    const first = service.enforceLimit({
      orgId: 'org-1',
      scope: 'automation:execute-trigger',
      limit: 2,
      windowMs: 60_000,
      blockedReason: 'limit',
    })
    const second = service.enforceLimit({
      orgId: 'org-1',
      scope: 'automation:execute-trigger',
      limit: 2,
      windowMs: 60_000,
      blockedReason: 'limit',
    })
    const third = service.enforceLimit({
      orgId: 'org-1',
      scope: 'automation:execute-trigger',
      limit: 2,
      windowMs: 60_000,
      blockedReason: 'limit',
    })

    expect(first.allowed).toBe(true)
    expect(second.allowed).toBe(true)
    expect(third.allowed).toBe(false)
    expect(third.reason).toBe('limit')
  })

  it('mantém isolamento por tenant no snapshot', () => {
    const service = new TenantOperationsService()
    service.increment('org-a', 'automation_execution')
    service.increment('org-b', 'whatsapp_queued', 3)

    const snapshot = service.snapshot()
    expect(snapshot.tenantCount).toBe(2)
    expect(snapshot.perTenant.find((x) => x.orgId === 'org-a')?.total).toBe(1)
    expect(snapshot.perTenant.find((x) => x.orgId === 'org-b')?.total).toBe(3)
  })
})
