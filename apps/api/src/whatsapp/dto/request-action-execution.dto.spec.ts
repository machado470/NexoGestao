import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { RequestActionExecutionDto } from './whatsapp.dto'

async function errors(input: Record<string, unknown>) {
  return validate(plainToInstance(RequestActionExecutionDto, input), { whitelist: true, forbidNonWhitelisted: true })
}

describe('RequestActionExecutionDto', () => {
  it.each([
    ['SEND_PAYMENT_LINK', { entityType: 'CHARGE', entityId: 'charge-1', paymentLink: 'https://pay.local/1', chargeAmount: 0 }],
    ['CONFIRM_APPOINTMENT', { entityType: 'APPOINTMENT', entityId: 'appointment-1', appointmentDate: '2026-09-14', appointmentTime: '10:00' }],
    ['RESCHEDULE_APPOINTMENT', { entityType: 'APPOINTMENT', entityId: 'appointment-1', startsAt: '2026-09-14T10:00:00.000Z', content: 'Novo horário' }],
    ['SEND_SERVICE_UPDATE', { entityType: 'SERVICE_ORDER', entityId: 'service-order-1', serviceOrderNumber: 'OS-1' }],
    ['REPLY_WITH_TEMPLATE', { entityType: 'GENERAL', entityId: null, templateKey: 'manual_followup', context: { customerName: 'Ana' } }],
    ['ESCALATE_TO_OPERATOR', undefined],
    ['MARK_RESOLVED', { entityType: 'GENERAL', entityId: null }],
  ])('accepts %s with its canonical payload', async (suggestedAction, actionPayload) => {
    expect(await errors({ suggestedAction, ...(actionPayload === undefined ? {} : { actionPayload }) })).toEqual([])
  })

  it.each([
    { suggestedAction: 'MARK_RESOLVED', orgId: 'forged' },
    { suggestedAction: 'MARK_RESOLVED', tenantId: 'forged' },
    { suggestedAction: 'MARK_RESOLVED', organizationId: 'forged' },
    { suggestedAction: 'MARK_RESOLVED', actionPayload: { entityType: 'GENERAL', entityId: null, orgId: 'forged' } },
    { suggestedAction: 'MARK_RESOLVED', actionPayload: { entityType: 'GENERAL', entityId: null, paymentLink: 'https://pay.local/1' } },
    { suggestedAction: 'SEND_PAYMENT_LINK', actionPayload: { entityType: 'CHARGE', entityId: 'charge-1' } },
    { suggestedAction: 'RESCHEDULE_APPOINTMENT', actionPayload: { entityType: 'APPOINTMENT', entityId: 'appointment-1', startsAt: 'tomorrow' } },
    { suggestedAction: 'REPLY_WITH_TEMPLATE', actionPayload: { entityType: 'GENERAL', entityId: null, templateKey: 'unknown' } },
  ])('rejects invalid or spoofed input %#', async input => {
    expect(await errors(input)).not.toEqual([])
  })
})
