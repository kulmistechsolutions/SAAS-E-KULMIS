import { BullModule } from "@nestjs/bullmq";
import { DynamicModule, Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const QUEUE_REPORTS = "reports";
export const QUEUE_IMPORTS = "imports";
export const QUEUE_BACKUPS = "backups";
export const QUEUE_NOTIFICATIONS = "notifications";

@Global()
@Module({})
export class QueueModule {
  static forRoot(): DynamicModule {
    const enabled = process.env.REDIS_ENABLED === "true";

    if (!enabled) {
      return {
        module: QueueModule,
      };
    }

    return {
      module: QueueModule,
      imports: [
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: {
              url: config.get<string>("REDIS_URL") ?? "redis://localhost:6379",
            },
          }),
        }),
        BullModule.registerQueue(
          { name: QUEUE_REPORTS },
          { name: QUEUE_IMPORTS },
          { name: QUEUE_BACKUPS },
          { name: QUEUE_NOTIFICATIONS },
        ),
      ],
      exports: [BullModule],
    };
  }
}
