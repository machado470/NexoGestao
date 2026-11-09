import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
  ConflictException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { ChargeStatus } from '@prisma/client'
import { FinanceService } from '../finance/finance.service'
import Stripe from 'stripe'

interface CreateCheckoutSessionDto {
  orgId: string
  chargeId: string
  customerId: string
  amount: number
  description: string
  successUrl: string
  cancelUrl: string
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)
  private readonly stripe: Stripe | null

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private finance: FinanceService,
  ) {
    const secretKey =
      this.configService.get<string>('STRIPE_SECRET_KEY') ||
      this.configService.get<string>('STRIPE_KEY') ||
      ''
    const isProduction =
      (this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV || '')
        .toLowerCase()
        .trim() === 'production'

    if (!secretKey && isProduction) {
      throw new Error('[Payments] STRIPE_SECRET_KEY/STRIPE_KEY é obrigatório em produção')
    }

    if (secretKey) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' })
      this.logger.log('[BOOT][Payments] Stripe inicializado no PaymentsService')
    } else {
      this.stripe = null
      this.logger.warn('[BOOT][Payments][disabled] Stripe não configurado no PaymentsService (checkout online desabilitado)')
    }
  }

  /**
   * Cria uma sessão de checkout no Stripe
   */
  async createCheckoutSession(
    dto: CreateCheckoutSessionDto,
  ): Promise<{ sessionId: string; checkoutUrl: string }> {
    try {
      if (!this.stripe) {
        throw new BadRequestException('Stripe não configurado')
      }

      const charge = await this.prisma.charge.findFirst({
        where: {
          id: dto.chargeId,
          orgId: dto.orgId,
          customerId: dto.customerId,
        },
        select: {
          id: true,
          amountCents: true,
          currency: true,
          status: true,
          customerId: true,
          customer: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      })

      if (!charge) {
        throw new BadRequestException(
          'Cobrança não encontrada para este org/customer',
        )
      }

      if (charge.status !== 'PENDING' && charge.status !== 'OVERDUE') {
        throw new BadRequestException(
          'Apenas cobranças pendentes ou vencidas podem gerar checkout',
        )
      }

      if (charge.amountCents !== dto.amount) {
        throw new BadRequestException('Valor informado difere da cobrança')
      }

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: charge.currency.toLowerCase(),
              unit_amount: dto.amount,
              product_data: {
                name: dto.description,
              },
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: dto.successUrl,
        cancel_url: dto.cancelUrl,
        customer_email: charge.customer?.email || undefined,
        metadata: {
          orgId: dto.orgId,
          chargeId: dto.chargeId,
          customerId: dto.customerId,
          description: dto.description,
        },
        payment_intent_data: { metadata: {
          orgId: dto.orgId, chargeId: dto.chargeId, customerId: dto.customerId,
        } },
      })

      if (!session.url) {
        throw new BadRequestException('Stripe não retornou URL de checkout')
      }

      this.logger.log(`Sessão Stripe criada: ${session.id}`)

      return {
        sessionId: session.id,
        checkoutUrl: session.url,
      }
    } catch (error) {
      this.logger.error(`Erro ao criar checkout: ${error}`)
      throw error
    }
  }

  /**
   * Processa webhook do Stripe usando SDK oficial
   */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<{ received: true }> {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Stripe não configurado')
    }

    const secret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET')

    if (!secret) {
      throw new ServiceUnavailableException(
        'STRIPE_WEBHOOK_SECRET não configurado',
      )
    }

    const event = this.stripe.webhooks.constructEvent(rawBody, signature, secret)

    this.logger.log(`Webhook Stripe recebido: ${event.type}`)

    if (
      event.type === 'charge.succeeded' ||
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const object = event.data.object as Stripe.Charge | Stripe.Checkout.Session
      const orgId = object.metadata?.orgId
      const chargeId = object.metadata?.chargeId
      if (!orgId || !chargeId) return { received: true }
      const isCharge = event.type === 'charge.succeeded'
      const chargeObject = object as Stripe.Charge
      const session = object as Stripe.Checkout.Session
      const settled = isCharge
        ? chargeObject.paid === true && chargeObject.captured === true
        : session.mode === 'payment' && session.payment_status === 'paid'
      if (!settled) return { received: true }
      const amountCents = isCharge ? chargeObject.amount_captured : session.amount_total
      const currency = object.currency?.toLowerCase()
      const intent = object.payment_intent
      const intentId = typeof intent === 'string' ? intent : intent?.id
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || !currency || !intentId) {
        throw new BadRequestException('Pagamento Stripe liquidado sem valor, moeda ou referência válidos.')
      }
      const externalRef = `stripe:${intentId}`

      const internalCharge = await this.prisma.charge.findFirst({
        where: { id: chargeId, orgId },
        select: { id: true, orgId: true, amountCents: true, currency: true, status: true },
      })
      if (!internalCharge) throw new BadRequestException('Cobrança Stripe não encontrada para esta organização.')
      if (internalCharge.amountCents !== amountCents || internalCharge.currency.toLowerCase() !== currency) {
        throw new ConflictException('Pagamento Stripe diverge do valor ou moeda da cobrança. Conciliação necessária.')
      }
      await this.finance.payCharge({
        orgId, chargeId, actorUserId: null, method: 'CARD',
        amountCents, currency, externalRef,
        idempotencyKey: `stripe-payment:${intentId}`,
      })

      this.logger.log(
        `Pagamento processado com sucesso via Stripe. event=${event.type} chargeId=${chargeId} externalRef=${externalRef ?? 'n/a'}`,
      )
    } else if (event.type === 'charge.failed') {
      const failedCharge = event.data.object as Stripe.Charge
      this.logger.warn(`Pagamento falhou: ${failedCharge.id}`)
    }

    return { received: true }
  }

  /**
   * Lista cobranças de uma organização
   */
  async listCharges(orgId: string, status?: string) {
    try {
      const result = await this.finance.listCharges(orgId, {
        status: status as ChargeStatus,
      } as any)

      return result.items
    } catch (error) {
      this.logger.error(`Erro ao listar cobranças: ${error}`)
      throw error
    }
  }

  /**
   * Marca uma cobrança como paga manualmente
   */
  async markChargeAsPaid(
    orgId: string,
    chargeId: string,
    _paymentMethod: string = 'manual',
  ): Promise<void> {
    try {
      const charge = await this.prisma.charge.findFirst({
        where: {
          id: chargeId,
          orgId,
        },
      })
      if (!charge) return

      await this.finance.payCharge({
        orgId,
        chargeId,
        actorUserId: null,
        method: 'OTHER',
        amountCents: charge.amountCents,
      })

      this.logger.log(`Cobrança marcada como paga: ${chargeId}`)
    } catch (error) {
      this.logger.error(`Erro ao marcar cobrança como paga: ${error}`)
      throw error
    }
  }

  /**
   * Verifica cobranças vencidas e envia notificações
   */
  async checkOverdueCharges(): Promise<void> {
    try {
      const orgs = await this.prisma.organization.findMany({
        select: { id: true },
      })

      for (const org of orgs) {
        const res = await this.finance.automateOverdueLifecycle(org.id)
        this.logger.log(
          `Org ${org.id}: ${res.updated} cobranças vencidas processadas`,
        )
      }
    } catch (error) {
      this.logger.error(`Erro ao verificar cobranças vencidas: ${error}`)
    }
  }
}
