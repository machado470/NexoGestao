export function normalizeEmail(v?: string): string | null {
  const s = (v ?? '').trim().toLowerCase();
  return s ? s : null;
}

export function normalizePhone(v?: string): string {
  const digits = (v ?? '').replace(/\D/g, '').trim();
  return digits;
}
