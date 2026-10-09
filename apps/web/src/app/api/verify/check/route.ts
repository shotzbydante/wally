import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, encodeSession, sessionSecret } from "@/lib/server/session";
import { parseSignup } from "@/lib/server/signup-input";
import { checkCode } from "@/lib/server/verify";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const input = parseSignup(body);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!input || !/^\d{6}$/.test(code)) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const secret = sessionSecret();
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const result = await checkCode(input.phone, code);
  if (!result.ok) {
    const status =
      result.reason === "not_configured" ? 503 : result.reason === "rate_limited" ? 429 : result.reason === "provider_error" ? 502 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = encodeSession({ ...input, verifiedAt: now, exp: now + SESSION_MAX_AGE_SECONDS }, secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
