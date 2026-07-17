import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { LibraryPortalController } from "./library-portal.controller";
import { LibraryPortalService } from "./library-portal.service";
import { LibraryModule } from "../library/library.module";

@Module({
  imports: [
    LibraryModule,
    // Same secret as AuthModule's JwtModule (own instance, not exported from
    // there) so tokens this module signs verify under the global
    // JwtAuthGuard — the same pattern SmsModule uses for its own JWT needs.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
      }),
    }),
  ],
  controllers: [LibraryPortalController],
  providers: [LibraryPortalService],
})
export class LibraryPortalModule {}
