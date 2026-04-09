import { BadRequestException, ConflictException } from '@nestjs/common'
import { CustomersService } from '../../src/customers/customers.service'
import { PeopleService } from '../../src/people/people.service'

const prismaMock: any = {
  customer: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  person: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
}

const commonDeps = {
  timeline: { log: jest.fn() },
  audit: { log: jest.fn() },
  notifications: { createNotification: jest.fn() },
  onboarding: { completeOnboardingStep: jest.fn() },
  analytics: { track: jest.fn() },
  idempotency: { begin: jest.fn(), complete: jest.fn(), fail: jest.fn() },
}

describe('Wave2 concurrency guards', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('requires expectedUpdatedAt for customer update', async () => {
    const service = new CustomersService(
      prismaMock,
      commonDeps.timeline as any,
      commonDeps.audit as any,
      commonDeps.notifications as any,
      commonDeps.onboarding as any,
      commonDeps.analytics as any,
      commonDeps.idempotency as any,
    )

    prismaMock.customer.findFirst.mockResolvedValue({
      id: 'c1',
      name: 'Cliente',
      phone: '11999999999',
      email: null,
      notes: null,
      active: true,
      updatedAt: new Date('2026-04-09T10:00:00.000Z'),
    })

    await expect(
      service.update({
        orgId: 'org-1',
        updatedBy: 'u1',
        personId: null,
        id: 'c1',
        data: { name: 'Cliente 2' },
      }),
    ).rejects.toThrow(BadRequestException)
  })

  it('returns explicit conflict for customer update race', async () => {
    const service = new CustomersService(
      prismaMock,
      commonDeps.timeline as any,
      commonDeps.audit as any,
      commonDeps.notifications as any,
      commonDeps.onboarding as any,
      commonDeps.analytics as any,
      commonDeps.idempotency as any,
    )

    prismaMock.customer.findFirst
      .mockResolvedValueOnce({
        id: 'c1',
        name: 'Cliente',
        phone: '11999999999',
        email: null,
        notes: null,
        active: true,
        updatedAt: new Date('2026-04-09T10:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'c1',
        updatedAt: new Date('2026-04-09T10:05:00.000Z'),
        active: true,
      })

    prismaMock.customer.updateMany.mockResolvedValue({ count: 0 })

    await expect(
      service.update({
        orgId: 'org-1',
        updatedBy: 'u1',
        personId: null,
        id: 'c1',
        data: {
          name: 'Cliente 2',
          expectedUpdatedAt: '2026-04-09T10:00:00.000Z',
        },
      }),
    ).rejects.toThrow(ConflictException)
  })

  it('requires expectedUpdatedAt for people update', async () => {
    const service = new PeopleService(prismaMock, commonDeps.audit as any, commonDeps.timeline as any)

    prismaMock.person.findFirst.mockResolvedValue({
      id: 'p1',
      updatedAt: new Date('2026-04-09T10:00:00.000Z'),
      active: true,
    })

    await expect(
      service.updatePerson('p1', 'org-1', { name: 'Novo nome' }),
    ).rejects.toThrow(BadRequestException)
  })
})
