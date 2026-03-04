// Stub de SendGrid pra compilar sem dependency/config.
// Quando você for ligar de verdade, troca isso por integração real.

export type SendEmailInput = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

export async function sendEmail(_input: SendEmailInput) {
  return {
    ok: false,
    reason: "SENDGRID_NOT_CONFIGURED"
  };
}

export async function sendBulkEmail(_inputs: SendEmailInput[]) {
  return {
    ok: false,
    reason: "SENDGRID_NOT_CONFIGURED",
    results: [] as Array<{ email: string; success: boolean; error?: string }>
  };
}
