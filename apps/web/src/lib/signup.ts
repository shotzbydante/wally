/** Sign-up field validation and formatting (PRD ON-1). */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Normalizes a US mobile number to 10 digits, or null if it isn't one. */
export function normalizeUsPhone(value: string): string | null {
  let d = digitsOnly(value);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length !== 10) return null;
  // Area codes and exchanges never start with 0 or 1.
  if (/^[01]/.test(d) || /^[01]/.test(d.slice(3))) return null;
  return d;
}

/** Formats as-you-type: (310) 555-0142 */
export function formatUsPhone(value: string): string {
  let d = digitsOnly(value);
  if (d.length > 10 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function isZip(value: string): boolean {
  return /^\d{5}$/.test(value.trim());
}

export function cleanFirstName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function isFirstName(value: string): boolean {
  const name = cleanFirstName(value);
  return name.length >= 1 && name.length <= 40 && /^[\p{L}][\p{L}\p{M}' .-]*$/u.test(name);
}

/** Deep link that opens the user's messaging app with the first text pre-filled. */
export function firstTextLink(wallyNumber: string, body = "Hi Wally"): string {
  return `sms:${wallyNumber}?&body=${encodeURIComponent(body)}`;
}
