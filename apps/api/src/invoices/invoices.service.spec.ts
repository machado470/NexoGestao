import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { InvoicesService } from './invoices.service'

describe('Invoice integrity', () => {
  let db: any, service: InvoicesService
  const input = { number: 'INV-1', amountCents: 1000, customerId: 'customer' }
  beforeEach(() => {
    db = { customer: { findFirst: jest.fn().mockResolvedValue({ id: 'customer' }) }, invoice: {
      findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'invoice' }),
      update: jest.fn().mockResolvedValue({ id: 'invoice' }), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0),
    } }
    service = new InvoicesService(db)
  })
  it('rejects a foreign customer on create and update', async () => {
    db.customer.findFirst.mockResolvedValue(null)
    await expect(service.create('org', input)).rejects.toBeInstanceOf(NotFoundException)
    db.invoice.findFirst.mockResolvedValue({ id: 'invoice', status: 'DRAFT' })
    await expect(service.update('org', 'invoice', { customerId: 'foreign' })).rejects.toBeInstanceOf(NotFoundException)
    expect(db.invoice.create).not.toHaveBeenCalled()
    expect(db.invoice.update).not.toHaveBeenCalled()
  })
  it('defaults the optional description to an empty persisted string', async () => {
    await service.create('org', input)
    expect(db.invoice.create).toHaveBeenCalledWith({ data: expect.objectContaining({ orgId: 'org', description: '' }) })
    expect(db.customer.findFirst).toHaveBeenCalledWith({ where: { id: 'customer', orgId: 'org' }, select: { id: true } })
  })
  it.each([1.5, 0, -1, NaN, Infinity, 2_147_483_648])('rejects invalid amount %p', async amountCents => {
    await expect(service.create('org', { ...input, amountCents })).rejects.toBeInstanceOf(BadRequestException)
    db.invoice.findFirst.mockResolvedValue({ id: 'invoice', status: 'DRAFT' })
    await expect(service.update('org', 'invoice', { amountCents })).rejects.toBeInstanceOf(BadRequestException)
  })
  it('maps concurrent duplicate numbers to a conflict', async () => {
    db.invoice.create.mockRejectedValue({ code: 'P2002' })
    await expect(service.create('org', input)).rejects.toBeInstanceOf(ConflictException)
  })
  it('maps duplicate numbers on editing to a conflict', async () => {
    db.invoice.findFirst.mockResolvedValue({ id: 'invoice', status: 'DRAFT' })
    db.invoice.update.mockRejectedValue({ code: 'P2002' })
    await expect(service.update('org', 'invoice', { number: 'existing' })).rejects.toBeInstanceOf(ConflictException)
  })
  it('scopes the related customer on historical invoice reads', async () => {
    db.invoice.findFirst.mockResolvedValue({ id: 'invoice', customer: null })
    await service.findOne('org', 'invoice')
    expect(db.invoice.findFirst).toHaveBeenCalledWith({ where: { id: 'invoice', orgId: 'org' }, include: { customer: { where: { orgId: 'org' } } } })
    await service.list('org', {})
    expect(db.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ include: { customer: { where: { orgId: 'org' }, select: expect.any(Object) } } }))
  })
})
