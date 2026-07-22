import { NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";

/**
 * Per-tenant web app manifest. Each school installs an app badged with *their*
 * name — the subdomain in the request Host is resolved to the tenant and the
 * public branding endpoint gives the school name. Icons are bundled (so the
 * install prompt always has valid images) and the theme matches the app.
 *
 * Served dynamically (not a static file) precisely so one deployment can badge
 * every school's installed app differently.
 */
export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN ?? "ekulmis.local";

/** `nuurulhidaaya.ekulmis.com` -> `nuurulhidaaya`; apex/www -> null. */
function subdomainFromHost(host: string | null): string | null {
  if (!host) return null;
  const h = host.split(":")[0].toLowerCase();
  if (h === ROOT_DOMAIN || h === `www.${ROOT_DOMAIN}`) return null;
  if (h.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = h.slice(0, h.length - ROOT_DOMAIN.length - 1);
    return sub && sub !== "www" ? sub : null;
  }
  return null;
}

async function schoolName(host: string | null): Promise<string | null> {
  const sub = subdomainFromHost(host);
  if (!sub) return null;
  try {
    const res = await fetch(`${API_URL}/api/settings/branding`, {
      headers: { "x-tenant-subdomain": sub },
      // Short-lived cache so a rename shows up without hammering the API.
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string };
    return typeof data.name === "string" && data.name.trim() ? data.name : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const host = request.headers.get("host");
  const name = (await schoolName(host)) ?? BRAND.name;

  const manifest = {
    name: `${name} — School`,
    short_name: name.length > 12 ? name.slice(0, 12) : name,
    description: `${name} · ${BRAND.tagline}`,
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300",
    },
  });
}
