import { Injectable, Logger } from "@nestjs/common";
import type { UpdateAiConfigInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

export interface ConceptScore {
  score: number; // 0-100
  feedback: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
      });
      const ok = res.ok;
      const message = ok
        ? "OpenAI connection successful."
        : `OpenAI returned HTTP ${res.status}.`;
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
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
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
          `OpenAI narrative failed: HTTP ${res.status} ${body.slice(0, 300)}`,
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
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
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
        this.logger.warn(`OpenAI grading failed: HTTP ${res.status}`);
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
        `OpenAI grading error: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }
}
