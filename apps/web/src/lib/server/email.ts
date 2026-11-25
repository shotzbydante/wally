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

/**
 * Emails a sign-in link. `linking` means the link will add this address to an
 * already signed-in account, so the email says that: it must open in the
 * browser that asked for it, and anyone who didn't ask should ignore it.
 */
export async function sendSignInLink(email: string, link: string, linking = false): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return devLinks() ? { ok: true, devLink: link } : { ok: false, reason: "not_configured" };
  const message = signInEmail(link, linking, siteOrigin());
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email], ...message }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? { ok: true } : { ok: false, reason: "provider_error" };
  } catch {
    return { ok: false, reason: "provider_error" };
  }
}

/** Where the email's images and links live: the public site, never a preview's address. */
export function siteOrigin(): string {
  const app = process.env.APP_URL?.trim().replace(/\/+$/, "");
  return app && /^https:\/\//.test(app) ? app : "https://www.wallywaiter.com";
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * The sign-in email, in brand identity 2.1 (see "Emails" in CLAUDE.md): the
 * stacked badge on the cool canvas, one white card, a midnight headline,
 * slate body copy and one emerald pill button, with a plain-text part that
 * says the same thing. Transactional, so the words stay neutral and exact.
 */
export function signInEmail(link: string, linking: boolean, origin: string): { subject: string; text: string; html: string } {
  const subject = linking ? "Add this email to your Wally account" : "Your Wally sign-in link";
  const heading = linking ? "Add this email to your account" : "Sign in to Wally";
  const what = linking
    ? `Open this link in the browser where you're signed in to Wally to add this email address to that account. It works for ${EMAIL_LINK_MINUTES} minutes.`
    : `Open this link to sign in to Wally. It works for ${EMAIL_LINK_MINUTES} minutes.`;
  const button = linking ? "Add this email" : "Sign in to Wally";
  const ignore = "If you didn't ask for this, you can ignore this email.";
  const text = `${what}\n\n${link}\n\n${ignore}`;

  const font = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const href = escapeHtml(link);
  const site = escapeHtml(origin);
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F4F6FA;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(what)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F6FA;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
<tr><td align="center" style="padding:0 0 20px;"><a href="${site}" style="text-decoration:none;"><img src="${site}/brand/wally-badge-email.png" width="168" height="129" alt="Wally the Waiter" style="display:block;border:0;width:168px;height:auto;"></a></td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #DCE3E8;border-radius:20px;padding:32px;font-family:${font};">
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:#151B2C;">${escapeHtml(heading)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.55;color:#535C6C;">${escapeHtml(what)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:999px;background:#0E7C57;"><a href="${href}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#0E7C57;color:#FFFFFF;font-family:${font};font-size:16px;font-weight:700;text-decoration:none;">${escapeHtml(button)}</a></td></tr></table>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#535C6C;">Or paste this link into your browser:<br><a href="${href}" style="color:#0A6B4B;word-break:break-all;">${href}</a></p>
</td></tr>
<tr><td align="center" style="padding:20px 8px 0;font-family:${font};font-size:13px;line-height:1.5;color:#535C6C;">${escapeHtml(ignore)}<br>Wally is an AI waiter. <a href="${site}" style="color:#535C6C;">wallywaiter.com</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { subject, text, html };
}
