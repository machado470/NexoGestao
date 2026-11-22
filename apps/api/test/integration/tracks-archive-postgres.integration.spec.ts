import { NotFoundException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

import { AuditService } from '../../src/audit/audit.service'
import { TracksService } from '../../src/tracks/tracks.service'
import { describeRealIntegration } from './infra-guards'

/**
 * C8 PR3-4 — archive isolation and atomicity against a real PostgreSQL (disposable CI database).
 *
 * Validates with Prisma 5 and the real schema that the explicit organization filters of the
 * archive transaction (`track: { orgId }` on assignments, `{ id, orgId }` on the track) are accepted
 * and enforced, that archiving in one organization never changes another, and that both domain
 * writes roll back together.
 */
describeRealIntegration('Track archive with PostgreSQL (organization filters and atomicity)', () => {
  jest.setTimeout(30000)
  const prisma = new PrismaClient()
  const audit = new AuditService(prisma as any)
  const service = new TracksService(prisma as any, audit, {} as any)
  const run = randomUUID().slice(0, 8)
  const orgA = `c8-archive-a-${run}`
  const orgB = `c8-archive-b-${run}`
  const ids = { trackA: `track-a-${run}`, trackB: `track-b-${run}` }
  const actor = { userId: null, personId: null }

  async function seed() {
    for (const org of [orgA, orgB]) {
      await prisma.organization.create({ data: { id: org, name: `C8 archive ${org}`, slug: org } })
      for (const n of [1, 2]) {
        await prisma.person.create({ data: { id: `${org}-p${n}`, name: `Pessoa ${n}`, role: 'STAFF', orgId: org } })
      }
    }
    await prisma.track.create({ data: { id: ids.trackA, orgId: orgA, slug: `a-${run}`, title: 'Trilha A', status: 'DRAFT', version: 1 } })
    await prisma.track.create({ data: { id: ids.trackB, orgId: orgB, slug: `b-${run}`, title: 'Trilha B', status: 'DRAFT', version: 1 } })
    await prisma.assignment.createMany({
      data: [
        { id: `asg-a1-${run}`, personId: `${orgA}-p1`, trackId: ids.trackA, progress: 40 },
        { id: `asg-a2-${run}`, personId: `${orgA}-p2`, trackId: ids.trackA, progress: 100 },
        { id: `asg-b1-${run}`, personId: `${orgB}-p1`, trackId: ids.trackB, progress: 10 },
      ],
    })
  }

  async function cleanup() {
    const orgs = [orgA, orgB]
    await prisma.auditEvent.deleteMany({ where: { orgId: { in: orgs } } })
    await prisma.assignment.deleteMany({ where: { trackId: { in: [ids.trackA, ids.trackB] } } })
    await prisma.track.deleteMany({ where: { orgId: { in: orgs } } })
    await prisma.person.deleteMany({ where: { orgId: { in: orgs } } })
    await prisma.organization.deleteMany({ where: { id: { in: orgs } } })
  }

  const snapshot = async () => ({
    tracks: await prisma.track.findMany({ where: { orgId: { in: [orgA, orgB] } }, select: { id: true, status: true, orgId: true }, orderBy: { id: 'asc' } }),
    assignments: await prisma.assignment.findMany({ where: { trackId: { in: [ids.trackA, ids.trackB] } }, select: { id: true, progress: true }, orderBy: { id: 'asc' } }),
    audits: await prisma.auditEvent.count({ where: { orgId: { in: [orgA, orgB] } } }),
  })

  beforeEach(async () => {
    await cleanup()
    await seed()
  })
  afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
  })

  it('Prisma accepts and enforces the explicit filters (composite where and relation filter)', async () => {
    // Composite unique where with a non-unique field (Prisma 5): a mismatching orgId is "not found".
    await expect(prisma.track.update({ where: { id: ids.trackB, orgId: orgA }, data: { status: 'ARCHIVED' } })).rejects.toMatchObject({ code: 'P2025' })
    // Relation filter on updateMany: assignments of another organization's track are not touched.
    const crossed = await prisma.assignment.updateMany({ where: { trackId: ids.trackB, track: { orgId: orgA }, progress: { lt: 100 } }, data: { progress: 100 } })
    expect(crossed.count).toBe(0)
    const own = await prisma.assignment.count({ where: { trackId: ids.trackB, track: { orgId: orgB } } })
    expect(own).toBe(1)
    expect((await prisma.track.findUnique({ where: { id: ids.trackB } }))!.status).toBe('DRAFT')
  })

  it('archiving a track of organization A changes only organization A, and writes one audit event', async () => {
    await service.archive(ids.trackA, orgA, { userId: null, personId: `${orgA}-p1` })
    const after = await snapshot()
    expect(after.tracks).toEqual([
      { id: ids.trackA, status: 'ARCHIVED', orgId: orgA },
      { id: ids.trackB, status: 'DRAFT', orgId: orgB },
    ])
    expect(after.assignments).toEqual([
      { id: `asg-a1-${run}`, progress: 100 },
      { id: `asg-a2-${run}`, progress: 100 },
      { id: `asg-b1-${run}`, progress: 10 },
    ])
    const events = await prisma.auditEvent.findMany({ where: { orgId: { in: [orgA, orgB] } } })
    expect(events).toEqual([
      expect.objectContaining({ orgId: orgA, action: 'TRACK_ARCHIVED', entityType: 'TRACK', entityId: ids.trackA, actorPersonId: `${orgA}-p1` }),
    ])
  })

  it('archiving a track of organization B from organization A is 404 with no write and no audit', async () => {
    const before = await snapshot()
    await expect(service.archive(ids.trackB, orgA, actor)).rejects.toBeInstanceOf(NotFoundException)
    expect(await snapshot()).toEqual(before)
  })

  it('a failure inside the archive transaction rolls back both writes', async () => {
    const before = await snapshot()
    // Same real database transaction; the track update fails after the assignments update ran.
    const failing: any = new Proxy(prisma, {
      get(target, prop) {
        if (prop !== '$transaction') return (target as any)[prop]
        return (fn: any) =>
          target.$transaction(async (tx) => {
            const txProxy = new Proxy(tx, {
              get(t, key) {
                if (key !== 'track') return (t as any)[key]
                return { ...t.track, update: async () => { throw new Error('simulated failure after assignments update') } }
              },
            })
            return fn(txProxy)
          })
      },
    })
    const failingService = new TracksService(failing, new AuditService(failing), {} as any)
    await expect(failingService.archive(ids.trackA, orgA, actor)).rejects.toThrow('simulated failure after assignments update')
    expect(await snapshot()).toEqual(before)
  })
})
