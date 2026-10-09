import { NextResponse } from "next/server";
import { sessionSecret } from "@/lib/server/session";
import { parseSignup } from "@/lib/server/signup-input";
import { sendCode, verifyConfigured } from "@/lib/server/verify";

export async function POST(request: Request) {
  const input = parseSignup(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (!verifyConfigured() || !sessionSecret()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const result = await sendCode(input.phone);
  if (result.ok) return NextResponse.json({ ok: true });
  const status = result.reason === "rate_limited" ? 429 : result.reason === "invalid_number" ? 400 : 502;
  return NextResponse.json({ error: result.reason }, { status });
}
