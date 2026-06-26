/**
 * Phone number utilities for WhatsApp and M-Pesa integration.
 * Kenya numbers are normalized to E.164 format (+2547...).
 */

/**
 * Normalize a Kenyan phone number to E.164 format.
 *
 * Accepts:
 *   - "0712345678"   → "+254712345678"
 *   - "+254712345678" → "+254712345678"
 *   - "254712345678"  → "+254712345678"
 *   - "712345678"     → "+254712345678"
 *   - "07 123 45678"  → "+254712345678"
 *
 * Returns the input if already valid, throws if invalid.
 */
export function normalizeKenyanPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");

  if (digits.length === 9 && digits.startsWith("7")) {
    return `+254${digits}`;
  }

  if (digits.length === 10 && digits.startsWith("07")) {
    return `+254${digits.slice(1)}`;
  }

  if (digits.length === 12 && digits.startsWith("254")) {
    return `+${digits}`;
  }

  if (raw.startsWith("+") && digits.length === 12 && digits.startsWith("254")) {
    return raw;
  }

  throw new Error(
    `Invalid Kenyan phone number: "${raw}". Expected format: 07XXXXXXXX, 2547XXXXXXXX, or +2547XXXXXXXX`,
  );
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}