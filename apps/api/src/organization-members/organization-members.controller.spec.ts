import 'reflect-metadata'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { OrganizationMembersController } from './organization-members.controller'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ActiveUserGuard } from '../auth/guards/active-user.guard'
import { RolesGuard } from '../auth/guards/roles.guard'

describe('OrganizationMembersController', () => {
  it('requires a persisted active administrator', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, OrganizationMembersController)).toEqual([JwtAuthGuard, ActiveUserGuard, RolesGuard])
    expect(Reflect.getMetadata('roles', OrganizationMembersController)).toEqual(['ADMIN'])
  })
  it('uses tenant and actor from the session only', async () => {
    const service = { updateMember: jest.fn() }
    const controller = new OrganizationMembersController(service as any)
    const input = { active: false, expectedUpdatedAt: '2026-11-08T12:00:00Z' }
    await controller.updateMember({ user: { sub: 'actor', orgId: 'tenant' }, body: { orgId: 'other' } }, 'member', input)
    expect(service.updateMember).toHaveBeenCalledWith('tenant', 'actor', 'member', input)
  })
})
