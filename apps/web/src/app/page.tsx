import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { LandingPage } from "@/components/landing/landing-page";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN ?? "ekulmis.local";

function hasTenantSubdomain(host: string): boolean {
  const bare = host.split(":")[0].toLowerCase();
  if (!bare || bare === ROOT_DOMAIN || bare === `www.${ROOT_DOMAIN}`) return false;
  return bare.endsWith(`.${ROOT_DOMAIN}`);
}

/** Root path: schools land on their own subdomain's login; the bare root
 *  domain has no tenant, so it shows the public overview page instead. */
export default async function Home() {
  const host = (await headers()).get("host") ?? "";
  if (hasTenantSubdomain(host)) {
    const preview = process.env.NEXT_PUBLIC_PREVIEW_AUTH === "true";
    redirect(preview ? "/dashboard" : "/login");
  }

  return <LandingPage rootDomain={ROOT_DOMAIN} />;
}
