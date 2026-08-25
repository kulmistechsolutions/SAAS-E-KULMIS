import { Injectable, Logger } from "@nestjs/common";
import type { UpdateAiConfigInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

export interface ConceptScore {
  score: number; // 0-100
  feedback: string;
}

/**
 * Where each provider's OpenAI-compatible endpoint lives.
 *
 * OpenRouter speaks the same chat-completions API, so switching is a base URL
 * and a model name — not a second code path to keep in step with the first.
 */
const PROVIDERS: Record<string, { base: string; label: string }> = {
  openai: { base: "https://api.openai.com/v1", label: "OpenAI" },
  openrouter: { base: "https://openrouter.ai/api/v1", label: "OpenRouter" },
};

const DEFAULT_PROVIDER = "openai";

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Base URL, label and headers for whichever provider is configured.
   *
   * Public because other modules call the same chat API with their own prompts
   * — a second hardcoded openai.com is exactly how one of them gets left
   * behind when the platform switches provider.
   */
  endpoint(cfg: { provider: string; apiKey: string }) {
    const p = PROVIDERS[cfg.provider] ?? PROVIDERS[DEFAULT_PROVIDER];
    return {
      base: p.base,
      label: p.label,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
        // OpenRouter attributes requests to an app; it ignores unknown headers
        // from other providers, so these are safe to send either way.
        "HTTP-Referer": "https://ekulmis.com",
        "X-Title": "eKulmis",
      } as Record<string, string>,
    };
  }

  /** The singleton platform AI config (created on first access). */
  async getConfig() {
    const existing = await this.prisma.aiGlobalConfig.findFirst();
    if (existing) return existing;
    return this.prisma.aiGlobalConfig.create({ data: {} });
  }

  async isEnabled(): Promise<boolean> {
    const cfg = await this.getConfig();
    return cfg.enabled && cfg.apiKey.trim().length > 0;
  }

  async updateConfig(dto: UpdateAiConfigInput) {
    const cfg = await this.getConfig();
    const data: Record<string, unknown> = {};
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.model !== undefined) data.model = dto.model;
    // Changing provider invalidates the last test: the same key almost never
    // works on both, so the badge must not keep claiming CONNECTED.
    if (dto.provider !== undefined && dto.provider !== cfg.provider) {
      data.provider = dto.provider;
      data.connectionStatus = "DISCONNECTED";
      data.connectionMessage = null;
    }
    // Only overwrite the key when a non-empty value is supplied, so a masked
    // round-trip from the UI never wipes the stored key.
    if (dto.apiKey !== undefined && dto.apiKey.trim().length > 0) {
      data.apiKey = dto.apiKey.trim();
      data.connectionStatus = "DISCONNECTED";
    }
    return this.prisma.aiGlobalConfig.update({ where: { id: cfg.id }, data });
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const cfg = await this.getConfig();
    if (!cfg.apiKey.trim()) {
      return { ok: false, message: "No API key configured." };
    }
    const ep = this.endpoint(cfg);
    try {
      const res = await fetch(`${ep.base}/models`, { headers: ep.headers });
      const ok = res.ok;
      // A failed test must say what the provider said. "HTTP 429" alone sent
      // us looking for a rate limit when the account was simply out of credit.
      const detail = ok ? "" : (await res.text().catch(() => "")).slice(0, 200);
      const message = ok
        ? `${ep.label} connection successful.`
        : `${ep.label} returned HTTP ${res.status}. ${detail}`.trim();
      await this.prisma.aiGlobalConfig.update({
        where: { id: cfg.id },
        data: {
          connectionStatus: ok ? "CONNECTED" : "ERROR",
          connectionMessage: message,
          lastTestedAt: new Date(),
        },
      });
      return { ok, message };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed.";
      await this.prisma.aiGlobalConfig.update({
        where: { id: cfg.id },
        data: {
          connectionStatus: "ERROR",
          connectionMessage: message,
          lastTestedAt: new Date(),
        },
      });
      return { ok: false, message };
    }
  }

  /**
   * Ask the model to write prose from figures already computed here.
   *
   * Deliberately narrow: the caller supplies the numbers, the model supplies
   * the sentences. Nothing is looked up on the model's side, so it cannot
   * invent a figure the school does not have — the worst it can do is describe
   * the real ones badly.
   *
   * Returns null when AI is switched off or unreachable, so every caller has
   * to have something sensible to show without it.
   */
  async writeFrom(
    instruction: string,
    facts: string,
    opts: { maxWords?: number } = {},
  ): Promise<string | null> {
    const cfg = await this.getConfig();
    if (!cfg.enabled || !cfg.apiKey.trim()) return null;
    const limit = opts.maxWords ?? 220;
    try {
      const ep = this.endpoint(cfg);
      const res = await fetch(`${ep.base}/chat/completions`, {
        method: "POST",
        headers: ep.headers,
        body: JSON.stringify({
          model: cfg.model || "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: Math.ceil(limit * 2),
          messages: [
            {
              role: "system",
              content:
                "You write short management briefings for a school principal, from figures you are given. " +
                "Use ONLY those figures — never estimate, extrapolate or invent a number, a name or a trend. " +
                "If the figures do not answer something, say plainly that the school has not recorded it. " +
                "Separate what the data says from what you suggest: state the facts first, then any recommendation, " +
                "and never present a recommendation as a finding. " +
                `Plain professional English, no marketing tone, at most ${limit} words. No headings unless asked.`,
            },
            { role: "user", content: `${instruction}

Figures:
${facts}` },
          ],
        }),
      });
      if (!res.ok) {
        // The status alone cannot be acted on: a 429 is either "too fast" or
        // "out of credit", and those need different people to fix them.
        const body = await res.text().catch(() => "");
        this.logger.warn(
          `${ep.label} narrative failed: HTTP ${res.status} ${body.slice(0, 300)}`,
        );
        return null;
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      return text ? text : null;
    } catch (err) {
      this.logger.warn(
        `OpenAI narrative error: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /**
   * Score a free-text answer against the model answer (0-100 similarity of
   * meaning). Returns null when AI grading is unavailable so the caller can
   * fall back to manual review.
   */
  async gradeConcept(
    question: string,
    modelAnswer: string,
    studentAnswer: string,
  ): Promise<ConceptScore | null> {
    const cfg = await this.getConfig();
    if (!cfg.enabled || !cfg.apiKey.trim()) return null;
    if (!studentAnswer.trim()) {
      return { score: 0, feedback: "No answer was provided." };
    }
    const ep = this.endpoint(cfg);
    try {
      const res = await fetch(`${ep.base}/chat/completions`, {
        method: "POST",
        headers: ep.headers,
        body: JSON.stringify({
          model: cfg.model || "gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'You are a strict but fair exam grader. Compare the student answer to the model answer and rate how well it captures the same meaning/concept, ignoring spelling and phrasing. Respond ONLY with JSON: {"score": <integer 0-100>, "feedback": "<one short sentence>"}.',
            },
            {
              role: "user",
              content: `Question: ${question}\nModel answer: ${modelAnswer}\nStudent answer: ${studentAnswer}`,
            },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        this.logger.warn(
          `${ep.label} grading failed: HTTP ${res.status} ${body.slice(0, 300)}`,
        );
        return null;
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content) as { score?: unknown; feedback?: unknown };
      let score = Math.round(Number(parsed.score));
      if (!Number.isFinite(score)) score = 0;
      score = Math.max(0, Math.min(100, score));
      return { score, feedback: String(parsed.feedback ?? "").slice(0, 300) };
    } catch (err) {
      this.logger.warn(
        `${ep.label} grading error: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }
}
