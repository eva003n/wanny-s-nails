/**
 * Phone number utilities for WhatsApp and M-Pesa integration.
 * Kenya numbers are normalized to E.164 format (+2547...).
 */

/**
 * Normalize a Kenyan phone number to E.164 format.
 *
 * Accepts:
 *   - "0712345678"   → "254712345678"
 *   - "+254712345678" → "254712345678"
 *   - "254712345678"  → "254712345678"
 *   - "712345678"     → "254712345678"
 *   - "07 123 45678"  → "254712345678"
 *
 * Returns the input if already valid, throws if invalid.
 */
export function normalizeKenyanPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");

  if (digits.length === 9 && digits.startsWith("7")) {
    return `254${digits}`;
  }

  if (digits.length === 10 && digits.startsWith("07")) {
    return `254${digits.slice(1)}`;
  }

  if (digits.length === 12 && digits.startsWith("254")) {
    return `${digits}`;
  }

  if (raw.startsWith("+") && digits.length === 12 && digits.startsWith("254")) {
    return digits;
  }

  throw new Error(
    `Invalid Kenyan phone number: "${raw}". Expected format: 07XXXXXXXX, 2547XXXXXXXX, or +2547XXXXXXXX`,
  );
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

export function maskKenyanPhone(phone: string) {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length < 9) return phone; // Invalid number
  
  // Extract the trailing 9 digits (handles 2547... or 07...)
  const lastNine = digits.slice(-9);
  const countryCode = digits.slice(0, -9);
  
  // Mask the middle digits and show the last 2
  const masked = lastNine.slice(0, 3) + '***' + lastNine.slice(6);
  
  return countryCode && countryCode !== "0" ? `+${countryCode}${masked}` : `0${masked}`;
}
