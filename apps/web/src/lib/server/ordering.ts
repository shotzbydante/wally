/**
 * Ordering, as the agent sees it: one OrderingConnector (rule 7), the policy
 * gate every hand-off passes (rule 1), and the name matching that ties a
 * venue to a place found elsewhere. Nothing in here knows a provider's
 * shapes; those live in the connector's own file.
 */
import { canHandOff, type Decision, type OrderingConnector, type Quote, type Venue } from "@wally/core";
import { MealMeError, mealmeConfigured, mealmeConnector } from "./mealme";

export const orderingConfigured = () => mealmeConfigured();

/** The connector for one diner (`customer` is the account id), or null when none is configured. */
export function orderingConnector(customer: string): OrderingConnector | null {
  return mealmeConfigured() ? mealmeConnector(customer) : null;
}

/** An error a connector raised about its source (not answering, refusing, figures that don't add up): told to the model plainly. Anything else is a bug and is thrown. */
export const isConnectorError = (error: unknown): boolean => error instanceof MealMeError;

/** The kill switch (AP-5): set WALLY_ORDERING_PAUSED=1 and no ticket is handed off. */
export const orderingPaused = () => process.env.WALLY_ORDERING_PAUSED?.trim() === "1";

/**
 * Whether a quote may be handed to the diner to pay. The quote existing means
 * the venue's checkout answered, so it is healthy; the gate still applies the
 * kill switch and the quote's age. Policy is code: the model never sees this.
 */
export const mayHandOff = (quote: Quote, now = new Date()): Decision => canHandOff({ quote, paused: orderingPaused(), checkoutHealthy: true, now });

/** Words in a name that don't tell one place from another. */
const FILLER = new Set(["the", "and", "los", "angeles", "restaurant", "cafe", "kitchen", "bar", "grill", "inc", "llc"]);
const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !FILLER.has(w));

/** Loose match between a name a person used and a venue's listed name. */
export function nameMatches(wanted: string, listed: string): boolean {
  const a = words(wanted);
  const b = words(listed);
  return a.length > 0 && a.every((w) => b.some((x) => x.startsWith(w) || w.startsWith(x)));
}

/**
 * Whether a place found elsewhere (name and street address) is this venue.
 * Names must match loosely both ways, and the street numbers must agree when
 * both are known, so two branches of a chain aren't confused.
 */
export function sameStore(place: { name: string; address: string }, venue: Pick<Venue, "name" | "address">): boolean {
  const number = (s: string) => /^\s*(\d+)/.exec(s)?.[1];
  const n1 = number(place.address);
  const n2 = number(venue.address ?? "");
  if (n1 && n2 && n1 !== n2) return false;
  return nameMatches(place.name, venue.name) || nameMatches(venue.name, place.name);
}

/** The ZIP in a saved address, if it has one. */
export { zipIn as zipOf } from "./places";
