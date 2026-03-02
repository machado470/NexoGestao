/**
 * Helpers para integração com Twilio
 * SMS e WhatsApp
 */

import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '';
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || '';

const client = twilio(accountSid, authToken);

/**
 * Envia um SMS
 */
export async function sendSMS(phoneNumber: string, message: string) {
  try {
    const result = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: phoneNumber,
    });

    return {
      success: true,
      messageId: result.sid,
      status: result.status,
    };
  } catch (error) {
    console.error('Erro ao enviar SMS:', error);
    throw error;
  }
}

/**
 * Envia uma mensagem WhatsApp
 */
export async function sendWhatsApp(phoneNumber: string, message: string) {
  try {
    const result = await client.messages.create({
      body: message,
      from: `whatsapp:${twilioWhatsAppNumber}`,
      to: `whatsapp:${phoneNumber}`,
    });

    return {
      success: true,
      messageId: result.sid,
      status: result.status,
    };
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    throw error;
  }
}

/**
 * Envia confirmação de agendamento via SMS
 */
export async function sendAppointmentConfirmationSMS(
  phoneNumber: string,
  appointmentData: {
    date: string;
    time: string;
    service: string;
  }
) {
  const message = `Seu agendamento foi confirmado! Data: ${appointmentData.date} às ${appointmentData.time}. Serviço: ${appointmentData.service}. Obrigado!`;
  return sendSMS(phoneNumber, message);
}

/**
 * Envia lembrete de agendamento via SMS
 */
export async function sendAppointmentReminderSMS(
  phoneNumber: string,
  appointmentData: {
    date: string;
    time: string;
  }
) {
  const message = `Lembrete: Você tem um agendamento em ${appointmentData.date} às ${appointmentData.time}. Confirme sua presença.`;
  return sendSMS(phoneNumber, message);
}

/**
 * Envia notificação de cobrança via SMS
 */
export async function sendChargeNotificationSMS(
  phoneNumber: string,
  chargeData: {
    amount: number;
    dueDate: string;
  }
) {
  const message = `Você tem uma cobrança de R$ ${(chargeData.amount / 100).toFixed(2)} com vencimento em ${chargeData.dueDate}. Efetue o pagamento.`;
  return sendSMS(phoneNumber, message);
}

/**
 * Envia lembrete de cobrança vencida via SMS
 */
export async function sendOverdueChargeSMS(
  phoneNumber: string,
  chargeData: {
    amount: number;
    daysOverdue: number;
  }
) {
  const message = `URGENTE: Sua cobrança de R$ ${(chargeData.amount / 100).toFixed(2)} venceu há ${chargeData.daysOverdue} dias. Efetue o pagamento imediatamente.`;
  return sendSMS(phoneNumber, message);
}

/**
 * Envia confirmação de agendamento via WhatsApp
 */
export async function sendAppointmentConfirmationWhatsApp(
  phoneNumber: string,
  appointmentData: {
    customerName: string;
    date: string;
    time: string;
    service: string;
  }
) {
  const message = `Olá ${appointmentData.customerName}! 👋\n\nSeu agendamento foi confirmado! ✅\n\n📅 Data: ${appointmentData.date}\n🕐 Hora: ${appointmentData.time}\n🔧 Serviço: ${appointmentData.service}\n\nObrigado!`;
  return sendWhatsApp(phoneNumber, message);
}

/**
 * Envia lembrete de agendamento via WhatsApp
 */
export async function sendAppointmentReminderWhatsApp(
  phoneNumber: string,
  appointmentData: {
    date: string;
    time: string;
  }
) {
  const message = `Lembrete: Você tem um agendamento em ${appointmentData.date} às ${appointmentData.time}. 📅\n\nConfirme sua presença respondendo com SIM.`;
  return sendWhatsApp(phoneNumber, message);
}

/**
 * Envia notificação de cobrança via WhatsApp
 */
export async function sendChargeNotificationWhatsApp(
  phoneNumber: string,
  chargeData: {
    amount: number;
    dueDate: string;
    description: string;
  }
) {
  const message = `💰 Você tem uma cobrança pendente!\n\nValor: R$ ${(chargeData.amount / 100).toFixed(2)}\nVencimento: ${chargeData.dueDate}\nDescrição: ${chargeData.description}\n\nEfetue o pagamento para evitar atrasos.`;
  return sendWhatsApp(phoneNumber, message);
}

/**
 * Envia lembrete de cobrança vencida via WhatsApp
 */
export async function sendOverdueChargeWhatsApp(
  phoneNumber: string,
  chargeData: {
    amount: number;
    daysOverdue: number;
  }
) {
  const message = `⚠️ URGENTE: Sua cobrança venceu!\n\nValor: R$ ${(chargeData.amount / 100).toFixed(2)}\nDias Vencidos: ${chargeData.daysOverdue}\n\nEfetue o pagamento imediatamente.`;
  return sendWhatsApp(phoneNumber, message);
}

/**
 * Obtém status de uma mensagem
 */
export async function getMessageStatus(messageId: string) {
  try {
    const message = await client.messages(messageId).fetch();
    return {
      status: message.status,
      dateCreated: message.dateCreated,
      dateSent: message.dateSent,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
    };
  } catch (error) {
    console.error('Erro ao obter status da mensagem:', error);
    throw error;
  }
}

/**
 * Envia SMS em lote
 */
export async function sendBulkSMS(
  phoneNumbers: string[],
  message: string
) {
  const results = [];

  for (const phoneNumber of phoneNumbers) {
    try {
      const result = await sendSMS(phoneNumber, message);
      results.push({ phoneNumber, success: true, ...result });
    } catch (error) {
      results.push({ phoneNumber, success: false, error });
    }
  }

  return results;
}

/**
 * Envia WhatsApp em lote
 */
export async function sendBulkWhatsApp(
  phoneNumbers: string[],
  message: string
) {
  const results = [];

  for (const phoneNumber of phoneNumbers) {
    try {
      const result = await sendWhatsApp(phoneNumber, message);
      results.push({ phoneNumber, success: true, ...result });
    } catch (error) {
      results.push({ phoneNumber, success: false, error });
    }
  }

  return results;
}
