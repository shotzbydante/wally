import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

/**
 * Signed cookies. With a database (see accounts.ts) the session carries only
 * the account id. Without one it carries the profile itself, so the account
 * exists only in the browser that signed in.
 */
export const SESSION_COOKIE = "wally_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface Session {
  /** Account id in the database. Absent when the profile lives in the cookie. */
  id?: string;
  name: string;
  /** Verified email, from an email link or Google. */
  email?: string;
  /** True when the email was confirmed by Google sign-in. */
  google?: boolean;
  /** Verified 10-digit US number. */
  phone?: string;
  zip?: string;
  suggestions?: boolean;
  /** Unix seconds. */
  exp: number;
}

const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64url");

export function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

/**
 * Signs any payload with an expiry. `typ` keeps one kind of token from
 * being accepted as another (a sign-in link is not a session).
 */
export function signToken<T extends { exp: number }>(typ: string, payload: T, secret: string): string {
  const body = Buffer.from(JSON.stringify({ ...payload, typ }), "utf8").toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function readToken<T extends { exp: number }>(
  typ: string,
  token: string | undefined | null,
  secret: string,
  now = Date.now(),
): T | null {
  if (!token) return null;
  const [body, mac, extra] = token.split(".");
  if (!body || !mac || extra !== undefined) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { typ?: string };
    if (data.typ !== typ || typeof data.exp !== "number" || data.exp * 1000 <= now) return null;
    const { typ: _typ, ...payload } = data;
    void _typ;
    return payload as unknown as T;
  } catch {
    return null;
  }
}

export const encodeSession = (session: Session, secret: string) => signToken("session", session, secret);
export const decodeSession = (token: string | undefined, secret: string, now?: number) =>
  readToken<Session>("session", token, secret, now);

const newExpiry = () => Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;

function writeCookie(res: NextResponse, session: Session, secret: string): void {
  res.cookies.set(SESSION_COOKIE, encodeSession(session, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Signs the browser in to an account in the database. */
export function startSession(res: NextResponse, id: string, secret: string): void {
  writeCookie(res, { id, name: "", exp: newExpiry() }, secret);
}

/** No database: merges new details into the profile kept in the cookie. */
export function setSession(res: NextResponse, current: Session | null, update: Partial<Session>, secret: string): void {
  const next: Session = { name: "", ...current, ...update, exp: newExpiry() };
  // Keep an existing name unless the update supplies a real one.
  if (!update.name && current?.name) next.name = current.name;
  writeCookie(res, next, secret);
}

/** Reads the session from a request's Cookie header. */
export function sessionFromRequest(request: Request, secret: string): Session | null {
  const header = request.headers.get("cookie") ?? "";
  const match = header.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return decodeSession(match?.slice(SESSION_COOKIE.length + 1), secret);
}

/** Public origin for links we email or hand to Google. */
export function appOrigin(request: Request): string {
  return (process.env.APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
}
