import { Injectable, NestMiddleware, NotFoundException } from "@nestjs/common";
import type { NextFunction, Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import type { TenantRequest } from "./tenant-request";

/**
 * Resolves the current tenant (school) for every request and attaches it as
 * `req.tenant`. Resolution order:
 *   1. `x-tenant-subdomain` header (used in dev / by the web app middleware)
 *   2. the Host subdomain, e.g. `iskuul1.ekulmis.local` -> `iskuul1`
 *   3. a `?tenant=` query param — browser `<img>`/`<link>` tags can't send
 *      custom headers, so public asset routes (e.g. the school logo) pass
 *      the tenant this way instead.
 *
 * The `schools` table has no RLS, so this lookup runs on the normal connection.
 * If a subdomain is present but unknown, the request is rejected. If no
 * subdomain is present (apex domain), the request continues tenant-less and
 * tenant-scoped routes will reject it via `@CurrentTenant()`.
 */
/**
 * Hostnames under the root domain that belong to the platform itself, never to
 * a school. A school can't take one of these as its subdomain either.
 */
const RESERVED_SUBDOMAINS = new Set([
  "api",
  "www",
  "admin",
  "platform",
  "app",
  "static",
  "cdn",
  "mail",
]);

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly rootDomain = process.env.APP_ROOT_DOMAIN ?? "ekulmis.local";

  constructor(private readonly prisma: PrismaService) {}

  async use(
    req: TenantRequest,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const subdomain = this.extractSubdomain(req);
    if (!subdomain) {
      next();
      return;
    }

    const school = await this.prisma.school.findUnique({
      where: { subdomain },
      select: { id: true, subdomain: true, status: true },
    });

    if (!school) {
      throw new NotFoundException(`Unknown tenant: ${subdomain}`);
    }

    req.tenant = { schoolId: school.id, subdomain: school.subdomain };
    next();
  }

  private extractSubdomain(req: TenantRequest): string | null {
    const headerSub = req.headers["x-tenant-subdomain"];
    if (typeof headerSub === "string" && headerSub.trim()) {
      return headerSub.trim().toLowerCase();
    }

    // Explicit `?tenant=` wins over the host. Browser `<img>`/`<link>` tags
    // can't send the tenant header, so the school logo is loaded from
    // `api.<root>/settings/logo?tenant=<school>`. That host's subdomain is the
    // reserved `api`, so it must be checked BEFORE the host — otherwise the
    // reserved-host rule below returns null and the explicit tenant is lost
    // ("No tenant resolved", 400, blank logo).
    const querySub = req.query?.tenant;
    if (typeof querySub === "string" && querySub.trim()) {
      return querySub.trim().toLowerCase();
    }

    const host = (req.headers.host ?? "").split(":")[0].toLowerCase();
    if (host && host !== this.rootDomain && host !== `www.${this.rootDomain}`) {
      if (host.endsWith(`.${this.rootDomain}`)) {
        const sub = host.slice(0, host.length - this.rootDomain.length - 1);
        // The API is itself served from a subdomain of the root domain
        // (api.example.com). Treating that as a school makes every request
        // without an explicit tenant header 404 as "Unknown tenant: api" —
        // which is exactly what broke the platform login. Infrastructure
        // hostnames are never tenants.
        return RESERVED_SUBDOMAINS.has(sub) ? null : sub;
      }
    }

    return null;
  }
}
