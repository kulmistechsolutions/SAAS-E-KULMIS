import {
  Injectable,
  NestMiddleware,
  NotFoundException,
} from "@nestjs/common";
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
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly rootDomain =
    process.env.APP_ROOT_DOMAIN ?? "ekulmis.local";

  constructor(private readonly prisma: PrismaService) {}

  async use(req: TenantRequest, _res: Response, next: NextFunction): Promise<void> {
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

    const host = (req.headers.host ?? "").split(":")[0].toLowerCase();
    if (host && host !== this.rootDomain && host !== `www.${this.rootDomain}`) {
      if (host.endsWith(`.${this.rootDomain}`)) {
        return host.slice(0, host.length - this.rootDomain.length - 1);
      }
    }

    const querySub = req.query?.tenant;
    if (typeof querySub === "string" && querySub.trim()) {
      return querySub.trim().toLowerCase();
    }

    return null;
  }
}
