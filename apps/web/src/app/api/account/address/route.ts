import { NextResponse, after } from "next/server";
import { CURRENT_LOCATION } from "@/lib/chat";
import { setAccountAddress } from "@/lib/server/accounts";
import { flushAnalytics, track } from "@/lib/server/analytics";
import { DbError, dbConfigured } from "@/lib/server/db";
import { PlacesError, findAddress, placesConfigured } from "@/lib/server/places";
import { sessionFromRequest, sessionSecret } from "@/lib/server/session";

const json = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Records where Wally was told to look: a typed address or the device's own location. Never the place itself. */
function trackAddress(id: string, kind: "typed" | "current_location" | null) {
  track(id, kind ? "address_saved" : "address_cleared", { ...(kind ? { kind } : {}), $set: { has_address: Boolean(kind), address_kind: kind } });
  after(flushAnalytics);
}

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
  const body = (await request.json().catch(() => null)) as { address?: unknown; here?: { lat?: unknown; lng?: unknown }; refresh?: unknown } | null;
  // "Near my location": the device's own coordinates, saved in place of a typed address.
  if (body?.here) {
    const { lat, lng } = body.here;
    if (typeof lat !== "number" || typeof lng !== "number" || !(Math.abs(lat) <= 90) || !(Math.abs(lng) <= 180)) return json("invalid_input", 400);
    try {
      const account = await setAccountAddress(id, { address: CURRENT_LOCATION, point: { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 } });
      // The page looks the location up again on every arrival (`refresh`); only choosing it counts.
      if (account && body.refresh !== true) trackAddress(id, "current_location");
      return account ? NextResponse.json({ address: account.address }) : json("signed_out", 401);
    } catch (error) {
      if (error instanceof DbError) return json("unavailable", 503);
      throw error;
    }
  }
  const typed = typeof body?.address === "string" ? body.address.trim().replace(/\s+/g, " ") : "";
  if (typed.length < 3 || typed.length > 200) return json("invalid_input", 400);
  if (!placesConfigured()) return json("not_configured", 503);
  try {
    const found = await findAddress(typed);
    if (!found) return json("not_found", 422);
    const account = await setAccountAddress(id, found);
    if (account) trackAddress(id, "typed");
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
    if (!(await setAccountAddress(id, null))) return json("signed_out", 401);
    trackAddress(id, null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DbError) return json("unavailable", 503);
    throw error;
  }
}
