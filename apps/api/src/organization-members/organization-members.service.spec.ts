import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { OrganizationMembersService } from './organization-members.service'

const stamp = new Date('2026-11-08T12:00:00Z')
describe('OrganizationMembersService', () => {
  const user = { findFirst: jest.fn(), count: jest.fn(), update: jest.fn() }
  const auditEvent = { create: jest.fn() }
  const tx = { user, auditEvent, $queryRaw: jest.fn() }
  const prisma = { $transaction: jest.fn() }
  const service = new OrganizationMembersService(prisma as any)
  const member = { id: 'member', email: 'm@example.com', role: 'STAFF', active: true, updatedAt: stamp, person: { id: 'person', active: true } }
  beforeEach(() => {
    jest.resetAllMocks()
    prisma.$transaction.mockImplementation(callback => callback(tx))
    user.findFirst.mockResolvedValueOnce({ id: 'actor', role: 'ADMIN', active: true }).mockResolvedValue(member)
    user.count.mockResolvedValue(1)
    user.update.mockResolvedValue({ ...member, role: 'VIEWER' })
  })
  it('authorizes the persisted actor after locking the tenant and audits the update', async () => {
    await service.updateMember('org-1', 'actor', 'member', { role: 'VIEWER', expectedUpdatedAt: stamp.toISOString() })
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(user.findFirst).toHaveBeenNthCalledWith(1, { where: { id: 'actor', orgId: 'org-1', active: true, role: 'ADMIN', person: { is: { active: true } } } })
    expect(user.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: 'member', orgId: 'org-1', person: { isNot: null } } }))
    expect(user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'member' }, data: { role: 'VIEWER', active: true } }))
    expect(auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ orgId: 'org-1', actorUserId: 'actor', action: 'ORGANIZATION_MEMBER_ACCESS_UPDATED', metadata: { previousRole: 'STAFF', role: 'VIEWER', previouslyActive: true, active: true } }) })
  })
  it('rejects an actor whose role or activation changed while waiting for the lock', async () => {
    user.findFirst.mockReset().mockResolvedValue(null)
    await expect(service.updateMember('org-1', 'actor', 'member', { active: false, expectedUpdatedAt: stamp.toISOString() })).rejects.toBeInstanceOf(ForbiddenException)
    expect(user.update).not.toHaveBeenCalled()
  })
  it('rejects other-tenant members and invitation-only accounts', async () => {
    user.findFirst.mockReset().mockResolvedValueOnce({ id: 'actor' }).mockResolvedValue(null)
    await expect(service.updateMember('org-1', 'actor', 'foreign', { active: false, expectedUpdatedAt: stamp.toISOString() })).rejects.toBeInstanceOf(NotFoundException)
    expect(user.update).not.toHaveBeenCalled()
  })
  it('rejects stale administrative forms', async () => {
    await expect(service.updateMember('org-1', 'actor', 'member', { role: 'VIEWER', expectedUpdatedAt: '2020-01-01T00:00:00Z' })).rejects.toBeInstanceOf(ConflictException)
    expect(user.update).not.toHaveBeenCalled()
  })
  it.each([{ role: 'VIEWER' as const }, { active: false }])('prevents changes to the administrator own access (%j)', async change => {
    await expect(service.updateMember('org-1', 'member', 'member', { ...change, expectedUpdatedAt: stamp.toISOString() })).rejects.toBeInstanceOf(BadRequestException)
    expect(user.update).not.toHaveBeenCalled()
  })
  it('protects the last usable administrator', async () => {
    user.findFirst.mockReset().mockResolvedValueOnce({ id: 'actor' }).mockResolvedValue({ ...member, role: 'ADMIN' })
    user.count.mockResolvedValue(0)
    await expect(service.updateMember('org-1', 'actor', 'member', { active: false, expectedUpdatedAt: stamp.toISOString() })).rejects.toThrow('pelo menos um administrador ativo')
    expect(user.update).not.toHaveBeenCalled()
  })
  it('does not reactivate an offboarded operational person through access administration', async () => {
    user.findFirst.mockReset().mockResolvedValueOnce({ id: 'actor' }).mockResolvedValue({ ...member, active: false, person: { id: 'person', active: false } })
    await expect(service.updateMember('org-1', 'actor', 'member', { active: true, expectedUpdatedAt: stamp.toISOString() })).rejects.toThrow('pessoa vinculada está inativa')
  })
  it('makes a repeated no-change request a no-op without duplicate audit', async () => {
    await service.updateMember('org-1', 'actor', 'member', { role: 'STAFF', expectedUpdatedAt: stamp.toISOString() })
    expect(user.update).not.toHaveBeenCalled()
    expect(auditEvent.create).not.toHaveBeenCalled()
  })
  it('rejects an empty update before opening a transaction', async () => {
    await expect(service.updateMember('org-1', 'actor', 'member', { expectedUpdatedAt: stamp.toISOString() })).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
