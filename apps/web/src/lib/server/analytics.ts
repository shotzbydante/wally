import { randomUUID } from "node:crypto";
import { PostHog } from "posthog-node";
import { appHost } from "@/lib/analytics-shared";
import { isOwnSite, visibleChoices, type Choice } from "@/lib/chat";

/**
 * Product analytics, server side (PostHog). The browser half is
 * src/instrumentation-client.ts and src/lib/analytics.ts.
 *
 * A person is the account: every event carries the account id, the same id
 * the browser identifies with, so what someone does by text and on the
 * website lands on one person. Events about nobody in particular (a text from
 * an unknown number, a short link opened from a text) carry a throwaway id
 * and make no person.
 *
 * Nothing here may fail or slow the work it sits beside: `track` never
 * throws, and `flushAnalytics` gives up after a few seconds. Without the two
 * NEXT_PUBLIC_POSTHOG_* variables every call does nothing.
 *
 * What is never sent: emails, phone numbers, names, addresses, coordinates,
 * and Wally's answers. What the person asked is sent only when
 * WALLY_ANALYTICS_QUERIES=1 (see `queryText`).
 */
const TOKEN = "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN";
const HOST = "NEXT_PUBLIC_POSTHOG_HOST";
const env = (name: string) => process.env[name]?.trim() || null;

let shared: PostHog | null | undefined;

function client(): PostHog | null {
  if (shared !== undefined) return shared;
  const token = env(TOKEN);
  const host = env(HOST);
  if (!token || !host) {
    const missing = token ? HOST : TOKEN;
    // Said once, and not in production, where running without analytics is a choice.
    if (process.env.NODE_ENV !== "production" && !process.env.VITEST) {
      console.warn(`${missing} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missing} is configured`);
    }
    return (shared = null);
  }
  // A serverless function can be frozen as soon as it has answered, so nothing waits in a queue:
  // each event is sent as it is captured, and the routes wait for it with flushAnalytics.
  shared = new PostHog(token, { host, flushAt: 1, flushInterval: 0 });
  // Delivery failures arrive here. The name only: an analytics hiccup is never worth more.
  shared.on("error", (error: unknown) => console.warn("[analytics] not delivered:", error instanceof Error ? error.name : "unknown error"));
  return shared;
}

export const analyticsConfigured = () => client() !== null;

export type Properties = Record<string, unknown>;

/**
 * Records that something happened. `account` is the account id, or null for
 * an event about nobody in particular. `$set` and `$set_once` inside
 * `properties` update the person.
 */
export function track(account: string | null, event: string, properties: Properties = {}): void {
  try {
    client()?.capture({
      distinctId: account ?? randomUUID(),
      event,
      properties: { ...properties, ...(account ? {} : { $process_person_profile: false }) },
    });
  } catch {}
}

/** How long a route waits for events to be delivered before letting go. */
const FLUSH_MS = 3000;

/**
 * Waits for what `track` recorded to reach PostHog. Call it where the work
 * is already done: inside `after()` in a route, or at the end of a
 * background job. Never throws.
 */
export async function flushAnalytics(): Promise<void> {
  const ph = client();
  if (!ph) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([ph.flush(), new Promise((resolve) => (timer = setTimeout(resolve, FLUSH_MS)))]);
  } catch {
  } finally {
    clearTimeout(timer);
  }
}

/** How much of a message is kept as an example of what people ask. */
const QUERY_CHARS = 280;

/**
 * What the person asked, for the "what do people ask Wally" view. Their words
 * leave the database only when WALLY_ANALYTICS_QUERIES=1, and then only the
 * opening of the message. Its length is always recorded.
 */
export function queryText(text: string): Properties {
  const words = text.replace(/\s+/g, " ").trim();
  return { chars: words.length, ...(env("WALLY_ANALYTICS_QUERIES") === "1" ? { query: words.slice(0, QUERY_CHARS) } : {}) };
}

/** How a message reached Wally from the website: typed, or one of the taps that send words for the person. */
const VIA = ["typed", "starter", "card", "order", "more", "fast_food", "closed", "discover"] as const;
export const viaOf = (value: unknown): (typeof VIA)[number] => VIA.find((v) => v === value) ?? "typed";

/** The shape of Wally's answer, in counts. Never what it said. */
export function answerShape(choices: Choice[] | null): Properties {
  const shown = visibleChoices(choices);
  const places = shown.filter((c) => c.place);
  const ticket = shown.find((c) => c.ticket)?.ticket;
  return {
    answer: ticket ? "ticket" : places.length ? "places" : shown.length ? "options" : "words",
    cards: shown.length,
    place_cards: places.length,
    orderable_cards: places.filter((c) => c.place!.orders).length,
    own_site_cards: places.filter((c) => isOwnSite(c.place!.website)).length,
    chain_cards: places.filter((c) => c.place!.chain).length,
    menu_carried: Boolean(choices?.some((c) => c.menu)),
    ...(ticket ? { ticket_total_cents: ticket.total, ticket_quantity: ticket.quantity } : {}),
  };
}

/**
 * True when a link is being fetched to draw its preview bubble, not tapped.
 * Messages and the other chat apps fetch every link they show, announcing
 * themselves as a crawler; those opens would swamp the real ones.
 */
export const isPreview = (request: Request) => /bot|crawl|spider|preview|facebookexternalhit|slurp|whatsapp|telegram/i.test(request.headers.get("user-agent") ?? "");

/**
 * Erases what PostHog holds about an account: the person and every event
 * recorded for it. Needs POSTHOG_PERSONAL_API_KEY (a personal key with the
 * person:write scope) and POSTHOG_PROJECT_ID; the project token can only
 * write events, never delete them. False if it wasn't asked for or didn't go
 * through, which is logged, never thrown: the account itself is already gone.
 */
export async function forgetPerson(account: string): Promise<boolean> {
  const key = env("POSTHOG_PERSONAL_API_KEY");
  const project = env("POSTHOG_PROJECT_ID");
  const host = env(HOST);
  if (!key || !project || !host) {
    if (analyticsConfigured()) console.warn("[analytics] an erased account's events were kept: POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID aren't set");
    return false;
  }
  try {
    // Anything still on its way must land first, or it would outlive the deletion.
    await flushAnalytics();
    const res = await fetch(`${appHost(host)}/api/projects/${encodeURIComponent(project)}/persons/bulk_delete/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ distinct_ids: [account], delete_events: true, delete_recordings: true }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error(`[analytics] erase ${res.status}`);
    return res.ok;
  } catch (cause) {
    console.error("[analytics] erase: no response", cause instanceof Error ? cause.name : "");
    return false;
  }
}
