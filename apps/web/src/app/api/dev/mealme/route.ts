import { timingSafeEqual } from "node:crypto";

/**
 * TEMPORARY. Runs a fixed sequence against MealMe (cart, item, checkout)
 * so the real response shapes can be seen while the connector is built.
 * Guarded by WALLY_PROBE_TOKEN; without it this route answers 404.
 * Remove this file and the variable once the connector is in.
 */
const BASE = "https://mealmeai.vercel.app";
const POKE = "cashapp_eyJicmFuZE5hbWUiOiJQb2tlIEJhciBMb3MgQW5nZWxlcyIsImFkZHJlc3MiOiI1MjczIFcgT2x5bXBpYyBCbHZkIn0";

export async function GET(request: Request) {
  const token = process.env.WALLY_PROBE_TOKEN?.trim();
  const key = process.env.MEALME_API_KEY?.trim();
  const url = new URL(request.url);
  const given = Buffer.from(url.searchParams.get("token") ?? "");
  if (!token || given.length !== token.length || !timingSafeEqual(given, Buffer.from(token))) return new Response("Not found", { status: 404 });
  if (!key) return Response.json({ probe: "no key" });

  const call = async (path: string, body?: unknown) => {
    const res = await fetch(`${BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${key}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    const text = await res.text();
    let json: unknown = text;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, body: json };
  };

  const step = url.searchParams.get("step") ?? "cart";
  const out: Record<string, unknown> = {};
  try {
    if (step === "cart") {
      const cart = await call("/api/carts", { providerId: "square", externalCustomerId: "probe-2", locationId: POKE });
      out.cart = cart;
      const cartId = (cart.body as { cartId?: string })?.cartId;
      if (!cartId) return Response.json(out);
      const mods = ["CALIM_CAESGEdYMklaTUs1VktQVzRTT0dVSEtLWkE3Uw", "CALIM_CAESGDQ3NlFFQkwzS0ZZSjUzTVhIQ1VUUVpZVA", "CALIM_CAESGFdGVjJOSEM2WUxJM0s1UFNZVkpPVjI2Sw"];
      out.item = await call(`/api/carts/${cartId}/items`, {
        providerItemId: "CALI_CAESGE1VSlNLUzZMNVdWRE9aUkpaVkFJM0tCRw",
        quantity: 1,
        externalCustomerId: "probe-2",
        modifiers: mods.map((modifierId) => ({ modifierId, quantity: 1 })),
      });
      out.get = await call(`/api/carts/${cartId}`);
      out.checkout = await call(`/api/carts/${cartId}/checkout`, {
        unitToken: "LCSHCZHWTZPCC",
        menuItemId: "CALI_CAESGE1VSlNLUzZMNVdWRE9aUkpaVkFJM0tCRw",
        menuItemVariationId: "CALIV_CAESGFQyN1RSWkhJRE5HNEtIUUhBRTdZNTVEVQ",
        modifiers: mods.map((modifierId) => ({ modifierId, quantity: 1 })),
        quantity: 1,
      });
    } else if (step === "two") {
      const cart = await call("/api/carts", { providerId: "square", externalCustomerId: "probe-3", locationId: POKE });
      const cartId = (cart.body as { cartId?: string })?.cartId;
      if (!cartId) return Response.json({ cart });
      const mods = ["CALIM_CAESGEdYMklaTUs1VktQVzRTT0dVSEtLWkE3Uw", "CALIM_CAESGDQ3NlFFQkwzS0ZZSjUzTVhIQ1VUUVpZVA", "CALIM_CAESGFdGVjJOSEM2WUxJM0s1UFNZVkpPVjI2Sw"].map((modifierId) => ({ modifierId, quantity: 1 }));
      out.a = await call(`/api/carts/${cartId}/items`, { providerItemId: "CALI_CAESGE1VSlNLUzZMNVdWRE9aUkpaVkFJM0tCRw", quantity: 1, externalCustomerId: "probe-3", modifiers: mods });
      out.b = await call(`/api/carts/${cartId}/items`, { providerItemId: "CALI_CAESGE1VSlNLUzZMNVdWRE9aUkpaVkFJM0tCRw", quantity: 2, externalCustomerId: "probe-3", modifiers: mods });
      // Checkout with an items array, and without a body, to see which the API honours.
      out.checkoutItems = await call(`/api/carts/${cartId}/checkout`, { items: [{ unitToken: "LCSHCZHWTZPCC", menuItemId: "CALI_CAESGE1VSlNLUzZMNVdWRE9aUkpaVkFJM0tCRw", menuItemVariationId: "CALIV_CAESGFQyN1RSWkhJRE5HNEtIUUhBRTdZNTVEVQ", modifiers: mods, quantity: 1 }, { unitToken: "LCSHCZHWTZPCC", menuItemId: "CALI_CAESGFRHUzJRV01RRlFCQTNMSE5OUTNJWEhXRw", menuItemVariationId: "CALIV_CAESGFNPT1lOUTNLRFJWVTNVU0xFTERaWUFYSA", modifiers: mods, quantity: 1 }] });
      out.checkoutEmpty = await call(`/api/carts/${cartId}/checkout`, {});
    } else if (step === "list") {
      out.list = await call("/api/carts?externalCustomerId=probe-2");
    }
  } catch (error) {
    out.error = error instanceof Error ? error.name : "unknown";
  }
  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
