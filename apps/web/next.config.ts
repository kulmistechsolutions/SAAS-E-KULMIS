import type { NextConfig } from "next";

/**
 * Security headers for the school app.
 *
 * The API has carried helmet's headers since it was built; the web app sent
 * none of them, and announced its framework in X-Powered-By. The one that
 * mattered is the missing frame policy: without it any site could load a
 * school's own pages inside a hidden iframe and collect clicks from a head
 * teacher who believes they are clicking something else. The rest close the
 * first-visit downgrade to http, stop a browser guessing a response's type,
 * and keep a school's own URLs — which carry student and payment ids — out of
 * the Referer header sent to anywhere they link.
 *
 * No Content-Security-Policy yet: this app inlines styles and scripts that a
 * useful policy would have to allow anyway, so a policy written today would be
 * permissive enough to be theatre. It belongs in its own change, tested.
 */
const SECURITY_HEADERS = [
  // A year, and every subdomain: every school is one.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Nothing in the app asks for any of these. Left open, a script that got
    // in could.
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for small Docker images (Coolify/VPS deploys).
  output: "standalone",
  // Consume the shared workspace package's TS source directly.
  transpilePackages: ["@ekulmis/shared"],
  // Naming the framework and its version helps nobody but an attacker.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  experimental: {
    // Type-safe env / server actions defaults are fine; extend as needed.
  },
};

export default nextConfig;
