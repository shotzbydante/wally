import { NextResponse, after } from "next/server";
import { signIn } from "@/lib/server/accounts";
import { ACCOUNT_HEADER } from "@/lib/analytics-shared";
import { flushAnalytics } from "@/lib/server/analytics";
import { sessionSecret } from "@/lib/server/session";
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

  const res = NextResponse.json({ ok: true });
  // "link" comes from the account page: add this number to the signed-in account.
  const signedIn = await signIn(res, request, input, secret, { link: body?.link === true, typed: true, method: "phone" });
  if (!signedIn) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  // The sign-up page reads this to tell analytics who the visitor turned out to be. It is their own account's id.
  if (signedIn.id) res.headers.set(ACCOUNT_HEADER, signedIn.id);
  after(flushAnalytics);
  return res;
}
