/**
 * Text-message verification through Twilio Verify. Twilio sends the
 * code from its own pre-approved numbers, so this works before Wally
 * has a phone line of his own.
 */

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "invalid_number" | "rate_limited" | "wrong_code" | "expired" | "provider_error" };

interface Config {
  accountSid: string;
  authToken: string;
  serviceSid: string;
}

function config(): Config | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  return accountSid && authToken && serviceSid ? { accountSid, authToken, serviceSid } : null;
}

/**
 * Local-only stand-in so the flow can be exercised without Twilio.
 * Never honoured on a Vercel production deployment.
 */
function devCode(): string | null {
  if (process.env.VERCEL_ENV === "production") return null;
  const code = process.env.WALLY_DEV_VERIFY_CODE;
  return code && /^\d{6}$/.test(code) ? code : null;
}

export function verifyConfigured(): boolean {
  return config() !== null || devCode() !== null;
}

async function twilio(cfg: Config, path: string, params: Record<string, string>) {
  return fetch(`https://verify.twilio.com/v2/Services/${cfg.serviceSid}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
    cache: "no-store",
  });
}

/** Sends a 6-digit code by text. `phone` is a 10-digit US number. */
export async function sendCode(phone: string): Promise<VerifyResult> {
  const cfg = config();
  if (!cfg) return devCode() ? { ok: true } : { ok: false, reason: "not_configured" };
  try {
    const res = await twilio(cfg, "Verifications", { To: `+1${phone}`, Channel: "sms" });
    if (res.ok) return { ok: true };
    if (res.status === 429) return { ok: false, reason: "rate_limited" };
    if (res.status === 400) return { ok: false, reason: "invalid_number" };
    return { ok: false, reason: "provider_error" };
  } catch {
    return { ok: false, reason: "provider_error" };
  }
}

export async function checkCode(phone: string, code: string): Promise<VerifyResult> {
  const cfg = config();
  if (!cfg) {
    const dev = devCode();
    if (!dev) return { ok: false, reason: "not_configured" };
    return code === dev ? { ok: true } : { ok: false, reason: "wrong_code" };
  }
  try {
    const res = await twilio(cfg, "VerificationCheck", { To: `+1${phone}`, Code: code });
    if (res.status === 404) return { ok: false, reason: "expired" };
    if (res.status === 429) return { ok: false, reason: "rate_limited" };
    if (!res.ok) return { ok: false, reason: "provider_error" };
    const data = (await res.json()) as { status?: string };
    return data.status === "approved" ? { ok: true } : { ok: false, reason: "wrong_code" };
  } catch {
    return { ok: false, reason: "provider_error" };
  }
}
