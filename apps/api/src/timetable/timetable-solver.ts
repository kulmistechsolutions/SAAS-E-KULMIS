/**
 * The timetable solver.
 *
 * Deliberately a plain function with no NestJS or Prisma in sight: the hard
 * part is the search, and it should be testable and readable without a
 * database attached.
 *
 * It is a constraint solver, not a heuristic that "usually works". Every
 * subject gets EXACTLY the periods it was allocated, or generation fails and
 * says why — a timetable that quietly drops two Chemistry lessons is worse than
 * no timetable, because nobody notices until the term is running.
 *
 * ── Why matching, not plain backtracking ──────────────────────────────────
 * Real school timetables are close to an exact cover: every class is full for
 * every period, and the busiest teachers have literally zero spare slots (a
 * real instance this was built against has one teacher with 28 lessons and
 * exactly 28 available periods). Lesson-at-a-time backtracking drowns in that —
 * it commits early, discovers the contradiction hundreds of levels deeper, and
 * unwinds forever.
 *
 * So the unit of work here is a SLOT, not a lesson. For one period on one day,
 * deciding what every class does at once is a bipartite matching between
 * classrooms and teachers — a teacher can take one class, a class can take one
 * teacher — which Kuhn's algorithm solves exactly and instantly. Filling the
 * week slot by slot turns an intractable search into thirty small exact
 * answers.
 *
 * Hard rules (never violated):
 *   - a teacher is in one place at a time, including against lessons already
 *     published in the school's other shift
 *   - a classroom holds one lesson at a time
 *   - a teacher is never scheduled inside an unavailable window
 *   - every subject's weekly count is met exactly
 *
 * Soft rules (kept when possible, reported when not):
 *   - a subject does not appear twice on the same day for one class, unless its
 *     weekly count exceeds the number of working days, when a repeat is
 *     arithmetically unavoidable
 */

export interface SolverPeriod {
  id: string;
  startMinute: number;
  endMinute: number;
}

export interface SolverRoom {
  key: string;
  classId: string;
  sectionId: string | null;
  label: string;
}

/** One (classroom, subject) allocation to place. */
export interface SolverDemand {
  roomKey: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  periodsPerWeek: number;
}

/** A slot a teacher cannot be given, in wall-clock minutes on a weekday. */
export interface SolverBlock {
  teacherId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface SolverInput {
  days: number[];
  periods: SolverPeriod[];
  rooms: SolverRoom[];
  demands: SolverDemand[];
  /** Unavailability windows AND lessons already published in another shift. */
  blocks: SolverBlock[];
  /** Wall-clock budget. Search stops and reports rather than hanging. */
  timeLimitMs?: number;
  /** Deterministic runs in tests; omit for a different attempt each time. */
  seed?: number;
}

export interface SolvedLesson {
  roomKey: string;
  subjectId: string;
  teacherId: string;
  dayIndex: number;
  periodIndex: number;
}

export interface SolverResult {
  ok: boolean;
  lessons: SolvedLesson[];
  /** Soft-rule compromises, phrased for the school, not the developer. */
  notes: string[];
  /** Why it failed, when it did. */
  failure: string | null;
  attempts: number;
}

/** Small deterministic PRNG so a seeded run is reproducible. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function solveTimetable(input: SolverInput): SolverResult {
  const { days, periods, rooms, demands } = input;
  const timeLimitMs = input.timeLimitMs ?? 15000;
  const deadline = Date.now() + timeLimitMs;

  const notes: string[] = [];
  if (days.length === 0 || periods.length === 0) {
    return {
      ok: false,
      lessons: [],
      notes,
      failure: "This shift has no working days or no teaching periods.",
      attempts: 0,
    };
  }

  const D = days.length;
  const P = periods.length;
  const S = D * P;

  const roomIndex = new Map(rooms.map((r, i) => [r.key, i]));
  const teachers = [...new Set(demands.map((d) => d.teacherId))];
  const teacherIndex = new Map(teachers.map((t, i) => [t, i]));

  // Demands that point at a class we do not have cannot be placed at all.
  const live = demands.filter(
    (d) => roomIndex.has(d.roomKey) && d.periodsPerWeek > 0,
  );
  if (live.length === 0) {
    return {
      ok: false,
      lessons: [],
      notes,
      failure: "Nothing to schedule — no subject has any periods allocated.",
      attempts: 0,
    };
  }

  // allowed[teacher][slot]: unavailability and other-shift lessons collapse
  // into the same thing once compared on wall-clock time, which is exactly why
  // times are stored as minutes rather than as period references.
  const allowed: boolean[][] = teachers.map(() => new Array<boolean>(S).fill(true));
  for (const b of input.blocks) {
    const t = teacherIndex.get(b.teacherId);
    if (t === undefined) continue;
    const d = days.indexOf(b.dayOfWeek);
    if (d < 0) continue;
    for (let p = 0; p < P; p += 1) {
      const period = periods[p]!;
      if (b.startMinute < period.endMinute && period.startMinute < b.endMinute) {
        allowed[t]![d * P + p] = false;
      }
    }
  }

  // Cap per day. A subject needing more periods than there are working days
  // must repeat on some day; work that out once so the search treats it as a
  // rule rather than discovering it by failing.
  const perDayCap = live.map((d) => Math.max(1, Math.ceil(d.periodsPerWeek / D)));
  live.forEach((d, i) => {
    if (d.periodsPerWeek > D) {
      notes.push(
        `${rooms[roomIndex.get(d.roomKey)!]!.label} · ${d.subjectName}: ${d.periodsPerWeek} periods across ${D} days, so it appears twice on some days — unavoidable.`,
      );
    }
    void i;
  });

  // ── Arithmetic that no amount of searching can fix ──────────────────────
  for (let r = 0; r < rooms.length; r += 1) {
    const total = live
      .filter((d) => roomIndex.get(d.roomKey) === r)
      .reduce((sum, d) => sum + d.periodsPerWeek, 0);
    if (total > S) {
      return {
        ok: false,
        lessons: [],
        notes,
        failure: `${rooms[r]!.label} has ${total} periods allocated but only ${S} slots a week.`,
        attempts: 0,
      };
    }
  }
  for (let t = 0; t < teachers.length; t += 1) {
    const load = live
      .filter((d) => teacherIndex.get(d.teacherId) === t)
      .reduce((sum, d) => sum + d.periodsPerWeek, 0);
    const free = allowed[t]!.filter(Boolean).length;
    if (load > free) {
      return {
        ok: false,
        lessons: [],
        notes,
        failure: `${live.find((d) => d.teacherId === teachers[t])?.teacherName ?? "A teacher"} has ${load} lessons but only ${free} available slots.`,
        attempts: 0,
      };
    }
  }

  let attempts = 0;
  // Abandoning a doomed attempt is cheap, so restarts are bounded by the clock
  // rather than by a count — a fixed cap would give up in a couple of seconds
  // while the time budget still had plenty left.
  const maxRestarts = 1_000_000;
  let best: { unplaced: number[]; total: number } | null = null;
  for (let attempt = 0; attempt < maxRestarts; attempt += 1) {
    attempts += 1;
    const rand = makeRandom((input.seed ?? 1) + attempt * 7919);
    const run = fillWeek(rand, attempt);
    if (run.lessons) {
      return { ok: true, lessons: run.lessons, notes, failure: null, attempts };
    }
    const total = run.remaining.reduce((a, b) => a + b, 0);
    if (!best || total < best.total) best = { unplaced: run.remaining, total };
    if (Date.now() > deadline) break;
  }

  // Naming the lessons that would not fit turns "it failed" into something a
  // school can actually act on.
  const stuck = (best?.unplaced ?? [])
    .map((n, i) => ({ n, d: live[i]! }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
    .map(
      (x) =>
        `${rooms[roomIndex.get(x.d.roomKey)!]!.label} ${x.d.subjectName} (${x.d.teacherName}) ×${x.n}`,
    );

  return {
    ok: false,
    lessons: [],
    notes,
    failure:
      `Could not place ${best?.total ?? "some"} lesson(s) without a clash` +
      (stuck.length > 0 ? `: ${stuck.join(", ")}. ` : ". ") +
      "The allocation is very tight — free up one of those teachers, or move a period to another class.",
    attempts,
  };

  /**
   * One full attempt: walk every slot of the week and, at each, decide what
   * all classes do simultaneously via maximum bipartite matching.
   */
  function fillWeek(
    rand: () => number,
    attempt: number,
  ): { lessons: SolvedLesson[] | null; remaining: number[] } {
    const remaining = live.map((d) => d.periodsPerWeek);
    // How many of this subject the class already has on this day.
    const dayCount = new Map<string, number>();
    // Slots still open to each teacher from here on, for urgency.
    const teacherFreeAhead = allowed.map((row) => row.filter(Boolean).length);
    const teacherLoad = teachers.map((_, t) =>
      live.reduce(
        (sum, d, i) =>
          teacherIndex.get(d.teacherId) === t ? sum + remaining[i]! : sum,
        0,
      ),
    );
    const taken = teachers.map(() => new Array<boolean>(S).fill(false));
    const lessons: SolvedLesson[] = [];

    // Visiting slots in a different order each restart is what makes restarts
    // meaningful — the same order would just reproduce the same dead end.
    const slotOrder = [...Array(S).keys()];
    if (attempt > 0) {
      for (let i = slotOrder.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [slotOrder[i], slotOrder[j]] = [slotOrder[j]!, slotOrder[i]!];
      }
    }

    for (const slot of slotOrder) {
      const d = Math.floor(slot / P);

      // Candidate demands for each room at this slot.
      const candidates: number[][] = rooms.map(() => []);
      for (let i = 0; i < live.length; i += 1) {
        if (remaining[i]! <= 0) continue;
        const dem = live[i]!;
        const r = roomIndex.get(dem.roomKey)!;
        const t = teacherIndex.get(dem.teacherId)!;
        if (!allowed[t]![slot] || taken[t]![slot]) continue;
        const key = `${r}:${d}:${dem.subjectId}`;
        if ((dayCount.get(key) ?? 0) >= perDayCap[i]!) continue;
        candidates[r]!.push(i);
      }

      // Urgency: a class whose remaining lessons equal its remaining slots has
      // no room to waste this one, so it gets first claim on a teacher.
      const roomOrder = rooms
        .map((_, r) => r)
        .filter((r) => candidates[r]!.length > 0)
        .sort((a, b) => {
          const need = (r: number) =>
            live.reduce(
              (sum, dem, i) =>
                roomIndex.get(dem.roomKey) === r ? sum + remaining[i]! : sum,
              0,
            );
          return need(b) - need(a) || rand() - 0.5;
        });

      // Kuhn's algorithm: rooms on the left, teachers on the right. Maximum
      // matching here is exactly "the most classes we can teach this period".
      const matchTeacher = new Array<number>(teachers.length).fill(-1);
      const chosenDemand = new Array<number>(teachers.length).fill(-1);

      const tryRoom = (r: number, seen: boolean[]): boolean => {
        // Prefer the teacher who can least afford to miss this slot, then the
        // subject with most lessons left to place.
        const opts = candidates[r]!.slice().sort((x, y) => {
          const tx = teacherIndex.get(live[x]!.teacherId)!;
          const ty = teacherIndex.get(live[y]!.teacherId)!;
          const slackX = teacherFreeAhead[tx]! - teacherLoad[tx]!;
          const slackY = teacherFreeAhead[ty]! - teacherLoad[ty]!;
          if (slackX !== slackY) return slackX - slackY;
          if (remaining[y]! !== remaining[x]!) return remaining[y]! - remaining[x]!;
          return rand() - 0.5;
        });
        for (const i of opts) {
          const t = teacherIndex.get(live[i]!.teacherId)!;
          if (seen[t]) continue;
          seen[t] = true;
          if (matchTeacher[t] === -1 || tryRoom(matchTeacher[t]!, seen)) {
            matchTeacher[t] = r;
            chosenDemand[t] = i;
            return true;
          }
        }
        return false;
      };

      // Slots left after this one, used to tell "must be scheduled now" apart
      // from "could be scheduled later".
      const slotsLeft = slotOrder.length - slotOrder.indexOf(slot) - 1;

      for (const r of roomOrder) {
        const matched = tryRoom(r, new Array<boolean>(teachers.length).fill(false));
        // A class with as many lessons left as slots left cannot afford a free
        // period. If it did not get one, this attempt is already doomed —
        // abandoning it now is far cheaper than discovering it at the end.
        if (!matched) {
          const need = live.reduce(
            (sum, dem, i) =>
              roomIndex.get(dem.roomKey) === r ? sum + remaining[i]! : sum,
            0,
          );
          if (need > slotsLeft) return { lessons: null, remaining };
        }
      }

      // The same test for teachers: one whose remaining lessons fill every
      // slot they have left must be teaching in this one.
      for (let t = 0; t < teachers.length; t += 1) {
        if (!allowed[t]![slot] || chosenDemand[t]! >= 0) continue;
        if (teacherLoad[t]! >= teacherFreeAhead[t]!) {
          return { lessons: null, remaining };
        }
      }

      for (let t = 0; t < teachers.length; t += 1) {
        const i = chosenDemand[t];
        if (i === undefined || i < 0) continue;
        const dem = live[i]!;
        const r = matchTeacher[t]!;
        remaining[i] -= 1;
        teacherLoad[t] -= 1;
        taken[t]![slot] = true;
        const key = `${r}:${d}:${dem.subjectId}`;
        dayCount.set(key, (dayCount.get(key) ?? 0) + 1);
        lessons.push({
          roomKey: dem.roomKey,
          subjectId: dem.subjectId,
          teacherId: dem.teacherId,
          dayIndex: d,
          periodIndex: slot % P,
        });
      }

      // This slot is now behind every teacher, matched or not.
      for (let t = 0; t < teachers.length; t += 1) {
        if (allowed[t]![slot]) teacherFreeAhead[t] -= 1;
      }

      if (Date.now() > deadline) return { lessons: null, remaining };
    }

    return {
      lessons: remaining.every((n) => n === 0) ? lessons : null,
      remaining,
    };
  }
}
