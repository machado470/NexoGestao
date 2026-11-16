import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import * as bcrypt from 'bcrypt'
import { InvitesService } from '../../src/invites/invites.service'
import { describeRealIntegration } from './infra-guards'

describeRealIntegration('Invites lifecycle with real PostgreSQL', () => {
  jest.setTimeout(30000)
  const prisma = new PrismaClient()
  const orgId = randomUUID()
  const email = { sendInvite: jest.fn() }
  const auth = { createSessionPayload: jest.fn().mockReturnValue({ token: 'test-session' }) }
  const service = new InvitesService(prisma as any, email as any, { get: () => 'https://nexo.test' } as any, auth as any)

  beforeAll(async () => {
    await prisma.organization.create({ data: { id: orgId, name: 'Invitation integration', slug: `invite-${orgId}` } })
  })
  beforeEach(() => {
    email.sendInvite.mockReset().mockResolvedValue(true)
    auth.createSessionPayload.mockClear()
  })
  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { orgId } })
    await prisma.person.deleteMany({ where: { orgId } })
    await prisma.user.deleteMany({ where: { orgId } })
    await prisma.organization.deleteMany({ where: { id: orgId } })
    await prisma.$disconnect()
  })
  async function pending() {
    const rawToken = randomUUID()
    const user = await prisma.user.create({ data: {
      orgId, email: `${randomUUID()}@invite.test`, role: 'STAFF', active: false,
      inviteToken: await bcrypt.hash(rawToken, 10), inviteExpiresAt: new Date(Date.now() + 60000),
    } })
    return { user, rawToken }
  }

  it('invalidates the old token after resend and activates with the new link', async () => {
    const { user, rawToken } = await pending()
    await service.resendInvite(orgId, user.id, 'Admin')
    const newToken = new URL(email.sendInvite.mock.calls[0][1]).searchParams.get('token')!
    await expect(service.acceptInvite(user.email, rawToken, 'Ana', 'Password123!')).rejects.toThrow()
    await expect(service.acceptInvite(user.email, newToken, 'Ana', 'Password123!')).resolves.toMatchObject({ success: true })
    expect(await prisma.person.count({ where: { orgId, userId: user.id } })).toBe(1)
  })

  it('revokes idempotently and rejects activation of the revoked link', async () => {
    const { user, rawToken } = await pending()
    await service.revokeInvite(orgId, user.id)
    await service.revokeInvite(orgId, user.id)
    await expect(service.acceptInvite(user.email, rawToken, 'Ana', 'Password123!')).rejects.toThrow()
    expect(await prisma.auditEvent.count({ where: { orgId, entityId: user.id, action: 'INVITE_REVOKED' } })).toBe(1)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).active).toBe(false)
  })

  it('allows only one of two concurrent acceptances to create a person and session', async () => {
    const { user, rawToken } = await pending()
    const results = await Promise.allSettled([
      service.acceptInvite(user.email, rawToken, 'Ana', 'Password123!'),
      service.acceptInvite(user.email, rawToken, 'Ana', 'Password123!'),
    ])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(await prisma.person.count({ where: { orgId, userId: user.id } })).toBe(1)
    expect(auth.createSessionPayload).toHaveBeenCalledTimes(1)
  })

  it('never activates a link successfully revoked in a concurrent request', async () => {
    const { user, rawToken } = await pending()
    const results = await Promise.allSettled([
      service.acceptInvite(user.email, rawToken, 'Ana', 'Password123!'),
      service.revokeInvite(orgId, user.id),
    ])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    const persisted = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(persisted.active).toBe(results[0].status === 'fulfilled')
    expect(persisted.inviteToken).toBeNull()
  })

  it('does not restore a revoked token when delivery fails after concurrent revocation', async () => {
    const { user, rawToken } = await pending()
    email.sendInvite.mockImplementationOnce(async () => {
      await service.revokeInvite(orgId, user.id)
      return false
    })
    await expect(service.resendInvite(orgId, user.id, 'Admin')).rejects.toThrow('Não foi possível reenviar')
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).inviteToken).toBeNull()
    await expect(service.acceptInvite(user.email, rawToken, 'Ana', 'Password123!')).rejects.toThrow()
  })
})
