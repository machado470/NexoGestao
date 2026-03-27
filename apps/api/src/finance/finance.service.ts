import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { $Enums, Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { AuditService } from '../audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import { OnboardingService } from '../onboarding/onboarding.service'
import { AUDIT_ACTIONS } from '../audit/audit.actions'
import { ChargesQueryDto } from './dto/charges-query.dto'
import { WhatsAppService } from '../whatsapp/whatsapp.service'
import { RiskService } from '../risk/risk.service'
import { RequestContextService } from '../common/context/request-context.service'
import { MetricsService } from '../common/metrics/metrics.service'
import { AutomationService } from '../automation/automation.service'
import { QueueService } from '../queue/queue.service'
import { QUEUE_NAMES } from '../queue/queue.constants'

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
    private readonly audit: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly onboardingService: OnboardingService,
    private readonly whatsapp: WhatsAppService,
    private readonly risk: RiskService,
    private readonly requestContext: RequestContextService,
    private readonly metrics: MetricsService,
    private readonly automation: AutomationService,
    private readonly queueService: QueueService,
  ) {}

  async automateOverdueLifecycle(orgId: string) {
    const now = new Date()

    const overdue = await this.prisma.charge.findMany({
      where: {
        orgId,
        status: 'PENDING',
        dueDate: { lt: now },
      },
      include: {
        customer: { select: { id: true, phone: true, name: true } },
      },
      take: 200,
    })

    for (const charge of overdue) {
      // 1. vira overdue
      await this.prisma.charge.update({
        where: { id: charge.id },
        data: { status: 'OVERDUE' },
      })

      // 2. timeline
      await this.timeline.log({
        orgId,
        action: 'CHARGE_OVERDUE',
        description: 'Cobrança movida para vencida (automação)',
        metadata: {
          chargeId: charge.id,
          customerId: charge.customerId,
        },
      })

      // =============================
      //  COBRANÇA INTELIGENTE
      // =============================

      const lastReminderAt = (charge as any).lastReminderAt
      const reminderCount = (charge as any).reminderCount ?? 0

      // evita spam (24h)
      if (
        lastReminderAt &&
        now.getTime() - new Date(lastReminderAt).getTime() <
          24 * 60 * 60 * 1000
      ) {
        continue
      }

      // limite de tentativas
      if (reminderCount >= 3) {
        continue
      }

      if (charge.customer?.phone) {
        const firstName =
          charge.customer.name?.split(' ')[0] || 'cliente'

        const amount = (charge.amountCents / 100).toFixed(2)

        let message = ''

        if (reminderCount === 0) {
          message = `Olá ${firstName}, tudo bem? Identificamos uma cobrança vencida de R$ ${amount}. Posso te enviar o link de pagamento?`
        } else if (reminderCount === 1) {
          message = `Olá ${firstName}, passando para lembrar da cobrança de R$ ${amount}. Posso te enviar o link?`
        } else {
          message = `Olá ${firstName}, precisamos regularizar a cobrança de R$ ${amount}. Podemos resolver agora?`
        }

        await this.whatsapp.enqueueMessage({
          orgId,
          customerId: charge.customerId,
          toPhone: charge.customer.phone,
          entityType: 'CHARGE',
          entityId: charge.id,
          messageType: 'PAYMENT_REMINDER',
          messageKey: `charge:${charge.id}:smart:${reminderCount}`,
          renderedText: message,
        })

        // salva estado
        try {
          await this.prisma.charge.update({
            where: { id: charge.id },
            data: {
              lastReminderAt: now,
              reminderCount: {
                increment: 1,
              },
            } as any,
          })
        } catch {
          // ainda não existe no schema → ignora
        }
      }

      // risco
      await this.risk.recalculateCustomerOperationalRisk(
        orgId,
        charge.customerId,
        'CHARGE_OVERDUE',
      )

      // automação
      await this.automation.executeTrigger({
        orgId,
        trigger: 'PAYMENT_OVERDUE',
        payload: {
          chargeId: charge.id,
          customerId: charge.customerId,
        },
      })
    }

    return { updated: overdue.length }
  }
}
