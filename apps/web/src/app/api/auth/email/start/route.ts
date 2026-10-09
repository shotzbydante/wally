import { NextResponse } from "next/server";
import { EMAIL_LINK_MINUTES, emailConfigured, isEmail, sendSignInLink } from "@/lib/server/email";
import { appOrigin, sessionSecret, signToken } from "@/lib/server/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isEmail(email)) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  const secret = sessionSecret();
  if (!secret || !emailConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const exp = Math.floor(Date.now() / 1000) + EMAIL_LINK_MINUTES * 60;
  const token = signToken("email-link", { email, exp }, secret);
  const link = `${appOrigin(request)}/api/auth/email/callback?token=${encodeURIComponent(token)}`;
  const result = await sendSignInLink(email, link);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.reason === "not_configured" ? 503 : 502 });
  return NextResponse.json({ ok: true, ...(result.devLink ? { devLink: result.devLink } : {}) });
}
