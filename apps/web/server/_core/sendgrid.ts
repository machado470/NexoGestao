/**
 * Helpers para integração com SendGrid
 * Envio de emails transacionais
 */

import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export interface EmailData {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  categories?: string[];
  customArgs?: Record<string, string>;
}

/**
 * Envia um email
 */
export async function sendEmail(data: EmailData) {
  try {
    const message = {
      to: data.to,
      from: data.from || process.env.SENDGRID_FROM_EMAIL || 'noreply@nexogestao.com.br',
      subject: data.subject,
      html: data.html,
      text: data.text,
      replyTo: data.replyTo,
      cc: data.cc,
      bcc: data.bcc,
      categories: data.categories,
      customArgs: data.customArgs,
    };

    const result = await sgMail.send(message);
    return { success: true, messageId: result[0].headers['x-message-id'] };
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    throw error;
  }
}

/**
 * Envia um email de boas-vindas
 */
export async function sendWelcomeEmail(email: string, name: string) {
  return sendEmail({
    to: email,
    subject: 'Bem-vindo ao NexoGestão!',
    html: `
      <h1>Bem-vindo, ${name}!</h1>
      <p>Estamos felizes em ter você no NexoGestão.</p>
      <p>Comece a gerenciar seu negócio agora mesmo.</p>
      <a href="${process.env.FRONTEND_URL}/dashboard">Acessar Dashboard</a>
    `,
    categories: ['welcome'],
  });
}

/**
 * Envia email de recuperação de senha
 */
export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  return sendEmail({
    to: email,
    subject: 'Recuperar sua senha',
    html: `
      <h1>Recuperar Senha</h1>
      <p>Você solicitou a recuperação de sua senha.</p>
      <p><a href="${resetUrl}">Clique aqui para redefinir sua senha</a></p>
      <p>Este link expira em 24 horas.</p>
      <p>Se você não solicitou isso, ignore este email.</p>
    `,
    categories: ['password-reset'],
  });
}

/**
 * Envia email de confirmação de email
 */
export async function sendEmailConfirmationEmail(email: string, confirmationToken: string) {
  const confirmUrl = `${process.env.FRONTEND_URL}/confirm-email?token=${confirmationToken}`;
  
  return sendEmail({
    to: email,
    subject: 'Confirme seu email',
    html: `
      <h1>Confirmar Email</h1>
      <p>Clique no link abaixo para confirmar seu email:</p>
      <p><a href="${confirmUrl}">Confirmar Email</a></p>
      <p>Este link expira em 24 horas.</p>
    `,
    categories: ['email-confirmation'],
  });
}

/**
 * Envia notificação de novo agendamento
 */
export async function sendAppointmentConfirmationEmail(
  email: string,
  appointmentData: {
    customerName: string;
    date: string;
    time: string;
    service: string;
  }
) {
  return sendEmail({
    to: email,
    subject: `Agendamento Confirmado - ${appointmentData.date}`,
    html: `
      <h1>Agendamento Confirmado</h1>
      <p>Olá ${appointmentData.customerName},</p>
      <p>Seu agendamento foi confirmado:</p>
      <ul>
        <li><strong>Data:</strong> ${appointmentData.date}</li>
        <li><strong>Hora:</strong> ${appointmentData.time}</li>
        <li><strong>Serviço:</strong> ${appointmentData.service}</li>
      </ul>
      <p>Obrigado!</p>
    `,
    categories: ['appointment-confirmation'],
  });
}

/**
 * Envia notificação de cobrança
 */
export async function sendChargeNotificationEmail(
  email: string,
  chargeData: {
    customerName: string;
    amount: number;
    dueDate: string;
    description: string;
  }
) {
  return sendEmail({
    to: email,
    subject: `Cobrança Pendente - R$ ${(chargeData.amount / 100).toFixed(2)}`,
    html: `
      <h1>Cobrança Pendente</h1>
      <p>Olá ${chargeData.customerName},</p>
      <p>Você tem uma cobrança pendente:</p>
      <ul>
        <li><strong>Valor:</strong> R$ ${(chargeData.amount / 100).toFixed(2)}</li>
        <li><strong>Vencimento:</strong> ${chargeData.dueDate}</li>
        <li><strong>Descrição:</strong> ${chargeData.description}</li>
      </ul>
      <p>Favor efetuar o pagamento.</p>
    `,
    categories: ['charge-notification'],
  });
}

/**
 * Envia email de lembrete de cobrança vencida
 */
export async function sendOverdueChargeEmail(
  email: string,
  chargeData: {
    customerName: string;
    amount: number;
    daysOverdue: number;
    description: string;
  }
) {
  return sendEmail({
    to: email,
    subject: `URGENTE: Cobrança Vencida - R$ ${(chargeData.amount / 100).toFixed(2)}`,
    html: `
      <h1>Cobrança Vencida</h1>
      <p>Olá ${chargeData.customerName},</p>
      <p>Sua cobrança venceu há ${chargeData.daysOverdue} dias:</p>
      <ul>
        <li><strong>Valor:</strong> R$ ${(chargeData.amount / 100).toFixed(2)}</li>
        <li><strong>Dias Vencidos:</strong> ${chargeData.daysOverdue}</li>
        <li><strong>Descrição:</strong> ${chargeData.description}</li>
      </ul>
      <p>Favor efetuar o pagamento imediatamente.</p>
    `,
    categories: ['overdue-charge'],
  });
}

/**
 * Envia email de relatório
 */
export async function sendReportEmail(
  email: string,
  reportData: {
    title: string;
    period: string;
    summary: string;
    attachmentUrl?: string;
  }
) {
  return sendEmail({
    to: email,
    subject: `Relatório: ${reportData.title}`,
    html: `
      <h1>${reportData.title}</h1>
      <p><strong>Período:</strong> ${reportData.period}</p>
      <p>${reportData.summary}</p>
      ${reportData.attachmentUrl ? `<p><a href="${reportData.attachmentUrl}">Baixar Relatório</a></p>` : ''}
    `,
    categories: ['report'],
  });
}

/**
 * Envia email em lote
 */
export async function sendBulkEmail(recipients: string[], data: Omit<EmailData, 'to'>) {
  const results = [];
  
  for (const email of recipients) {
    try {
      const result = await sendEmail({ ...data, to: email });
      results.push({ email, success: true, ...result });
    } catch (error) {
      results.push({ email, success: false, error });
    }
  }
  
  return results;
}
