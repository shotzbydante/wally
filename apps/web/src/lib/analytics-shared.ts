/**
 * The few analytics facts the browser, the server and the build all need.
 * No PostHog code is loaded from here.
 *
 * PostHog serves one project from three addresses. NEXT_PUBLIC_POSTHOG_HOST
 * is the one events are sent to (https://us.i.posthog.com); the other two
 * follow from it. Anything that isn't PostHog Cloud is one address for all three.
 */
const CLOUD = /^(https:\/\/[a-z]+)\.i\.posthog\.com$/;
const tidy = (ingest: string) => ingest.trim().replace(/\/+$/, "");

/** Where the dashboard and the private API live: https://us.posthog.com. */
export const appHost = (ingest: string) => tidy(ingest).replace(CLOUD, "$1.posthog.com");

/** Where the browser script's extra pieces are served from: https://us-assets.i.posthog.com. */
export const assetsHost = (ingest: string) => tidy(ingest).replace(CLOUD, "$1-assets.i.posthog.com");

/**
 * The path on our own site that passes the browser's analytics traffic on to
 * PostHog (the rewrites in next.config.ts), so it is first-party and an ad
 * blocker doesn't drop it. Named for Wally's order pad, since blockers go by
 * names like /analytics. next.config.ts spells this out again: keep them the same.
 */
export const PROXY_PATH = "/pad";

/** The response header that carries a new sign-in's account id back to the sign-up page (see /api/verify/check). */
export const ACCOUNT_HEADER = "x-wally-account";
