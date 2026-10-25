import { createHash } from "node:crypto";
import { DbError, dbConfigured, rpc } from "./db";

/**
 * Rate limits for what costs money before anyone is signed in: a
 * verification text (Twilio) or a sign-in email (Resend). Without a limit,
 * anyone can run up the bill by posting numbers or addresses in a loop
 * ("SMS pumping").
 *
 * Counts live in the database (wally_rate_hit) so they hold across serverless
 * instances. Keys are hashed, so no phone, email or IP is stored.
 */
export interface Limit {
  /** Hits allowed per window. */
  hits: number;
  /** Window length in seconds. */
  seconds: number;
}

/** Who is asking, from Vercel's header. Empty when there isn't one (local dev). */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

const keyOf = (scope: string, who: string) => createHash("sha256").update(`${scope}:${who}`).digest("hex");

/**
 * Counts a hit and says whether it is allowed. Every rule must pass.
 * Fails open: if the database is unconfigured, missing the function or not
 * answering, the request goes through and the problem is logged, since the
 * endpoint itself doesn't need the database.
 */
export async function allowed(scope: string, rules: Array<{ who: string; limit: Limit }>): Promise<boolean> {
  if (!dbConfigured()) return true;
  try {
    for (const { who, limit } of rules) {
      if (!who) continue;
      const ok = await rpc<boolean>("wally_rate_hit", { p_key: keyOf(scope, who), p_limit: limit.hits, p_window: `${limit.seconds} seconds` });
      if (!ok) return false;
    }
    return true;
  } catch (error) {
    if (error instanceof DbError) {
      console.error(`[rate-limit] ${scope}: not enforced (${error.message})`);
      return true;
    }
    throw error;
  }
}

/** Verification texts: a few per number, more per address, over an hour. */
export const VERIFY_LIMITS = { perTarget: { hits: 3, seconds: 3600 }, perIp: { hits: 10, seconds: 3600 } } as const;
/** Sign-in emails: likewise. */
export const EMAIL_LIMITS = { perTarget: { hits: 3, seconds: 3600 }, perIp: { hits: 10, seconds: 3600 } } as const;
