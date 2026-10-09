import { NextResponse } from "next/server";
import { sessionFromRequest, sessionSecret, setSession } from "@/lib/server/session";
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
  setSession(res, sessionFromRequest(request, secret), input, secret);
  return res;
}
