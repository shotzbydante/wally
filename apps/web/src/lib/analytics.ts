import posthog from "posthog-js";

/**
 * Product analytics in the browser (PostHog). It is started once, in
 * src/instrumentation-client.ts; the server half is src/lib/server/analytics.ts.
 *
 * Page views and taps are recorded by the script itself. The calls here are
 * for the things it can't see for itself: who is signed in, which step of
 * sign-up someone reached, and what a tapped link led to.
 *
 * Every call does nothing when the two NEXT_PUBLIC_POSTHOG_* variables aren't
 * set, and none can throw: analytics never gets in the way of the page.
 * Never pass an email, phone number, name or address through here.
 */
export const analyticsOn = Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST);

export function capture(event: string, properties?: Record<string, unknown>): void {
  if (!analyticsOn) return;
  try {
    posthog.capture(event, properties);
  } catch {}
}

/** Ties this browser to the signed-in account, by its id: the same id the server records events under. */
export function identify(account: string, traits: Record<string, boolean>): void {
  if (!analyticsOn) return;
  try {
    posthog.identify(account, traits);
  } catch {}
}

/** Signing out, or erasing the account: the next person to use this browser starts as a stranger. */
export function forget(): void {
  if (!analyticsOn) return;
  try {
    posthog.reset();
  } catch {}
}

/** A page that broke in someone's browser. */
export function reportError(error: unknown): void {
  if (!analyticsOn) return;
  try {
    posthog.captureException(error);
  } catch {}
}

/** How a message reached Wally: typed, or one of the taps that send words for the person. The server keeps the same list (`viaOf`). */
export type Via = "typed" | "starter" | "card" | "order" | "more" | "fast_food" | "closed";
