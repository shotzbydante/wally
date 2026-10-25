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
 * This is the first connector. It stays provider-specific in here; nothing
 * outside this file knows MealMe's shapes (rule 7).
 */
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

const cents = (p: { amount?: number; amountCents?: number } | undefined) => p?.amountCents ?? p?.amount ?? 0;

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
  return (data.items ?? [])
    .filter((i) => i.providerItemId && i.title && i.raw?.unitToken && i.raw.menuItemVariationId)
    .map((i) => ({
      id: i.providerItemId,
      name: i.title.trim(),
      description: (i.description ?? "").trim().slice(0, 300),
      cents: cents(i.price),
      unitToken: i.raw!.unitToken!,
      variationId: i.raw!.menuItemVariationId!,
      variationName: i.raw!.variations?.find((v) => v.id === i.raw!.menuItemVariationId)?.name ?? "",
      required: (i.raw!.requiredModifierLists ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        min: l.minSelection ?? 1,
        max: l.maxSelection ?? 1,
        options: (l.options ?? []).map((o) => ({ id: o.id, name: o.name, cents: cents(o.price) })),
      })),
      pickup: (i.fulfillment ?? []).includes("PICKUP"),
    }));
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
  const subtotal = sq.subtotal?.amountCents ?? 0;
  const total = sq.total?.amountCents ?? subtotal;
  const tax = (sq.summaryLines ?? []).filter((s) => s.type === "SALES_TAX").reduce((sum, s) => sum + (s.amount?.amountCents ?? 0), 0);
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

/** Words in a name that don't tell one place from another. */
const FILLER = new Set(["the", "and", "los", "angeles", "restaurant", "cafe", "kitchen", "bar", "grill", "inc", "llc"]);
const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !FILLER.has(w));

/** Loose match between a name a person used and a store's listed name. */
export function nameMatches(wanted: string, listed: string): boolean {
  const a = words(wanted);
  const b = words(listed);
  return a.length > 0 && a.every((w) => b.some((x) => x.startsWith(w) || w.startsWith(x)));
}

/**
 * Whether a place found elsewhere (name and street address) is one of these
 * stores. Names must match loosely both ways, and the street numbers must
 * agree when both are known, so two branches of a chain aren't confused.
 */
export function sameStore(place: { name: string; address: string }, store: Store): boolean {
  const number = (s: string) => /^\s*(\d+)/.exec(s)?.[1];
  const n1 = number(place.address);
  const n2 = number(store.address);
  if (n1 && n2 && n1 !== n2) return false;
  return nameMatches(place.name, store.name) || nameMatches(store.name, place.name);
}

/** The ZIP in a saved address, if it has one. */
export function zipOf(address: string | null | undefined): string | undefined {
  return /\b(\d{5})(?:-\d{4})?\b(?!.*\b\d{5}\b)/.exec(address ?? "")?.[1];
}
