import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type {
  AiProposal,
  ApplyConstraintsInput,
  InterpretConstraintInput,
  InterpretResult,
} from "@ekulmis/shared";
import { formatMinutes, WEEKDAY_NAMES } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../ai/ai.service";

/** What the model is allowed to return. Anything else is discarded. */
interface RawProposal {
  kind?: unknown;
  teacher?: unknown;
  subject?: unknown;
  class?: unknown;
  days?: unknown;
  from?: unknown;
  to?: unknown;
}

/**
 * Resolves a name the model produced against real records.
 *
 * Exact match first, then a unique containment match. Ambiguity is deliberately
 * NOT resolved by picking the first hit — "Cali" matching two teachers must
 * surface as a question, because silently blocking the wrong teacher's Monday
 * is exactly the kind of error nobody catches until the week has gone wrong.
 */
function resolveName<T extends { id: string; name: string }>(
  needle: string,
  pool: T[],
): T | null {
  const q = needle.trim().toLowerCase();
  if (!q) return null;
  const exact = pool.filter((p) => p.name.toLowerCase() === q);
  if (exact.length === 1) return exact[0]!;
  const partial = pool.filter(
    (p) => p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase()),
  );
  return partial.length === 1 ? partial[0]! : null;
}

/**
 * The conversational layer over the timetable.
 *
 * Its entire job is to turn "Cali ma iman karo Isniinta" into a structured
 * constraint the solver already understands. It never schedules anything, and
 * it never writes anything: interpretation is read-only, and applying takes the
 * structured proposals the admin confirmed rather than the original sentence.
 */
@Injectable()
export class TimetableAiService {
  private readonly logger = new Logger(TimetableAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async interpret(
    schoolId: string,
    dto: InterpretConstraintInput,
  ): Promise<InterpretResult> {
    if (!(await this.ai.isEnabled())) {
      throw new BadRequestException(
        "AI is not switched on for this platform. Ask the Super Administrator to enable it.",
      );
    }

    const ctx = await this.prisma.forTenant(schoolId, async (tx) => {
      const shift = await tx.schoolShift.findUnique({
        where: { id: dto.shiftId },
        include: { periods: { orderBy: { orderIndex: "asc" } } },
      });
      if (!shift) throw new BadRequestException("Shift not found");
      const [teachers, subjects, classes] = await Promise.all([
        tx.teacher.findMany({ select: { id: true, fullName: true } }),
        tx.subject.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true },
        }),
        tx.class.findMany({
          where: { academicYearId: dto.academicYearId, status: "ACTIVE" },
          select: { id: true, name: true },
        }),
      ]);
      return { shift, teachers, subjects, classes };
    });

    const teaching = ctx.shift.periods.filter((p) => !p.isBreak);
    if (teaching.length === 0) {
      throw new BadRequestException("This shift has no teaching periods yet.");
    }

    const raw = await this.ask(dto.text, {
      teachers: ctx.teachers.map((t) => t.fullName),
      subjects: ctx.subjects.map((s) => s.name),
      classes: ctx.classes.map((c) => c.name),
      days: ctx.shift.days.map((d) => WEEKDAY_NAMES[d]!),
      periods: teaching.map(
        (p) => `${p.name} ${formatMinutes(p.startMinute)}-${formatMinutes(p.endMinute)}`,
      ),
    });

    const teacherPool = ctx.teachers.map((t) => ({ id: t.id, name: t.fullName }));
    const proposals: AiProposal[] = [];
    const summaries: string[] = [];
    const unresolved: string[] = [];

    const dayIndex = (name: unknown): number | null => {
      if (typeof name !== "string") return null;
      const i = WEEKDAY_NAMES.findIndex(
        (d) => d.toLowerCase() === name.trim().toLowerCase(),
      );
      return i >= 0 && ctx.shift.days.includes(i) ? i : null;
    };

    // The model names periods; the times come from the school's own grid, never
    // from the model. That way a hallucinated "10:00-11:30" cannot invent a
    // window the school does not actually run.
    const windowFor = (from: unknown, to: unknown) => {
      const find = (n: unknown) =>
        typeof n === "string"
          ? teaching.find((p) => p.name.toLowerCase() === n.trim().toLowerCase())
          : undefined;
      const a = find(from) ?? teaching[0]!;
      const b = find(to) ?? teaching[teaching.length - 1]!;
      return {
        startMinute: Math.min(a.startMinute, b.startMinute),
        endMinute: Math.max(a.endMinute, b.endMinute),
      };
    };

    for (const item of raw) {
      if (item.kind === "TEACHER_UNAVAILABLE") {
        const name = String(item.teacher ?? "");
        const teacher = resolveName(name, teacherPool);
        if (!teacher) {
          if (name) unresolved.push(`No single teacher matches "${name}".`);
          continue;
        }
        const days = Array.isArray(item.days)
          ? item.days.map(dayIndex).filter((d): d is number => d !== null)
          : ctx.shift.days;
        if (days.length === 0) continue;
        const w = windowFor(item.from, item.to);
        proposals.push({
          kind: "TEACHER_UNAVAILABLE",
          teacherId: teacher.id,
          teacherName: teacher.name,
          windows: days.map((d) => ({ dayOfWeek: d, ...w })),
        });
        summaries.push(
          `${teacher.name} will not be scheduled on ${days.map((d) => WEEKDAY_NAMES[d]).join(", ")} between ${formatMinutes(w.startMinute)} and ${formatMinutes(w.endMinute)}.`,
        );
      } else if (item.kind === "SUBJECT_TIME") {
        const name = String(item.subject ?? "");
        const subject = resolveName(name, ctx.subjects);
        if (!subject) {
          if (name) unresolved.push(`No single subject matches "${name}".`);
          continue;
        }
        let klass: { id: string; name: string } | null = null;
        if (typeof item.class === "string" && item.class.trim()) {
          klass = resolveName(item.class, ctx.classes);
          if (!klass) {
            unresolved.push(`No single class matches "${item.class}".`);
            continue;
          }
        }
        const w = windowFor(item.from, item.to);
        proposals.push({
          kind: "SUBJECT_TIME",
          subjectId: subject.id,
          subjectName: subject.name,
          classId: klass?.id ?? null,
          className: klass?.name ?? null,
          ...w,
        });
        summaries.push(
          `${subject.name} in ${klass ? klass.name : "every class"} will be placed between ${formatMinutes(w.startMinute)} and ${formatMinutes(w.endMinute)} where possible.`,
        );
      }
    }

    if (proposals.length === 0 && unresolved.length === 0) {
      unresolved.push(
        "That did not translate into a timetable rule. Try naming a teacher or subject, e.g. \"Cali cannot teach on Monday\".",
      );
    }

    return { proposals, summaries, unresolved };
  }

  /**
   * Save confirmed proposals.
   *
   * Takes structured, already-validated constraints — never the original
   * sentence — so whatever a model might be talked into producing, nothing
   * reaches the database that the admin has not seen and approved.
   */
  async apply(schoolId: string, dto: ApplyConstraintsInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      let teacherRules = 0;
      let subjectRules = 0;

      for (const p of dto.proposals) {
        if (p.kind === "TEACHER_UNAVAILABLE") {
          for (const w of p.windows) {
            // Re-stating the same window should not stack duplicates.
            const existing = await tx.teacherUnavailability.findFirst({
              where: {
                teacherId: p.teacherId,
                dayOfWeek: w.dayOfWeek,
                startMinute: w.startMinute,
                endMinute: w.endMinute,
              },
              select: { id: true },
            });
            if (existing) continue;
            await tx.teacherUnavailability.create({
              data: {
                schoolId,
                teacherId: p.teacherId,
                dayOfWeek: w.dayOfWeek,
                startMinute: w.startMinute,
                endMinute: w.endMinute,
                reason: "Added from a typed request",
              },
            });
            teacherRules += 1;
          }
        } else {
          const where = {
            schoolId,
            academicYearId: dto.academicYearId,
            subjectId: p.subjectId,
            classId: p.classId,
          };
          const existing = await tx.subjectTimePreference.findFirst({
            where,
            select: { id: true },
          });
          const data = {
            ...where,
            startMinute: p.startMinute,
            endMinute: p.endMinute,
            note: `${p.subjectName} between ${formatMinutes(p.startMinute)} and ${formatMinutes(p.endMinute)}`,
          };
          if (existing) {
            await tx.subjectTimePreference.update({
              where: { id: existing.id },
              data,
            });
          } else {
            await tx.subjectTimePreference.create({ data });
          }
          subjectRules += 1;
        }
      }

      return { success: true, teacherRules, subjectRules };
    });
  }

  /** Every rule currently in force, so a school can see and undo them. */
  async listRules(schoolId: string, academicYearId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const [unavailability, preferences] = await Promise.all([
        tx.teacherUnavailability.findMany({
          orderBy: [{ teacherId: "asc" }, { dayOfWeek: "asc" }],
          include: { teacher: { select: { fullName: true } } },
        }),
        tx.subjectTimePreference.findMany({
          where: { academicYearId },
          include: {
            subject: { select: { name: true } },
            class: { select: { name: true } },
          },
        }),
      ]);
      return { unavailability, preferences };
    });
  }

  async deletePreference(schoolId: string, id: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      await tx.subjectTimePreference.delete({ where: { id } });
      return { success: true };
    });
  }

  /**
   * Ask the model for structured output.
   *
   * Returns an empty list rather than throwing when the model misbehaves: a
   * failed interpretation should leave the admin typing a clearer sentence, not
   * staring at a stack trace.
   */
  private async ask(
    text: string,
    ctx: {
      teachers: string[];
      subjects: string[];
      classes: string[];
      days: string[];
      periods: string[];
    },
  ): Promise<RawProposal[]> {
    const cfg = await this.ai.getConfig();
    const system = [
      "You convert a school administrator's sentence into timetable rules.",
      "The sentence may be in Somali or English.",
      "",
      "Return ONLY JSON: {\"rules\": [ ... ]}. Each rule is one of:",
      '{"kind":"TEACHER_UNAVAILABLE","teacher":"<name>","days":["Monday"],"from":"<period>","to":"<period>"}',
      '{"kind":"SUBJECT_TIME","subject":"<name>","class":"<name or null>","from":"<period>","to":"<period>"}',
      "",
      "Use ONLY these exact names; never invent one:",
      `Teachers: ${ctx.teachers.join(", ") || "(none)"}`,
      `Subjects: ${ctx.subjects.join(", ") || "(none)"}`,
      `Classes: ${ctx.classes.join(", ") || "(none)"}`,
      `Working days: ${ctx.days.join(", ")}`,
      `Periods: ${ctx.periods.join(", ")}`,
      "",
      'For "from"/"to" give period names from the list above.',
      'Morning means the periods before the break; afternoon means those after.',
      'Omit "days" to mean every working day.',
      "If the sentence is not a timetable rule, return an empty rules list.",
    ].join("\n");

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
            { role: "system", content: system },
            { role: "user", content: text },
          ],
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Timetable AI failed: HTTP ${res.status}`);
        return [];
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const parsed = JSON.parse(
        data.choices?.[0]?.message?.content ?? "{}",
      ) as { rules?: unknown };
      return Array.isArray(parsed.rules)
        ? (parsed.rules.slice(0, 10) as RawProposal[])
        : [];
    } catch (err) {
      this.logger.warn(
        `Timetable AI error: ${err instanceof Error ? err.message : err}`,
      );
      return [];
    }
  }
}
