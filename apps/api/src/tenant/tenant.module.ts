import { Module } from "@nestjs/common";
import { TenantController } from "./tenant.controller";

/** Tenant resolution + demo endpoint. Middleware is applied in AppModule. */
@Module({
  controllers: [TenantController],
})
export class TenantModule {}
