import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private resendApiKey: string
  private readonly resendConfigured: boolean

  constructor(private configService: ConfigService) {
    this.resendApiKey = this.configService.get<string>('RESEND_API_KEY') || ''
    this.resendConfigured = this.resendApiKey.trim().length > 0
    if (!this.resendConfigured) {
      this.logger.warn(
        '[OPTIONAL][integration-missing-config] RESEND_API_KEY não configurada. Serviço de e-mail ativo em modo degradado.',
      )
    }
  }

  /**
   * Envia um e-mail usando Resend API
   */
  async send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.resendConfigured) {
        return { success: false, error: 'RESEND_API_KEY não configurada' }
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.resendApiKey}`,
        },
        body: JSON.stringify({
          from: this.configService.get<string>('EMAIL_FROM') || 'noreply@nexogestao.com',
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        this.logger.error(`Erro ao enviar e-mail: ${error}`)
        return { success: false, error }
      }

      const data: any = await response.json()
      this.logger.log(`E-mail enviado com sucesso para ${options.to}. ID: ${data.id}`)
      return { success: true, messageId: data.id }
    } catch (error) {
      this.logger.error(`Erro ao enviar e-mail: ${error}`)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Envia e-mail de recuperação de senha
   */
  async sendPasswordReset(email: string, resetToken: string, resetLink: string): Promise<boolean> {
    const html = `
      <h2>Recuperação de Senha - NexoGestão</h2>
      <p>Recebemos uma solicitação para redefinir sua senha.</p>
      <p>Clique no link abaixo para criar uma nova senha:</p>
      <a href="${resetLink}" style="background-color: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Redefinir Senha
      </a>
      <p>Este link expira em 24 horas.</p>
      <p>Se você não solicitou isso, ignore este e-mail.</p>
    `

    const result = await this.send({
      to: email,
      subject: 'Recuperação de Senha - NexoGestão',
      html,
      text: `Clique aqui para redefinir sua senha: ${resetLink}`,
    })

    return result.success
  }

  /**
   * Envia e-mail de convite para colaborador
   */
  async sendInvite(email: string, inviteLink: string, senderName: string): Promise<boolean> {
    const html = `
      <h2>Convite para NexoGestão</h2>
      <p>${senderName} o convida para participar do NexoGestão.</p>
      <p>Clique no link abaixo para ativar sua conta:</p>
      <a href="${inviteLink}" style="background-color: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Ativar Conta
      </a>
      <p>Este link expira em 24 horas.</p>
    `

    const result = await this.send({
      to: email,
      subject: 'Convite para NexoGestão',
      html,
      text: `Você foi convidado para participar do NexoGestão. Clique aqui: ${inviteLink}`,
    })

    return result.success
  }

  /**
   * Envia confirmação de novo agendamento
   */
  async sendAppointmentConfirmation(
    email: string,
    customerName: string,
    appointmentDate: Date,
    appointmentTime: string,
  ): Promise<boolean> {
    const html = `
      <h2>Agendamento Confirmado</h2>
      <p>Olá ${customerName},</p>
      <p>Seu agendamento foi confirmado com sucesso!</p>
      <p><strong>Data:</strong> ${appointmentDate.toLocaleDateString('pt-BR')}</p>
      <p><strong>Horário:</strong> ${appointmentTime}</p>
      <p>Se precisar cancelar ou reagendar, entre em contato conosco.</p>
    `

    const result = await this.send({
      to: email,
      subject: 'Agendamento Confirmado - NexoGestão',
      html,
    })

    return result.success
  }

  /**
   * Envia notificação de cobrança vencida
   */
  async sendOverdueChargeNotification(
    email: string,
    customerName: string,
    chargeAmount: number,
    dueDate: Date,
  ): Promise<boolean> {
    const html = `
      <h2>Cobrança Vencida</h2>
      <p>Olá ${customerName},</p>
      <p>Você tem uma cobrança vencida em nossa plataforma.</p>
      <p><strong>Valor:</strong> R$ ${(chargeAmount / 100).toFixed(2)}</p>
      <p><strong>Data de Vencimento:</strong> ${dueDate.toLocaleDateString('pt-BR')}</p>
      <p>Por favor, regularize o pagamento o quanto antes.</p>
    `

    const result = await this.send({
      to: email,
      subject: 'Cobrança Vencida - NexoGestão',
      html,
    })

    return result.success
  }
}
