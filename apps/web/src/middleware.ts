import { NextRequest, NextResponse } from "next/server";

const ROOT_DOMAIN = process.env.APP_ROOT_DOMAIN ?? "ekulmis.local";

/**
 * Resolves the tenant subdomain from the Host header and forwards it as
 * `x-tenant-subdomain` so server components and API calls can scope to the
 * tenant. Per-tenant branding is loaded from this subdomain (Phase 1 Settings).
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const subdomain = extractSubdomain(host);

  const headers = new Headers(req.headers);
  if (subdomain) {
    headers.set("x-tenant-subdomain", subdomain);
  }
  return NextResponse.next({ request: { headers } });
}

function extractSubdomain(host: string): string | null {
  if (!host || host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) {
    return null;
  }
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    return host.slice(0, host.length - ROOT_DOMAIN.length - 1);
  }
  // localhost / preview hosts: no subdomain
  return null;
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
