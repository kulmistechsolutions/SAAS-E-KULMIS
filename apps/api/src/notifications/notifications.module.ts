import { Global, Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsGateway } from "./notifications.gateway";
import { NotificationsService } from "./notifications.service";

/**
 * Global because notices are raised from wherever the thing worth reporting
 * happens — registering a student, publishing a quiz or a set of results,
 * a subscription running out. Threading an import through each of those
 * modules buys nothing, and forgetting one only shows up as a dependency
 * error at boot, long after the code type-checked.
 */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
