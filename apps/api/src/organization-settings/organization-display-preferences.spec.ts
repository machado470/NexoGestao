import { Reflector } from '@nestjs/core'
import { RolesGuard } from '../auth/guards/roles.guard'
import { OrganizationSettingsController } from './organization-settings.controller'
import { OrganizationSettingsService } from './organization-settings.service'

describe('organization display preferences boundary', () => {
  const guard = new RolesGuard(new Reflector())
  function context(method: string, role: string) {
    return { getHandler: () => OrganizationSettingsController.prototype[method], getClass: () => OrganizationSettingsController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role, orgId: 'authenticated-org' } }) }) } as any
  }
  it.each(['ADMIN', 'MANAGER', 'STAFF', 'VIEWER', 'OPERADOR', 'FINANCEIRO'])('allows %s only the limited preferences route', role => {
    expect(guard.canActivate(context('getDisplayPreferences', role))).toBe(true)
    if (role !== 'ADMIN') {
      expect(() => guard.canActivate(context('getSettings', role))).toThrow()
      expect(() => guard.canActivate(context('updateSettings', role))).toThrow()
      expect(() => guard.canActivate(context('getAdministrativeSummary', role))).toThrow()
    }
  })
  it('selects only display fields in the authenticated tenant', async () => {
    const prisma = { organization: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC', currency: 'USD' }) } }
    const service = new OrganizationSettingsService(prisma as any)
    const controller = new OrganizationSettingsController(service)
    await expect(controller.getDisplayPreferences({ user: { orgId: 'authenticated-org' }, query: { orgId: 'other-org' } })).resolves.toEqual({ timezone: 'UTC', currency: 'USD' })
    expect(prisma.organization.findUnique).toHaveBeenCalledWith({ where: { id: 'authenticated-org' }, select: { timezone: true, currency: true } })
  })
  it('does not invent preferences for a missing organization', async () => {
    const service = new OrganizationSettingsService({ organization: { findUnique: jest.fn().mockResolvedValue(null) } } as any)
    await expect(service.getDisplayPreferences('missing')).rejects.toThrow('Organização não encontrada.')
  })
})
