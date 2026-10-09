/**
 * Sign-in links by email, sent through Resend.
 */
export type EmailResult = { ok: true; devLink?: string } | { ok: false; reason: "not_configured" | "provider_error" };

export const EMAIL_LINK_MINUTES = 15;

export function isEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** Local-only: hand the link back instead of emailing it. Never in Vercel production. */
function devLinks(): boolean {
  return process.env.VERCEL_ENV !== "production" && process.env.WALLY_DEV_EMAIL_LINKS === "1";
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) || devLinks();
}

export async function sendSignInLink(email: string, link: string): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return devLinks() ? { ok: true, devLink: link } : { ok: false, reason: "not_configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your Wally sign-in link",
        text: `Open this link to sign in to Wally. It works for ${EMAIL_LINK_MINUTES} minutes.\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
      }),
      cache: "no-store",
    });
    return res.ok ? { ok: true } : { ok: false, reason: "provider_error" };
  } catch {
    return { ok: false, reason: "provider_error" };
  }
}
