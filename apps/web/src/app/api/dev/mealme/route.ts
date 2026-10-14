import { timingSafeEqual } from "node:crypto";

/**
 * TEMPORARY. Passes one request through to MealMe so its real response
 * shapes can be seen while the connector is built. Guarded by
 * WALLY_PROBE_TOKEN; without that variable it doesn't exist. Remove this
 * file and the variable once the connector is in.
 */
export async function GET(request: Request) {
  const token = process.env.WALLY_PROBE_TOKEN?.trim();
  const key = process.env.MEALME_API_KEY?.trim();
  const url = new URL(request.url);
  const given = Buffer.from(url.searchParams.get("token") ?? "");
  if (!token || given.length !== token.length || !timingSafeEqual(given, Buffer.from(token))) return new Response("Not found", { status: 404 });
  if (!key) return Response.json({ probe: "MEALME_API_KEY is not set in this deployment" });

  // Short names for long ids, so test addresses stay short.
  const short: Record<string, string> = { poke: "cashapp_eyJicmFuZE5hbWUiOiJQb2tlIEJhciBMb3MgQW5nZWxlcyIsImFkZHJlc3MiOiI1MjczIFcgT2x5bXBpYyBCbHZkIn0" };
  const path = (url.searchParams.get("path") ?? "").replace(/\{(\w+)\}/g, (m, k: string) => short[k] ?? m);
  if (!path.startsWith("/api/")) return Response.json({ probe: "path must start with /api/" }, { status: 400 });
  const body = url.searchParams.get("body");
  const max = Number(url.searchParams.get("max")) || 7000;
  try {
    const res = await fetch(`https://mealmeai.vercel.app${path}`, {
      method: body === null ? "GET" : "POST",
      headers: { Authorization: `Bearer ${key}`, ...(body === null ? {} : { "Content-Type": "application/json" }) },
      ...(body === null ? {} : { body: body.replace(/\{(\w+)\}/g, (m, k: string) => short[k] ?? m) }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    return Response.json({ status: res.status, length: text.length, body: text.slice(0, max) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ probe: "no response", error: error instanceof Error ? error.name : "unknown" });
  }
}
