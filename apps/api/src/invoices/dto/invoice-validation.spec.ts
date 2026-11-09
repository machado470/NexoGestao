import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CreateInvoiceDto } from './create-invoice.dto'
import { UpdateInvoiceDto } from './update-invoice.dto'

describe('Invoice runtime DTO validation', () => {
  it('allows omitting the description at creation as supported by persistence', async () => {
    expect(await validate(plainToInstance(CreateInvoiceDto, { number: 'INV-1', amountCents: 1000 }))).toEqual([])
  })
  it('keeps PATCH fields optional while validating supplied values', async () => {
    expect(await validate(plainToInstance(UpdateInvoiceDto, { description: 'Revised' }))).toEqual([])
    expect((await validate(plainToInstance(UpdateInvoiceDto, { amountCents: 1.5 }))).length).toBeGreaterThan(0)
    expect((await validate(plainToInstance(UpdateInvoiceDto, { amountCents: 2_147_483_648 }))).length).toBeGreaterThan(0)
    expect((await validate(plainToInstance(UpdateInvoiceDto, { customerId: 'not-a-uuid' }))).length).toBeGreaterThan(0)
    expect((await validate(plainToInstance(UpdateInvoiceDto, { number: null }))).length).toBeGreaterThan(0)
  })
})
