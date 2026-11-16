import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { InvitesController } from './invites.controller';
import { ActiveUserGuard } from '../auth/guards/active-user.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('InvitesController administrative boundary', () => {
  it.each(['createInvite', 'getOrganizationMembers', 'resendInvite', 'revokeInvite'] as const)('%s requires an authenticated, active administrator', method => {
    expect(Reflect.getMetadata(GUARDS_METADATA, InvitesController.prototype[method])).toEqual([
      JwtAuthGuard, ActiveUserGuard, RolesGuard,
    ]);
    expect(Reflect.getMetadata('roles', InvitesController.prototype[method])).toEqual(['ADMIN']);
  });

  it('forwards resend using only the authenticated tenant and actor', async () => {
    const service = { resendInvite: jest.fn().mockResolvedValue({ id: 'invite-1' }) };
    const controller = new InvitesController(service as any);
    await controller.resendInvite({ user: { orgId: 'org-1', email: 'admin@example.com', sub: 'admin-1' }, body: { orgId: 'other' } }, 'invite-1');
    expect(service.resendInvite).toHaveBeenCalledWith('org-1', 'invite-1', 'admin@example.com', 'admin-1');
  });
  it('forwards revocation using only the authenticated tenant and actor', async () => {
    const service = { revokeInvite: jest.fn().mockResolvedValue({ success: true }) };
    const controller = new InvitesController(service as any);
    await controller.revokeInvite({ user: { orgId: 'org-1', sub: 'admin-1' }, body: { orgId: 'other' } }, 'invite-1');
    expect(service.revokeInvite).toHaveBeenCalledWith('org-1', 'invite-1', 'admin-1');
  });

  it('uses only the authenticated tenant for listing members', async () => {
    const service = { getOrganizationMembers: jest.fn().mockResolvedValue({ users: [], pendingInvites: [] }) };
    const controller = new InvitesController(service as any);
    await controller.getOrganizationMembers({ user: { orgId: 'org-authenticated' }, body: { orgId: 'org-other' } });
    expect(service.getOrganizationMembers).toHaveBeenCalledWith('org-authenticated');
  });
});
