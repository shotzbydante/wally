import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed session cookie. Until there is a database, the session itself
 * carries the sign-up details, so an account exists only on the device
 * that verified.
 */
export const SESSION_COOKIE = "wally_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface Session {
  name: string;
  /** 10-digit US number. */
  phone: string;
  zip: string;
  suggestions: boolean;
  /** Unix seconds. */
  verifiedAt: number;
  exp: number;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64url");

export function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

export function encodeSession(session: Session, secret: string): string {
  const body = b64(JSON.stringify(session));
  return `${body}.${sign(body, secret)}`;
}

export function decodeSession(token: string | undefined, secret: string, now = Date.now()): Session | null {
  if (!token) return null;
  const [body, mac, extra] = token.split(".");
  if (!body || !mac || extra !== undefined) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    if (typeof session.exp !== "number" || session.exp * 1000 <= now) return null;
    return session;
  } catch {
    return null;
  }
}
