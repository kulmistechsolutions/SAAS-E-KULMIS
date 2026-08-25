import { Module } from "@nestjs/common";
import { CopilotController } from "./copilot.controller";
import { CopilotService } from "./copilot.service";
import { AiModule } from "../ai/ai.module";

/** School Copilot — reads what the other modules recorded; writes nothing. */
@Module({
  imports: [AiModule],
  controllers: [CopilotController],
  providers: [CopilotService],
  exports: [CopilotService],
})
export class CopilotModule {}
