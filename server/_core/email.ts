/**
 * Email service for sending emails
 * Mock implementation that stores emails in memory
 * In production, integrate with SendGrid, AWS SES, or similar service
 */

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface StoredEmail extends EmailOptions {
  id: string;
  timestamp: Date;
  status: 'sent' | 'failed';
}

// In-memory storage for emails (for development/testing)
const emailStorage: StoredEmail[] = [];

/**
 * Send email
 * Mock implementation that stores emails and logs them
 * In production, integrate with real email service
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const emailId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const storedEmail: StoredEmail = {
      ...options,
      id: emailId,
      timestamp: new Date(),
      status: 'sent',
    };

    // Store email in memory
    emailStorage.push(storedEmail);

    // Log email for development
    console.log(`\n[Email] ✅ Email enviado com sucesso!`);
    console.log(`[Email] ID: ${emailId}`);
    console.log(`[Email] Para: ${options.to}`);
    console.log(`[Email] Assunto: ${options.subject}`);
    console.log(`[Email] Timestamp: ${storedEmail.timestamp.toISOString()}`);
    console.log(`[Email] Status: ${storedEmail.status}\n`);

    // TODO: Implement real email sending with SendGrid
    // if (process.env.SENDGRID_API_KEY) {
    //   const sgMail = require('@sendgrid/mail');
    //   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    //   await sgMail.send({
    //     to: options.to,
    //     from: process.env.SENDER_EMAIL || 'noreply@nexogestao.com',
    //     subject: options.subject,
    //     html: options.html,
    //     text: options.text,
    //   });
    // }

    return true;
  } catch (error) {
    console.error("[Email] ❌ Falha ao enviar email:", error);
    return false;
  }
}

/**
 * Get all stored emails (for development/testing)
 */
export function getStoredEmails(): StoredEmail[] {
  return emailStorage;
}

/**
 * Get email by ID (for development/testing)
 */
export function getEmailById(id: string): StoredEmail | undefined {
  return emailStorage.find(email => email.id === id);
}

/**
 * Get emails for a specific recipient (for development/testing)
 */
export function getEmailsByRecipient(to: string): StoredEmail[] {
  return emailStorage.filter(email => email.to === to);
}

/**
 * Clear all stored emails (for development/testing)
 */
export function clearStoredEmails(): void {
  emailStorage.length = 0;
  console.log('[Email] Todos os emails armazenados foram limpos');
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
  userName?: string
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #F97316; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background-color: #F97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { font-size: 12px; color: #666; margin-top: 20px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Redefinir Senha</h1>
          </div>
          <div class="content">
            <p>Olá${userName ? `, ${userName}` : ''},</p>
            <p>Você solicitou para redefinir sua senha no NexoGestão. Clique no botão abaixo para continuar:</p>
            <a href="${resetUrl}" class="button">Redefinir Senha</a>
            <p>Ou copie e cole este link no seu navegador:</p>
            <p style="word-break: break-all; background-color: #f0f0f0; padding: 10px; border-radius: 4px;">
              ${resetUrl}
            </p>
            <p><strong>Este link expira em 24 horas.</strong></p>
            <p>Se você não solicitou uma redefinição de senha, ignore este email.</p>
            <div class="footer">
              <p>© 2026 NexoGestão. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Olá${userName ? `, ${userName}` : ''},

Você solicitou para redefinir sua senha no NexoGestão.

Clique neste link para continuar: ${resetUrl}

Este link expira em 24 horas.

Se você não solicitou uma redefinição de senha, ignore este email.

© 2026 NexoGestão. Todos os direitos reservados.
  `;

  return sendEmail({
    to: email,
    subject: "Redefinir sua senha - NexoGestão",
    html,
    text,
  });
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(email: string, userName?: string): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #F97316; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background-color: #F97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { font-size: 12px; color: #666; margin-top: 20px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bem-vindo ao NexoGestão!</h1>
          </div>
          <div class="content">
            <p>Olá${userName ? `, ${userName}` : ''},</p>
            <p>Obrigado por se registrar no NexoGestão. Estamos felizes em tê-lo conosco!</p>
            <p>Comece a gerenciar seus clientes, agendamentos e ordens de serviço agora.</p>
            <a href="https://nexogestao.com/dashboard" class="button">Acessar Dashboard</a>
            <p>Se tiver dúvidas, entre em contato com nosso suporte.</p>
            <div class="footer">
              <p>© 2026 NexoGestão. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Olá${userName ? `, ${userName}` : ''},

Obrigado por se registrar no NexoGestão. Estamos felizes em tê-lo conosco!

Comece a gerenciar seus clientes, agendamentos e ordens de serviço agora.

Acesse: https://nexogestao.com/dashboard

Se tiver dúvidas, entre em contato com nosso suporte.

© 2026 NexoGestão. Todos os direitos reservados.
  `;

  return sendEmail({
    to: email,
    subject: "Bem-vindo ao NexoGestão!",
    html,
    text,
  });
}
