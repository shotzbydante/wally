import { cleanFirstName, isFirstName, isZip, normalizeUsPhone } from "@/lib/signup";

export interface SignupInput {
  name: string;
  phone: string;
  zip: string;
  suggestions: boolean;
}

/** Validates the sign-up fields from an untrusted request body. */
export function parseSignup(body: unknown): SignupInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string" || typeof b.phone !== "string" || typeof b.zip !== "string") return null;
  const phone = normalizeUsPhone(b.phone);
  if (!phone || !isFirstName(b.name) || !isZip(b.zip)) return null;
  return { name: cleanFirstName(b.name), phone, zip: b.zip.trim(), suggestions: b.suggestions === true };
}
