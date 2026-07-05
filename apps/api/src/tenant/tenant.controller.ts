import { Controller, Get } from "@nestjs/common";
import type { TenantContext } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentTenant } from "./current-tenant.decorator";
import { Public } from "../auth/public.decorator";

@Controller("tenant")
export class TenantController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Demonstrates end-to-end tenant scoping: returns the resolved tenant and a
   * user count fetched through the RLS-enforced `forTenant` path.
   */
  @Public()
  @Get("me")
  async me(@CurrentTenant() tenant: TenantContext) {
    const userCount = await this.prisma.forTenant(tenant.schoolId, (tx) =>
      tx.user.count(),
    );
    return { tenant, userCount };
  }
}
