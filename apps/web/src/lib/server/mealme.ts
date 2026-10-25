/**
 * Ordering through MealMe's self-serve API (mealmeai.vercel.app): menus and
 * carts at restaurants that take orders through Square, ending in a Square
 * (Cash App) checkout page where the person pays the restaurant directly.
 *
 * Wally does everything up to that page: finds the place, searches its menu,
 * picks the options and builds the cart. The person pays on the restaurant's
 * own checkout, so no card or charge passes through Wally (rules 2 and 6).
 *
 * MealMe's terms: a key must stay on the server; every successful call is
 * billed (about ten cents). One checkout carries one dish, with its options
 * and a quantity, which is all this API accepts today.
 *
 * This is the first connector. `mealmeConnector` is the OrderingConnector
 * the agent sees (through src/lib/server/ordering.ts); the functions below
 * it are MealMe's own shapes and stay in this file (rule 7).
 */
import type { MenuEntry, OrderingConnector, Quote, Venue } from "@wally/core";

const BASE = () => process.env.MEALME_API_BASE?.trim().replace(/\/+$/, "") || "https://mealmeai.vercel.app";

export const mealmeConfigured = () => Boolean(process.env.MEALME_API_KEY?.trim());

export class MealMeError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Store {
  /** MealMe's id for the location, passed back when searching its menu. */
  id: string;
  name: string;
  address: string;
  miles?: number;
  open?: boolean;
}

export interface ModifierOption {
  id: string;
  name: string;
  cents: number;
}

export interface ModifierList {
  id: string;
  name: string;
  min: number;
  max: number;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  cents: number;
  /** Square needs these three back at checkout, exactly as given. */
  unitToken: string;
  variationId: string;
  variationName: string;
  /** Choices the person has to make, like a base or a protein. */
  required: ModifierList[];
  pickup: boolean;
}

/** The ticket: what the person sees before they go to pay (OR-3). Every figure is Square's. */
export interface Ticket {
  restaurant: string;
  address: string;
  item: string;
  variation: string;
  modifiers: string[];
  quantity: number;
  /** All in cents. */
  subtotal: number;
  tax: number;
  total: number;
  /** Where the person pays: the restaurant's Square (Cash App) checkout. */
  checkoutUrl: string;
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const key = process.env.MEALME_API_KEY?.trim();
  if (!key) throw new MealMeError(0, "not configured");
  let res: Response;
  try {
    res = await fetch(`${BASE()}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${key}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch (cause) {
    console.error("[mealme] no response", cause instanceof Error ? cause.name : "");
    throw new MealMeError(0, "no response");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {}
  if (!res.ok) {
    // MealMe sometimes answers with an object under message; keep it a string so the error stays a MealMeError.
    const raw = (data as { message?: unknown } | null)?.message;
    const message = typeof raw === "string" ? raw : raw ? JSON.stringify(raw) : `${res.status}`;
    // Status and MealMe's own message: enough to diagnose, nothing from the conversation.
    console.error(`[mealme] ${path.split("?")[0]} ${res.status} ${message.slice(0, 200)}`);
    throw new MealMeError(res.status, message);
  }
  return data as T;
}

/**
 * A price in cents. MealMe sends either amountCents or amount (also cents, as
 * seen in its answers: 1549 for $15.49). No price at all means free, which is
 * how options come; a price in neither form is unreadable, and null.
 */
const cents = (p: { amount?: number; amountCents?: number } | undefined): number | null => {
  if (p === undefined) return 0;
  const n = typeof p.amountCents === "number" ? p.amountCents : typeof p.amount === "number" ? p.amount : null;
  return n !== null && Number.isInteger(n) && n >= 0 ? n : null;
};

/**
 * Restaurants that take orders through Square, near a ZIP code. MealMe's
 * server fails (500) on a wide search, so a big ask steps down to a smaller
 * one rather than coming back empty.
 */
export async function searchStores(zip: string, limit = 10, radius = 6): Promise<Store[]> {
  try {
    return await storesPage(zip, limit, radius);
  } catch (error) {
    if (!(error instanceof MealMeError) || error.status < 500 || limit <= 20) throw error;
    return searchStores(zip, Math.max(20, Math.floor(limit / 2)), Math.min(radius, 6));
  }
}

async function storesPage(zip: string, limit: number, radius: number): Promise<Store[]> {
  const q = new URLSearchParams({ providerId: "square", merchantType: "restaurant", zipCode: zip, radiusInMiles: String(radius), limit: String(limit) });
  const data = await call<{ stores?: { providerLocationId: string; name: string; address?: string; raw?: { distanceMiles?: number; isOpen?: boolean } }[] }>(`/api/stores/search?${q}`);
  return (data.stores ?? []).map((s) => ({
    id: s.providerLocationId,
    name: s.name.trim(),
    address: s.address ?? "",
    ...(typeof s.raw?.distanceMiles === "number" ? { miles: Math.round(s.raw.distanceMiles * 10) / 10 } : {}),
    ...(typeof s.raw?.isOpen === "boolean" ? { open: s.raw.isOpen } : {}),
  }));
}

/** Menu items at a store that match a few words. */
export async function searchMenu(storeId: string, query: string, limit = 8): Promise<MenuItem[]> {
  const q = new URLSearchParams({ providerId: "square", locationId: storeId, query, limit: String(limit) });
  interface RawItem {
    providerItemId: string;
    title: string;
    description?: string;
    price?: { amount?: number; amountCents?: number };
    fulfillment?: string[];
    raw?: {
      unitToken?: string;
      menuItemVariationId?: string;
      variations?: { id: string; name: string }[];
      requiredModifierLists?: { id: string; name: string; minSelection?: number; maxSelection?: number; options?: { id: string; name: string; price?: { amount?: number; amountCents?: number } }[] }[];
    };
  }
  const data = await call<{ items?: RawItem[] }>(`/api/catalog/search?${q}`);
  const items: MenuItem[] = [];
  for (const i of data.items ?? []) {
    if (!i.providerItemId || !i.title || !i.raw?.unitToken || !i.raw.menuItemVariationId) continue;
    // An item whose price, or any option's price, can't be read is left out: a ticket must never show a guessed figure.
    const price = cents(i.price);
    const required = (i.raw.requiredModifierLists ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      min: l.minSelection ?? 1,
      max: l.maxSelection ?? 1,
      options: (l.options ?? []).map((o) => ({ id: o.id, name: o.name, cents: cents(o.price) })),
    }));
    if (price === null || required.some((l) => l.options.some((o) => o.cents === null))) continue;
    items.push({
      id: i.providerItemId,
      name: i.title.trim(),
      description: (i.description ?? "").trim().slice(0, 300),
      cents: price,
      unitToken: i.raw.unitToken,
      variationId: i.raw.menuItemVariationId,
      variationName: i.raw.variations?.find((v) => v.id === i.raw!.menuItemVariationId)?.name ?? "",
      required: required.map((l) => ({ ...l, options: l.options.map((o) => ({ ...o, cents: o.cents! })) })),
      pickup: (i.fulfillment ?? []).includes("PICKUP"),
    });
  }
  return items;
}

/**
 * Builds the cart on Square and returns the ticket with its checkout page.
 * `customer` is a stable id for the person on our side; MealMe keeps carts
 * per customer. Nothing is charged here.
 */
export async function checkout(store: Store, item: MenuItem, modifierIds: string[], quantity: number, customer: string): Promise<Ticket> {
  const cart = await call<{ cartId?: string }>("/api/carts", { providerId: "square", externalCustomerId: customer, locationId: store.id });
  if (!cart.cartId) throw new MealMeError(0, "no cart");
  const modifiers = modifierIds.map((modifierId) => ({ modifierId, quantity: 1 }));
  await call(`/api/carts/${cart.cartId}/items`, { providerItemId: item.id, quantity, externalCustomerId: customer, modifiers });
  interface Line {
    menuItemName?: string;
    menuItemVariationName?: string;
    selection?: { quantity?: number; modifier?: { name?: string }[] };
  }
  const out = await call<{ checkoutUrl?: string; square?: { cart?: { lines?: Line[]; subtotal?: { amountCents?: number }; total?: { amountCents?: number }; summaryLines?: { type?: string; amount?: { amountCents?: number } }[] } } }>(
    `/api/carts/${cart.cartId}/checkout`,
    { unitToken: item.unitToken, menuItemId: item.id, menuItemVariationId: item.variationId, modifiers, quantity },
  );
  const sq = out.square?.cart;
  const line = sq?.lines?.[0];
  if (!out.checkoutUrl || !sq || !line) throw new MealMeError(0, "no checkout");
  // Every figure must be the restaurant's own and add up; a ticket is never shown with a guessed or missing total.
  const subtotal = sq.subtotal?.amountCents;
  const total = sq.total?.amountCents;
  const tax = (sq.summaryLines ?? []).filter((s) => s.type === "SALES_TAX").reduce((sum, s) => sum + (s.amount?.amountCents ?? 0), 0);
  if (typeof subtotal !== "number" || typeof total !== "number" || subtotal <= 0 || total < subtotal + tax) throw new MealMeError(0, "bad totals");
  return {
    restaurant: store.name,
    address: store.address,
    item: line.menuItemName ?? item.name,
    variation: line.menuItemVariationName ?? item.variationName,
    modifiers: (line.selection?.modifier ?? []).map((m) => m.name ?? "").filter(Boolean),
    quantity: line.selection?.quantity ?? quantity,
    subtotal,
    tax,
    total,
    checkoutUrl: out.checkoutUrl,
  };
}

/** How long a built cart is trusted before it must be built again (OR-5). */
const QUOTE_MINUTES = 15;

/**
 * The item id the agent and the thread carry: MealMe's item id and the two
 * Square tokens checkout needs, so a menu read in one turn can be ordered in a
 * later one without reading it again. Opaque outside this file.
 */
const packItemId = (i: Pick<MenuItem, "id" | "unitToken" | "variationId">) => `${i.id}|${i.unitToken}|${i.variationId}`;
function unpackItemId(packed: string): Pick<MenuItem, "id" | "unitToken" | "variationId"> | null {
  const [id, unitToken, variationId] = packed.split("|");
  return id && unitToken && variationId ? { id, unitToken, variationId } : null;
}

const venueOf = (store: Store): Venue => ({ id: store.id, name: store.name, address: store.address, ...(store.open !== undefined ? { open: store.open } : {}), ...(store.miles !== undefined ? { distanceMiles: store.miles } : {}) });

/**
 * MealMe as an OrderingConnector, for one diner (`customer` is the account
 * id, which MealMe keeps carts by). It hands off: the quote is a cart on the
 * restaurant's Square, and `place` only returns the checkout page.
 */
export function mealmeConnector(customer: string): OrderingConnector {
  return {
    id: "mealme",
    kind: "aggregator",
    async search({ text, zip, limit, radiusMiles }) {
      // MealMe's store search has no text filter; the agent matches names itself. The words are kept for a connector that can use them.
      void text;
      const stores = await searchStores(zip, limit ?? 10, radiusMiles ?? 6);
      return stores.map(venueOf);
    },
    async menu(venueId, query) {
      const items = await searchMenu(venueId, query ?? "", 8);
      return items.map(
        (i): MenuEntry => ({
          itemId: packItemId(i),
          name: i.variationName && i.variationName !== "Regular" ? `${i.name} (${i.variationName})` : i.name,
          description: i.description,
          unitPrice: i.cents,
          pickup: i.pickup,
          choices: i.required.map((l) => ({ id: l.id, name: l.name, min: l.min, max: l.max, options: l.options.map((o) => ({ id: o.id, name: o.name, price: o.cents })) })),
        }),
      );
    },
    async quote(venue, items, tip) {
      // One dish per checkout: MealMe's Square checkout takes a single item spec and ignores extra cart items.
      const [first] = items;
      const ids = first && unpackItemId(first.itemId);
      if (!first || !ids) throw new MealMeError(0, "no item");
      const store: Store = { id: venue.id, name: venue.name, address: venue.address ?? "" };
      const item: MenuItem = { ...ids, name: first.name, description: "", cents: first.unitPrice, variationName: first.variant ?? "", required: [], pickup: true };
      const ticket = await checkout(store, item, first.optionIds ?? [], first.quantity, customer);
      return {
        id: ticket.checkoutUrl,
        connectorId: "mealme",
        venue,
        items: [{ itemId: first.itemId, name: ticket.item, variant: ticket.variation, quantity: ticket.quantity, unitPrice: first.unitPrice, modifiers: ticket.modifiers }],
        subtotal: ticket.subtotal,
        deliveryFee: 0,
        serviceFee: 0,
        tax: ticket.tax,
        tip,
        total: ticket.total,
        expiresAt: new Date(Date.now() + QUOTE_MINUTES * 60_000).toISOString(),
        handoffUrl: ticket.checkoutUrl,
      } satisfies Quote;
    },
    async place(quote) {
      return quote.handoffUrl ? { status: "handoff", url: quote.handoffUrl } : { status: "failed", reason: "no checkout page" };
    },
    async track(orderId) {
      return { orderId, state: "problem", detail: "Paid on the restaurant's own checkout; not tracked here." };
    },
    async cancel() {
      return { cancelled: false, detail: "Cancel with the restaurant." };
    },
  };
}
