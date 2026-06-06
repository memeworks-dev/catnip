import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TODO (next phases):
  //  - images.remotePatterns: allow the R2 / signed-URL host for next/image (§13)
  //  - wrap with withSentryConfig(...) once Sentry is fully wired (§12, see lib/sentry)
  //  - CORS headers for embeds: toys render in third-party iframes, the dashboard
  //    does not (§13)
};

export default nextConfig;
