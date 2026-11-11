import { BadRequestException, Injectable } from '@nestjs/common'
import { FinanceService } from './finance.service'
import { CreatePaymentDto } from './dto/create-payment.dto'
import { TenantOperationsService } from '../common/tenant-ops/tenant-ops.service'
import { CommercialPolicyService, isCommercialBlocked } from '../common/commercial/commercial-policy.service'

/** Shared policy boundary for authenticated manual payments (not provider webhooks). */
@Injectable()
export class ManualPaymentsService {
  constructor(
    private readonly finance: FinanceService,
    private readonly tenantOps: TenantOperationsService,
    private readonly commercial: CommercialPolicyService,
  ) {}

  async pay(orgId: string, actorUserId: string | null, chargeId: string,
    body: CreatePaymentDto, idempotencyKeyHeader?: string) {
    const commercialLimit = await this.commercial.enforceMeter(orgId, 'finance_critical_actions')
    if (isCommercialBlocked(commercialLimit)) {
      throw new BadRequestException(
        `Pagamento bloqueado por política comercial: ${commercialLimit.reasonCode}`,
      )
    }

    const payLimit = await this.tenantOps.enforceLimit({
      orgId,
      scope: 'finance:pay-charge',
      limit: 30,
      windowMs: 60_000,
      blockedReason: 'tenant_finance_pay_charge_rate_limit',
    })
    if (!payLimit.allowed) {
      this.tenantOps.recordCriticalEvent(orgId, 'finance_pay_charge_blocked', {
        reason: payLimit.reason,
        used: payLimit.used,
      })
      throw new BadRequestException(
        `Pagamento bloqueado temporariamente: ${payLimit.reason}`,
      )
    }

    const data = await this.finance.payCharge({
      orgId,
      chargeId,
      actorUserId,
      method: body.method,
      amountCents: body.amountCents,
      paidAt: body.paidAt,
      notes: body.notes,
      idempotencyKey: body.idempotencyKey ?? idempotencyKeyHeader,
    })
    this.tenantOps.increment(orgId, 'finance_charge_pay')

    return data
  }
}
