import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { EmailService } from '../email/email.service'
import { ChargeStatus } from '@prisma/client'

interface CreateCheckoutSessionDto {
  customerId: string
  amount: number
  description: string
  successUrl: string
  cancelUrl: string
}

interface WebhookPayload {
  type: string
  data: {
    object: {
      id: string
      amount: number
      amount_received: number
      status: string
      customer: string
      metadata?: Record<string, string>
    }
  }
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)
  private stripeApiKey: string

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private email: EmailService,
  ) {
    this.stripeApiKey = this.configService.get<string>('STRIPE_API_KEY') || ''
  }

  /**
   * Cria uma sessão de checkout no Stripe
   */
  async createCheckoutSession(
    dto: CreateCheckoutSessionDto,
  ): Promise<{ sessionId: string; checkoutUrl: string }> {
    try {
      if (!this.stripeApiKey) {
        throw new BadRequestException('STRIPE_API_KEY não configurada')
      }

      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${this.stripeApiKey}`,
        },
        body: new URLSearchParams({
          'payment_method_types[0]': 'card',
          'line_items[0][price_data][currency]': 'brl',
          'line_items[0][price_data][unit_amount]': String(dto.amount),
          'line_items[0][price_data][product_data][name]': dto.description,
          'line_items[0][quantity]': '1',
          mode: 'payment',
          success_url: dto.successUrl,
          cancel_url: dto.cancelUrl,
          customer_email: dto.customerId,
          metadata: JSON.stringify({
            customerId: dto.customerId,
            description: dto.description,
          }),
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        this.logger.error(`Erro ao criar sessão Stripe: ${error}`)
        throw new BadRequestException(`Erro ao criar sessão de pagamento: ${error}`)
      }

      const data: any = await response.json()
      this.logger.log(`Sessão Stripe criada: ${data.id}`)

      return {
        sessionId: data.id,
        checkoutUrl: data.url,
      }
    } catch (error) {
      this.logger.error(`Erro ao criar checkout: ${error}`)
      throw error
    }
  }

  /**
   * Processa webhook de pagamento do Stripe
   */
  async processWebhook(payload: WebhookPayload): Promise<void> {
    try {
      if (payload.type === 'charge.succeeded') {
        const charge = payload.data.object

        // Registrar o pagamento no banco de dados
        const customerId = charge.metadata?.customerId || charge.customer

        // Atualizar a cobrança como paga
        await this.prisma.charge.updateMany({
          where: {
            customerId,
            status: 'PENDING',
          },
          data: {
            status: 'PAID',
          },
        })

        this.logger.log(`Pagamento processado com sucesso: ${charge.id}`)
      } else if (payload.type === 'charge.failed') {
        this.logger.warn(`Pagamento falhou: ${payload.data.object.id}`)
      }
    } catch (error) {
      this.logger.error(`Erro ao processar webhook: ${error}`)
      throw error
    }
  }

  /**
   * Cria uma cobrança (charge) para um cliente
   */
  async createCharge(
    orgId: string,
    customerId: string,
    amount: number,
    description: string,
    dueDate: Date,
  ): Promise<{ id: string; status: string }> {
    try {
      const charge = await this.prisma.charge.create({
        data: {
          orgId,
          customerId,
          amountCents: amount,
          description,
          status: 'PENDING',
          dueDate,
          createdAt: new Date(),
        },
      })

      this.logger.log(`Cobrança criada: ${charge.id}`)

      return {
        id: charge.id,
        status: charge.status,
      }
    } catch (error) {
      this.logger.error(`Erro ao criar cobrança: ${error}`)
      throw error
    }
  }

  /**
   * Lista cobranças de uma organização
   */
  async listCharges(orgId: string, status?: string) {
    try {
      const charges = await this.prisma.charge.findMany({
        where: {
          orgId,
          ...(status && { status: status as ChargeStatus }),
        },
        include: {
          customer: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return charges
    } catch (error) {
      this.logger.error(`Erro ao listar cobranças: ${error}`)
      throw error
    }
  }

  /**
   * Marca uma cobrança como paga manualmente
   */
  async markChargeAsPaid(chargeId: string, _paymentMethod: string = 'manual'): Promise<void> {
    try {
      await this.prisma.charge.update({
        where: { id: chargeId },
        data: {
          status: 'PAID',
        },
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
      const now = new Date()
      const overdueCharges = await this.prisma.charge.findMany({
        where: {
          status: 'PENDING',
          dueDate: {
            lt: now,
          },
        },
        include: {
          customer: true,
        },
      })

      for (const charge of overdueCharges) {
        // Atualizar status para OVERDUE
        await this.prisma.charge.update({
          where: { id: charge.id },
          data: { status: 'OVERDUE' },
        })

        // Enviar notificação por e-mail
        if (charge.customer.email) {
          await this.email.sendOverdueChargeNotification(
            charge.customer.email,
            charge.customer.name,
            charge.amountCents,
            charge.dueDate,
          )
        }
      }

      this.logger.log(`${overdueCharges.length} cobranças marcadas como vencidas`)
    } catch (error) {
      this.logger.error(`Erro ao verificar cobranças vencidas: ${error}`)
    }
  }
}
