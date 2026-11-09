import { BadRequestException } from '@nestjs/common'
import { PeopleService } from './people.service'

describe('People activity safety', () => {
  const stamp = new Date('2026-11-09T00:00:00Z')
  let tx: any, service: PeopleService, timeline: any
  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      person: {
        findFirst: jest.fn().mockResolvedValue({ id: 'person', orgId: 'org', active: true, updatedAt: stamp }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      serviceOrder: { count: jest.fn().mockResolvedValue(0) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'admin' }), count: jest.fn().mockResolvedValue(1) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    }
    timeline = { logInTransaction: jest.fn().mockResolvedValue({}) }
    service = new PeopleService({ $transaction: (fn: any) => fn(tx) } as any, {} as any, timeline)
  })
  const edit = (s: PeopleService) => s.updatePerson('person', 'org', { active: false, expectedUpdatedAt: stamp.toISOString() }, 'actor')

  it.each(['PATCH', 'DELETE'])('%s blocks people with assigned or ongoing service orders', async route => {
    tx.serviceOrder.count.mockResolvedValue(1)
    await expect(route === 'PATCH' ? edit(service) : service.deactivatePerson('person', 'org', 'actor')).rejects.toThrow('serviço ativa')
    expect(tx.serviceOrder.count).toHaveBeenCalledWith({ where: { orgId: 'org', assignedToPersonId: 'person', status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } } })
    expect(tx.person.updateMany).not.toHaveBeenCalled()
  })
  it.each(['PATCH', 'DELETE'])('%s preserves the last usable administrator', async route => {
    tx.user.count.mockResolvedValue(0)
    await expect(route === 'PATCH' ? edit(service) : service.deactivatePerson('person', 'org', 'actor')).rejects.toThrow('pelo menos um administrador ativo')
    expect(tx.person.updateMany).not.toHaveBeenCalled()
  })
  it('uses the tenant lock and writes evidence within the mutation transaction', async () => {
    await edit(service)
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.person.findFirst.mock.invocationCallOrder[0])
    expect(tx.user.count).toHaveBeenCalledWith({ where: { orgId: 'org', id: { not: 'admin' }, active: true, role: 'ADMIN', person: { is: { active: true } } } })
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ orgId: 'org', actorUserId: 'actor', personId: 'person', action: 'PERSON_DEACTIVATED' }) })
    expect(timeline.logInTransaction).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org', personId: 'person', action: 'PERSON_DEACTIVATED' }), tx)
  })
  it('rejects an actor whose administrative access changed while waiting for the lock', async () => {
    tx.user.findFirst.mockResolvedValueOnce(null)
    await expect(edit(service)).rejects.toThrow('administradores ativos')
    expect(tx.person.updateMany).not.toHaveBeenCalled()
  })
  it('does not permit self-deactivation through person editing', async () => {
    tx.user.findFirst.mockResolvedValue({ id: 'actor' })
    await expect(edit(service)).rejects.toThrow('próprio acesso')
    expect(tx.person.updateMany).not.toHaveBeenCalled()
  })
  it('rejects stale edits without recording a successful activity change', async () => {
    tx.person.updateMany.mockResolvedValue({ count: 0 })
    await expect(edit(service)).rejects.toThrow('outra operação')
    expect(tx.auditEvent.create).not.toHaveBeenCalled()
    expect(timeline.logInTransaction).not.toHaveBeenCalled()
  })
  it('records reactivation without disabling or changing the linked user', async () => {
    tx.person.findFirst.mockResolvedValue({ id: 'person', active: false, updatedAt: stamp })
    await service.updatePerson('person', 'org', { active: true, expectedUpdatedAt: stamp.toISOString() }, 'actor')
    expect(tx.serviceOrder.count).not.toHaveBeenCalled()
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'PERSON_REACTIVATED' }) })
  })
  it('rejects nonboolean activity before starting a transaction', async () => {
    await expect(service.updatePerson('person', 'org', { active: 'false' })).rejects.toBeInstanceOf(BadRequestException)
    expect(tx.$queryRaw).not.toHaveBeenCalled()
  })
})
