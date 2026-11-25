import posthog from "posthog-js";
import { PROXY_PATH, appHost } from "@/lib/analytics-shared";

/**
 * Starts product analytics (PostHog) in the browser, once, before the page
 * becomes interactive. Page views, taps and web vitals are recorded from here
 * on; src/lib/analytics.ts holds the few events sent by hand.
 *
 * Session replay is off on purpose: the pages it would film show the
 * conversation and a home address. Turn it on only with those masked.
 */
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (token && host) {
  try {
    posthog.init(token, {
      // Through our own site, so the traffic is first-party (see PROXY_PATH).
      api_host: PROXY_PATH,
      ui_host: appHost(host),
      defaults: "2026-08-30",
      disable_session_recording: true,
    });
  } catch {}
} else if (process.env.NODE_ENV === "development") {
  const missing = token ? "NEXT_PUBLIC_POSTHOG_HOST" : "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN";
  // Loud in development, silent in production, and never a thrown error: the app runs fine without analytics.
  console.error(`${missing} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missing} is configured`);
}
