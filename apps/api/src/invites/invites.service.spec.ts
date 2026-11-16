import { InvitesService } from './invites.service';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed-token') }));

describe('InvitesService delivery and tenant isolation', () => {
  const prisma = { user: { findUnique: jest.fn(), create: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() } };
  const email = { sendInvite: jest.fn() };
  const config = { get: jest.fn() };
  const service = new InvitesService(prisma as any, email as any, config as any, {} as any);
  const created = { id: 'invite-1', email: 'new@example.com', role: 'STAFF', inviteToken: 'hashed-token', password: 'secret', inviteExpiresAt: new Date() };
  beforeEach(() => {
    jest.resetAllMocks();
    require('bcrypt').hash.mockResolvedValue('hashed-token');
    config.get.mockReturnValue('https://nexo.example');
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(created);
    email.sendInvite.mockResolvedValue(true);
  });

  it.each(['org-1', 'other-org'])('never overwrites an existing account belonging to %s', async orgId => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing', orgId });
    await expect(service.createInvite('org-1', 'new@example.com', 'Admin', 'STAFF')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(email.sendInvite).not.toHaveBeenCalled();
  });

  it('normalizes email, sends the correct activation route and returns only public fields', async () => {
    const result = await service.createInvite('org-1', ' NEW@example.com ', 'Admin', 'STAFF');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'new@example.com' } });
    expect(prisma.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ orgId: 'org-1', active: false, email: 'new@example.com', role: 'STAFF' }) });
    expect(email.sendInvite).toHaveBeenCalledWith('new@example.com', expect.stringContaining('/auth/accept-invite?token='), 'Admin');
    expect(result).toEqual({ id: created.id, email: created.email, role: created.role, inviteExpiresAt: created.inviteExpiresAt });
  });

  it.each([false, 'throw'])('reports failed delivery (%s) and removes only its own unused invitation', async outcome => {
    if (outcome === 'throw') email.sendInvite.mockRejectedValue(new Error('provider unavailable'));
    else email.sendInvite.mockResolvedValue(false);
    await expect(service.createInvite('org-1', 'new@example.com', 'Admin', 'STAFF')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: 'invite-1', orgId: 'org-1', active: false, inviteToken: 'hashed-token' } });
  });

  it('validates the frontend configuration before persisting any invitation', async () => {
    config.get.mockReturnValue(undefined);
    await expect(service.createInvite('org-1', 'new@example.com', 'Admin', 'STAFF')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('lists members and pending invitations scoped to the authenticated organization', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    await expect(service.getOrganizationMembers('org-1')).resolves.toEqual({ users: [], pendingInvites: [], invitations: [] });
    for (const [query] of prisma.user.findMany.mock.calls) expect(query.where.orgId).toBe('org-1');
  });
});
