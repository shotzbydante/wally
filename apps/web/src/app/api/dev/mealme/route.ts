import { timingSafeEqual } from "node:crypto";

/**
 * TEMPORARY. Answers why a named Square restaurant isn't found by the store
 * search, by running a few searches and lookups against MealMe and reporting
 * shapes and counts (never the conversation, never a key). Guarded by
 * WALLY_PROBE_TOKEN; without it this route answers 404. Remove this file and
 * the variable when the question is answered.
 */
const BASE = "https://mealmeai.vercel.app";

export async function GET(request: Request) {
  const token = process.env.WALLY_PROBE_TOKEN?.trim();
  const key = process.env.MEALME_API_KEY?.trim();
  const url = new URL(request.url);
  const given = Buffer.from(url.searchParams.get("token") ?? "");
  if (!token || given.length !== token.length || !timingSafeEqual(given, Buffer.from(token))) return new Response("Not found", { status: 404 });
  if (!key) return Response.json({ probe: "no key" });

  const call = async (path: string) => {
    const started = Date.now();
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(25_000) });
    const text = await res.text();
    let json: unknown = text.slice(0, 600);
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, ms: Date.now() - started, body: json };
  };
  type Store = { providerLocationId?: string; name?: string; address?: string; raw?: { distanceMiles?: number; isOpen?: boolean } };
  const summarize = (r: { status: number; ms: number; body: unknown }, want: RegExp) => {
    const stores = ((r.body as { stores?: Store[] })?.stores ?? []) as Store[];
    const names = stores.map((s) => `${s.name} · ${s.address} · ${s.raw?.distanceMiles?.toFixed(1) ?? "?"}mi`);
    return { status: r.status, ms: r.ms, count: stores.length, matches: names.filter((n) => want.test(n)), farthest: stores.at(-1)?.raw?.distanceMiles, names: names.slice(0, 120), ...(r.status >= 400 ? { error: r.body } : {}) };
  };

  const zip = url.searchParams.get("zip") ?? "90036";
  const want = new RegExp(url.searchParams.get("want") ?? "neighborhood", "i");
  const step = url.searchParams.get("step") ?? "stores";
  const out: Record<string, unknown> = { zip, want: want.source };
  try {
    if (step === "stores") {
      const base = (limit: number, radius: number, extra = "") => `/api/stores/search?providerId=square&merchantType=restaurant&zipCode=${zip}&radiusInMiles=${radius}&limit=${limit}${extra}`;
      out.wide80r8 = summarize(await call(base(80, 8)), want);
      out.mid40r6 = summarize(await call(base(40, 6)), want);
      out.small20r6 = summarize(await call(base(20, 6)), want);
      out.near60r2 = summarize(await call(base(60, 2)), want);
      out.near100r1 = summarize(await call(base(100, 1)), want);
      out.query = summarize(await call(base(20, 6, "&query=Neighborhood")), want);
      out.search = summarize(await call(base(20, 6, "&search=Neighborhood")), want);
      out.name = summarize(await call(base(20, 6, "&name=Neighborhood")), want);
      out.noType = summarize(await call(`/api/stores/search?providerId=square&zipCode=${zip}&radiusInMiles=2&limit=60`), want);
    } else if (step === "catalog") {
      const id = (brandName: string, address: string) => `cashapp_${Buffer.from(JSON.stringify({ brandName, address })).toString("base64").replace(/=+$/, "")}`;
      const tries = (url.searchParams.get("tries") ?? "Neighborhood|133 S La Brea Ave").split(";;").map((t) => t.split("|") as unknown as readonly [string, string]);
      out.catalog = await Promise.all(
        tries.map(async ([b, a]) => {
          const r = await call(`/api/catalog/search?providerId=square&locationId=${encodeURIComponent(id(b, a))}&query=${encodeURIComponent(url.searchParams.get("q") ?? "iced coffee")}&limit=5`);
          const items = (r.body as { items?: { title?: string }[] })?.items ?? [];
          return { brandName: b, address: a, status: r.status, ms: r.ms, items: items.length, first: items[0]?.title, ...(r.status >= 400 ? { error: r.body } : {}) };
        }),
      );
      // The shape of a real id, for comparison.
      const r = await call(`/api/stores/search?providerId=square&merchantType=restaurant&zipCode=${zip}&radiusInMiles=1&limit=3`);
      out.sample = ((r.body as { stores?: Store[] })?.stores ?? []).map((s) => ({ id: s.providerLocationId, decoded: (() => { try { return Buffer.from((s.providerLocationId ?? "").replace(/^cashapp_/, ""), "base64").toString(); } catch { return ""; } })(), name: s.name, address: s.address }));
    }
  } catch (error) {
    out.error = error instanceof Error ? `${error.name}: ${error.message}` : "unknown";
  }
  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
