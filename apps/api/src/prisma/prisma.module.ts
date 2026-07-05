import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/** Global Prisma access — inject `PrismaService` anywhere without re-importing. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
