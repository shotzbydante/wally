import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ["@wally/core"],
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // A build restored from Vercel's cache once shipped stale styles.
    // Builds are quick, so always compile from scratch.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
