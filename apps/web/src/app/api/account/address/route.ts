import { NextResponse } from "next/server";
import { setAccountAddress } from "@/lib/server/accounts";
import { DbError, dbConfigured } from "@/lib/server/db";
import { PlacesError, findAddress, placesConfigured } from "@/lib/server/places";
import { sessionFromRequest, sessionSecret } from "@/lib/server/session";

const json = (error: string, status: number) => NextResponse.json({ error }, { status });

function accountId(request: Request): string | null {
  const secret = sessionSecret();
  const session = secret && dbConfigured() ? sessionFromRequest(request, secret) : null;
  return session?.id ?? null;
}

/** Saves the address Wally searches near. The typed address is looked up and stored as found. */
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) return json("invalid_input", 400);
  const id = accountId(request);
  if (!id) return json("signed_out", 401);
  const body = (await request.json().catch(() => null)) as { address?: unknown } | null;
  const typed = typeof body?.address === "string" ? body.address.trim().replace(/\s+/g, " ") : "";
  if (typed.length < 3 || typed.length > 200) return json("invalid_input", 400);
  if (!placesConfigured()) return json("not_configured", 503);
  try {
    const found = await findAddress(typed);
    if (!found) return json("not_found", 422);
    const account = await setAccountAddress(id, found);
    return account ? NextResponse.json({ address: account.address }) : json("signed_out", 401);
  } catch (error) {
    if (error instanceof PlacesError) return json("lookup_failed", 502);
    if (error instanceof DbError) return json("unavailable", 503);
    throw error;
  }
}

/** Removes the saved address. */
export async function DELETE(request: Request) {
  const id = accountId(request);
  if (!id) return json("signed_out", 401);
  try {
    return (await setAccountAddress(id, null)) ? NextResponse.json({ ok: true }) : json("signed_out", 401);
  } catch (error) {
    if (error instanceof DbError) return json("unavailable", 503);
    throw error;
  }
}
