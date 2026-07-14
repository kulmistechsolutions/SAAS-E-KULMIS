import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { updateAiConfigSchema } from "@ekulmis/shared";
import { Public } from "../auth/public.decorator";
import { PlatformGuard } from "../platform/platform.guard";
import { AiService } from "./ai.service";

/** Super Admin only — manage the platform OpenAI key used for quiz grading. */
@Public()
@UseGuards(PlatformGuard)
@Controller("platform/ai")
export class PlatformAiController {
  constructor(private readonly ai: AiService) {}

  /** Never returns the raw key — only a masked hint + whether one is set. */
  private mask(cfg: {
    enabled: boolean;
    provider: string;
    apiKey: string;
    model: string;
    connectionStatus: string;
    connectionMessage: string | null;
    lastTestedAt: Date | null;
  }) {
    const key = cfg.apiKey ?? "";
    return {
      enabled: cfg.enabled,
      provider: cfg.provider,
      model: cfg.model,
      hasKey: key.length > 0,
      keyHint: key ? `…${key.slice(-4)}` : null,
      connectionStatus: cfg.connectionStatus,
      connectionMessage: cfg.connectionMessage,
      lastTestedAt: cfg.lastTestedAt,
    };
  }

  @Get("config")
  async getConfig() {
    return this.mask(await this.ai.getConfig());
  }

  @Patch("config")
  async updateConfig(@Body() body: unknown) {
    const parsed = updateAiConfigSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.mask(await this.ai.updateConfig(parsed.data));
  }

  @Post("test")
  test() {
    return this.ai.testConnection();
  }
}
