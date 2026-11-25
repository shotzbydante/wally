import type { NextConfig } from "next";

// Product analytics (PostHog). The browser sends its events to /pad on our own site and these
// rewrites pass them on, so the traffic is first-party and ad blockers don't drop it. The path
// and the two addresses must match PROXY_PATH, appHost and assetsHost in src/lib/analytics-shared.ts.
// Without NEXT_PUBLIC_POSTHOG_HOST there is nothing to pass on to, and the browser sends nothing.
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim().replace(/\/+$/, "");
const posthogAssets = posthogHost?.replace(/^(https:\/\/[a-z]+)\.i\.posthog\.com$/, "$1-assets.i.posthog.com");

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ["@wally/core"],
  cacheComponents: true,
  partialPrefetching: true,
  // PostHog's addresses end in a slash (/pad/e/); without this Next redirects each one first.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    if (!posthogHost) return [];
    // The two specific rules must come before the catch-all.
    return [
      { source: "/pad/static/:path*", destination: `${posthogAssets}/static/:path*` },
      { source: "/pad/array/:path*", destination: `${posthogAssets}/array/:path*` },
      { source: "/pad/:path*", destination: `${posthogHost}/:path*` },
    ];
  },
  experimental: {
    // A build restored from Vercel's cache once shipped stale styles.
    // Builds are quick, so always compile from scratch.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
