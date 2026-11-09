import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InvitesService } from './invites.service';

jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));

describe('invitation lifecycle', () => {
  const user = { findFirst: jest.fn(), updateMany: jest.fn(), update: jest.fn(), findMany: jest.fn() };
  const auditEvent = { create: jest.fn() };
  const prisma = { user, auditEvent, $transaction: jest.fn() };
  const email = { sendInvite: jest.fn() };
  const config = { get: jest.fn() };
  const auth = { createSessionPayload: jest.fn() };
  const service = new InvitesService(prisma as any, email as any, config as any, auth as any);
  const previous = {
    id: 'invite-1', orgId: 'org-1', email: 'ana@example.com', role: 'STAFF',
    active: false, password: null, inviteToken: 'old-hash', inviteExpiresAt: new Date('2020-01-01'),
  };
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async callback => callback({ user, auditEvent }));
    config.get.mockReturnValue('https://nexo.example');
    email.sendInvite.mockResolvedValue(true);
    user.findFirst.mockResolvedValue({ ...previous });
    user.updateMany.mockResolvedValue({ count: 1 });
    user.update.mockResolvedValue({ id: previous.id, active: true });
    require('bcrypt').hash.mockResolvedValue('new-hash');
    require('bcrypt').compare.mockResolvedValue(true);
    auth.createSessionPayload.mockReturnValue({ token: 'session' });
  });

  it('renews an expired invitation without changing tenant, email or role and records the actor', async () => {
    const result = await service.resendInvite('org-1', 'invite-1', 'Admin', 'admin-1');
    expect(user.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ orgId: 'org-1', id: 'invite-1', active: false, password: null, person: { is: null } }) });
    expect(user.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ orgId: 'org-1', inviteToken: 'old-hash', inviteExpiresAt: previous.inviteExpiresAt }),
      data: { inviteToken: 'new-hash', inviteExpiresAt: expect.any(Date) },
    });
    expect(email.sendInvite).toHaveBeenCalledWith(previous.email, expect.stringContaining('/auth/accept-invite?token='), 'Admin');
    expect(result).toMatchObject({ id: 'invite-1', email: previous.email, role: 'STAFF' });
    expect(result).not.toHaveProperty('inviteToken');
    expect(auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ orgId: 'org-1', actorUserId: 'admin-1', action: 'INVITE_RESEND_REQUESTED' }) });
  });

  it.each(['resend', 'revoke'])('rejects %s for activated accounts or records outside the tenant', async action => {
    user.findFirst.mockResolvedValue(null);
    const call = action === 'resend' ? service.resendInvite('org-1', 'foreign', 'Admin') : service.revokeInvite('org-1', 'foreign');
    await expect(call).rejects.toBeInstanceOf(NotFoundException);
    expect(user.updateMany).not.toHaveBeenCalled();
    expect(email.sendInvite).not.toHaveBeenCalled();
  });

  it('rejects a stale resend without sending an activation link', async () => {
    user.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.resendInvite('org-1', 'invite-1', 'Admin')).rejects.toBeInstanceOf(ConflictException);
    expect(email.sendInvite).not.toHaveBeenCalled();
    expect(auditEvent.create).not.toHaveBeenCalled();
  });

  it.each(['false', 'throw'])('restores the previous invitation only if the failed resend still owns the token (%s)', async outcome => {
    if (outcome === 'throw') email.sendInvite.mockRejectedValue(new Error('provider down'));
    else email.sendInvite.mockResolvedValue(false);
    await expect(service.resendInvite('org-1', 'invite-1', 'Admin')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(user.updateMany).toHaveBeenLastCalledWith({
      where: expect.objectContaining({ id: 'invite-1', orgId: 'org-1', active: false, password: null, inviteToken: 'new-hash' }),
      data: { inviteToken: 'old-hash', inviteExpiresAt: previous.inviteExpiresAt },
    });
    expect(auditEvent.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ action: 'INVITE_RESEND_FAILED' }) });
  });

  it('validates delivery configuration before touching an expired invitation', async () => {
    config.get.mockReturnValue(undefined);
    await expect(service.resendInvite('org-1', 'invite-1', 'Admin')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(user.updateMany).not.toHaveBeenCalled();
  });

  it('revokes the current link without deleting a user or changing role', async () => {
    await expect(service.revokeInvite('org-1', 'invite-1', 'admin-1')).resolves.toEqual({ success: true });
    expect(user.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ orgId: 'org-1', id: 'invite-1', inviteToken: 'old-hash' }),
      data: { inviteToken: null },
    });
    expect(auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'INVITE_REVOKED', actorUserId: 'admin-1' }) });
  });

  it('makes repeated revocation idempotent', async () => {
    user.findFirst.mockResolvedValue({ ...previous, inviteToken: null });
    await expect(service.revokeInvite('org-1', 'invite-1')).resolves.toEqual({ success: true });
    expect(user.updateMany).not.toHaveBeenCalled();
    expect(auditEvent.create).not.toHaveBeenCalled();
  });

  it('does not revoke a newer link or a concurrently accepted invitation', async () => {
    user.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.revokeInvite('org-1', 'invite-1')).rejects.toBeInstanceOf(ConflictException);
    expect(auditEvent.create).not.toHaveBeenCalled();
  });

  it('consumes the token atomically before creating a person and session', async () => {
    await expect(service.acceptInvite(' ANA@example.com ', 'raw-token', 'Ana', 'Password123!')).resolves.toMatchObject({ success: true, token: 'session' });
    expect(user.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ email: 'ana@example.com', active: false, password: null }) });
    expect(user.updateMany).toHaveBeenCalledWith({ where: expect.objectContaining({ id: 'invite-1', orgId: 'org-1', inviteToken: 'old-hash', active: false, inviteExpiresAt: { gt: expect.any(Date) } }), data: { password: 'new-hash', active: true, inviteToken: null, inviteExpiresAt: null } });
    expect(auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'INVITE_ACCEPTED' }) });
  });

  it('does not create a person or session when token was revoked, replaced or already consumed during acceptance', async () => {
    user.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.acceptInvite(previous.email, 'old-token', 'Ana', 'Password123!')).rejects.toBeInstanceOf(ConflictException);
    expect(user.update).not.toHaveBeenCalled();
    expect(auth.createSessionPayload).not.toHaveBeenCalled();
  });

  it('does not accept a revoked or expired link', async () => {
    user.findFirst.mockResolvedValue(null);
    await expect(service.acceptInvite(previous.email, 'old-token', 'Ana', 'Password123!')).rejects.toBeInstanceOf(NotFoundException);
    expect(user.updateMany).not.toHaveBeenCalled();
  });

  it('returns official invitation states without exposing token hashes', async () => {
    user.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      previous,
      { ...previous, id: 'pending', inviteExpiresAt: new Date('2100-01-01') },
      { ...previous, id: 'revoked', inviteToken: null },
    ]);
    const result = await service.getOrganizationMembers('org-1');
    expect(result.invitations.map(invitation => invitation.status)).toEqual(['EXPIRED', 'PENDING', 'REVOKED']);
    expect(result.pendingInvites).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('old-hash');
    expect(result.invitations[0]).not.toHaveProperty('inviteToken');
  });
});
