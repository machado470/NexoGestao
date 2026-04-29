export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = String(phone).replace(/\D/g, '')
  if (!digits) return null

  let normalizedDigits = digits
  if (normalizedDigits.startsWith('00')) normalizedDigits = normalizedDigits.slice(2)

  if (normalizedDigits.startsWith('55')) {
    const brNumber = normalizedDigits.slice(2)
    if (brNumber.length === 10 || brNumber.length === 11) return `+55${brNumber}`
    return `+${normalizedDigits}`
  }

  if (normalizedDigits.length === 10 || normalizedDigits.length === 11) {
    return `+55${normalizedDigits}`
  }

  return `+${normalizedDigits}`
}
