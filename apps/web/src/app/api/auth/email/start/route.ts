import { NextResponse } from "next/server";
import { EMAIL_LINK_MINUTES, emailConfigured, isEmail, sendSignInLink } from "@/lib/server/email";
import { EMAIL_LIMITS, allowed, clientIp } from "@/lib/server/rate-limit";
import { appOrigin, sessionFromRequest, sessionSecret, signToken } from "@/lib/server/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown; link?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isEmail(email)) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  const secret = sessionSecret();
  if (!secret || !emailConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  // Every email costs money, so cap how many one address, and one caller, can ask for.
  const ok = await allowed("email", [
    { who: `email:${email}`, limit: EMAIL_LIMITS.perTarget },
    { who: `ip:${clientIp(request)}`, limit: EMAIL_LIMITS.perIp },
  ]);
  if (!ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const exp = Math.floor(Date.now() / 1000) + EMAIL_LINK_MINUTES * 60;
  // From the account page: the link adds this email to the signed-in account,
  // whichever browser it is opened in.
  const linkTo = body?.link === true ? sessionFromRequest(request, secret)?.id : undefined;
  const token = signToken("email-link", { email, exp, ...(linkTo ? { link: linkTo } : {}) }, secret);
  const link = `${appOrigin(request)}/api/auth/email/callback?token=${encodeURIComponent(token)}`;
  const result = await sendSignInLink(email, link, Boolean(linkTo));
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.reason === "not_configured" ? 503 : 502 });
  return NextResponse.json({ ok: true, ...(result.devLink ? { devLink: result.devLink } : {}) });
}
