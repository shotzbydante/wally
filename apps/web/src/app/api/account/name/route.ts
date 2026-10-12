import { NextResponse } from "next/server";
import { cleanFirstName } from "@/lib/signup";
import { setAccountName } from "@/lib/server/accounts";
import { DbError, dbConfigured } from "@/lib/server/db";
import { sessionFromRequest, sessionSecret, setSession } from "@/lib/server/session";

export async function POST(request: Request) {
  const secret = sessionSecret();
  const session = secret ? sessionFromRequest(request, secret) : null;
  if (!secret || !session) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? cleanFirstName(body.name) : "";
  if (!name || name.length > 60 || !/^[\p{L}][\p{L}\p{M}' .-]*$/u.test(name)) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  if (!dbConfigured()) {
    const res = NextResponse.json({ ok: true, name });
    setSession(res, session, { name }, secret);
    return res;
  }
  if (!session.id) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  try {
    const account = await setAccountName(session.id, name);
    if (!account) return NextResponse.json({ error: "signed_out" }, { status: 401 });
    return NextResponse.json({ ok: true, name: account.name });
  } catch (error) {
    if (error instanceof DbError) return NextResponse.json({ error: "unavailable" }, { status: 503 });
    throw error;
  }
}
