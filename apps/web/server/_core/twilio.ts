// Stub de Twilio pra compilar sem dependency/config.

export type SmsInput = {
  to: string;
  message: string;
};

export async function sendSms(_input: SmsInput) {
  return {
    ok: false,
    reason: "TWILIO_NOT_CONFIGURED"
  };
}

export async function sendBulkSms(_inputs: SmsInput[]) {
  return {
    ok: false,
    reason: "TWILIO_NOT_CONFIGURED",
    results: [] as Array<{ phoneNumber: string; success: boolean; error?: string }>
  };
}
