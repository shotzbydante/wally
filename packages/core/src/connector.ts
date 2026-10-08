/**
 * The connector layer: one internal interface, implemented per source
 * (aggregator API, deep link, phone call, partner endpoint, ...).
 * Every integration is provisional, so nothing outside a connector may
 * depend on a specific provider. See docs/PRD.md, "Architecture".
 */

export type Cents = number;

export type ConnectorKind =
  | "aggregator"
  | "partner_api"
  | "account_link"
  | "deep_link"
  | "phone_call"
  | "browser";

export interface Venue {
  id: string;
  name: string;
  address?: string;
  photoUrl?: string;
  etaMinutes?: number;
}

export interface CartItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: Cents;
  modifiers?: string[];
  notes?: string;
}

/** The "ticket": everything the user must see before approving (OR-3). */
export interface Quote {
  id: string;
  connectorId: string;
  venue: Venue;
  items: CartItem[];
  subtotal: Cents;
  deliveryFee: Cents;
  serviceFee: Cents;
  tax: Cents;
  tip: Cents;
  total: Cents;
  etaMinutes?: number;
  paymentLast4?: string;
  /** Cancellation / deposit terms, shown verbatim (RS-3). */
  terms?: string;
  /** ISO timestamp; after this the quote must be re-issued (OR-5). */
  expiresAt: string;
}

export type PlaceResult =
  | { status: "confirmed"; orderId: string }
  | { status: "handoff"; url: string }
  /** Never retried automatically; goes to status check + human (OR-6). */
  | { status: "unknown"; reason: string }
  | { status: "failed"; reason: string };

export interface OrderStatus {
  orderId: string;
  state: "placed" | "preparing" | "en_route" | "delivered" | "cancelled" | "problem";
  detail?: string;
}

export interface OrderingConnector {
  readonly id: string;
  readonly kind: ConnectorKind;
  search(query: { text: string; zip: string }): Promise<Venue[]>;
  menu(venueId: string): Promise<CartItem[]>;
  quote(venueId: string, items: CartItem[], tip: Cents): Promise<Quote>;
  /** Called at most once per approved quote, with an idempotency key. */
  place(quote: Quote, idempotencyKey: string): Promise<PlaceResult>;
  track(orderId: string): Promise<OrderStatus>;
  cancel(orderId: string): Promise<{ cancelled: boolean; detail?: string }>;
}
