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
  /** Open for orders at the moment of the search, when the source says. */
  open?: boolean;
  distanceMiles?: number;
}

/** One thing on a menu, with the choices the diner must make to order it. Ids are the connector's and opaque. */
export interface MenuEntry {
  itemId: string;
  name: string;
  description: string;
  unitPrice: Cents;
  /** Can be ordered for pickup. Items that can't are never ticketed. */
  pickup: boolean;
  choices: MenuChoiceGroup[];
}

export interface MenuChoiceGroup {
  id: string;
  name: string;
  /** How many options must be picked from this group. */
  min: number;
  max: number;
  options: MenuChoiceOption[];
}

export interface MenuChoiceOption {
  id: string;
  name: string;
  price: Cents;
}

export interface CartItem {
  itemId: string;
  name: string;
  /** The size or version ordered ("Large"), when the venue names one. */
  variant?: string;
  quantity: number;
  unitPrice: Cents;
  /** Names of the chosen options, for the ticket. */
  modifiers?: string[];
  /** Ids of the chosen options, for the connector. */
  optionIds?: string[];
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
  /**
   * For a connector that hands the diner to the venue's own checkout instead
   * of placing the order itself: the page where they see this ticket again
   * and pay. Nothing is charged until they do, there.
   */
  handoffUrl?: string;
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
  /** Venues that take orders through this connector near a ZIP. `text` may be empty for "everything nearby". */
  search(query: { text: string; zip: string; limit?: number; radiusMiles?: number }): Promise<Venue[]>;
  /** Menu entries at a venue, or only those matching a few words when `query` is given. */
  menu(venueId: string, query?: string): Promise<MenuEntry[]>;
  /** Builds the cart at the venue and returns the ticket, with every figure from the venue's own system. */
  quote(venue: Venue, items: CartItem[], tip: Cents): Promise<Quote>;
  /** Called at most once per approved quote, with an idempotency key. */
  place(quote: Quote, idempotencyKey: string): Promise<PlaceResult>;
  track(orderId: string): Promise<OrderStatus>;
  cancel(orderId: string): Promise<{ cancelled: boolean; detail?: string }>;
}
