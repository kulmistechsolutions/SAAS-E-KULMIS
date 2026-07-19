import {
  solveTimetable,
  type SolverBlock,
  type SolverDemand,
  type SolverInput,
  type SolverRoom,
} from "./timetable-solver";

/**
 * The fixture is a real school week, not invented numbers: it is the lesson
 * allocation from a working Somali secondary school's 2025/26 timetable —
 * 6 classes, 9 teachers, 30 periods each, Saturday to Wednesday, with the
 * teachers' real availability restrictions.
 *
 * Made-up data would have been far too easy. This one is genuinely tight:
 * two teachers carry 28 lessons a week, and three can only work part of the day.
 */

const DAYS = [6, 0, 1, 2, 3]; // Saturday–Wednesday

// P1–P3 run 43 minutes, P4–P6 only 30 — the periods after the break really are
// shorter, which is why each carries its own times.
const PERIODS = [
  { id: "P1", startMinute: 470, endMinute: 513 },
  { id: "P2", startMinute: 513, endMinute: 556 },
  { id: "P3", startMinute: 556, endMinute: 600 },
  { id: "P4", startMinute: 630, endMinute: 660 },
  { id: "P5", startMinute: 660, endMinute: 690 },
  { id: "P6", startMinute: 690, endMinute: 720 },
];

const ROOMS: SolverRoom[] = ["F1", "F2", "F3", "F4", "8thA", "8thB"].map((n) => ({
  key: n,
  classId: n,
  sectionId: null,
  label: n,
}));

/** [subject, teacher, per-class counts in room order]. A 0 means not taught. */
const ALLOCATION: [string, string, number[]][] = [
  ["English", "Axmed", [3, 2, 3, 2, 4, 4]],
  ["Tiknoloji", "Sudeys", [3, 3, 3, 3, 4, 4]],
  ["Physics", "Qadar", [2, 2, 2, 3, 0, 0]],
  ["Biology", "Qeyloos", [3, 3, 3, 2, 0, 0]],
];

/** Rows where the teacher differs per class have to be listed individually. */
const PER_CLASS: [string, string, string, number][] = [
  ["Mathematics", "Cumar", "F1", 3],
  ["Mathematics", "Cumar", "F2", 3],
  ["Mathematics", "Cumar", "F3", 3],
  ["Mathematics", "Cumar", "F4", 3],
  ["Mathematics", "Mowliid", "8thA", 4],
  ["Mathematics", "Cumar", "8thB", 4],
  ["Somali", "Mowliid", "F1", 3],
  ["Somali", "Mowliid", "F2", 3],
  ["Somali", "Mowliid", "F3", 3],
  ["Somali", "Mowliid", "F4", 3],
  ["Somali", "Cumar", "8thA", 4],
  ["Somali", "Sudeys", "8thB", 4],
  ["Arabic", "Cabdigeedi", "F1", 2],
  ["Arabic", "Cabdigeedi", "F2", 2],
  ["Arabic", "Aladii", "F3", 3],
  ["Arabic", "Cabdigeedi", "F4", 3],
  ["Arabic", "Cabdigeedi", "8thA", 4],
  ["Arabic", "Cabdigeedi", "8thB", 4],
  ["Tarbiyo", "Cabdigeedi", "F1", 2],
  ["Tarbiyo", "Cabdigeedi", "F2", 3],
  ["Tarbiyo", "Cabdigeedi", "F3", 2],
  ["Tarbiyo", "Aladii", "F4", 4],
  ["Tarbiyo", "Cabdigeedi", "8thA", 3],
  ["Tarbiyo", "Cabdigeedi", "8thB", 3],
  ["Chemistry", "Mowliid", "F1", 2],
  ["Chemistry", "Mowliid", "F2", 3],
  ["Chemistry", "Mowliid", "F3", 2],
  ["Chemistry", "Mowliid", "F4", 2],
  ["Geography", "Saadaq", "F1", 2],
  ["Geography", "Saadaq", "F2", 1],
  ["Geography", "Saadaq", "F3", 2],
  ["Geography", "Saadaq", "F4", 1],
  ["Business", "Axmed", "F1", 3],
  ["Business", "Axmed", "F2", 3],
  ["Business", "Axmed", "F3", 2],
  ["Business", "Cumar", "F4", 2],
  ["Taariikh", "Saadaq", "F1", 2],
  ["Taariikh", "Saadaq", "F2", 2],
  ["Taariikh", "Saadaq", "F3", 2],
  ["Taariikh", "Qeyloos", "F4", 2],
  ["Saynis", "Qeyloos", "8thA", 4],
  ["Saynis", "Cumar", "8thB", 4],
  ["C.bulshada", "Saadaq", "8thA", 3],
  ["C.bulshada", "Mowliid", "8thB", 3],
];

function buildDemands(): SolverDemand[] {
  const out: SolverDemand[] = [];
  for (const [subject, teacher, counts] of ALLOCATION) {
    counts.forEach((count, i) => {
      if (count > 0) {
        out.push({
          roomKey: ROOMS[i]!.key,
          subjectId: subject,
          subjectName: subject,
          teacherId: teacher,
          teacherName: teacher,
          periodsPerWeek: count,
        });
      }
    });
  }
  for (const [subject, teacher, room, count] of PER_CLASS) {
    out.push({
      roomKey: room,
      subjectId: subject,
      subjectName: subject,
      teacherId: teacher,
      teacherName: teacher,
      periodsPerWeek: count,
    });
  }
  return out;
}

/** The real restrictions printed on the school's own timetable. */
function buildBlocks(): SolverBlock[] {
  const blocks: SolverBlock[] = [];
  const window = (teacherId: string, day: number, from: number, to: number) =>
    blocks.push({ teacherId, dayOfWeek: day, startMinute: from, endMinute: to });

  for (const day of DAYS) {
    // Qadar is never in period 1 or 2.
    window("Qadar", day, PERIODS[0]!.startMinute, PERIODS[1]!.endMinute);
    // Sudeys always has the last period free.
    window("Sudeys", day, PERIODS[5]!.startMinute, PERIODS[5]!.endMinute);
  }
  // Saadaq works mornings Sat/Sun/Mon and afternoons Tue/Wed.
  for (const day of [6, 0, 1]) {
    window("Saadaq", day, PERIODS[3]!.startMinute, PERIODS[5]!.endMinute);
  }
  for (const day of [2, 3]) {
    window("Saadaq", day, PERIODS[0]!.startMinute, PERIODS[2]!.endMinute);
  }
  // Mowliid is off Tuesday afternoon.
  window("Mowliid", 2, PERIODS[4]!.startMinute, PERIODS[5]!.endMinute);
  return blocks;
}

function baseInput(): SolverInput {
  return {
    days: DAYS,
    periods: PERIODS,
    rooms: ROOMS,
    demands: buildDemands(),
    blocks: buildBlocks(),
    timeLimitMs: 20000,
    seed: 12345,
  };
}

describe("solveTimetable", () => {
  const input = baseInput();
  const result = solveTimetable(input);

  it("fits the whole school week", () => {
    expect(result.failure).toBeNull();
    expect(result.ok).toBe(true);
  });

  it("places exactly 180 lessons — 30 for each of the 6 classes", () => {
    expect(result.lessons).toHaveLength(180);
    for (const room of ROOMS) {
      const mine = result.lessons.filter((l) => l.roomKey === room.key);
      expect(mine).toHaveLength(30);
    }
  });

  it("gives every subject exactly the periods it was allocated", () => {
    for (const demand of input.demands) {
      const got = result.lessons.filter(
        (l) => l.roomKey === demand.roomKey && l.subjectId === demand.subjectId,
      ).length;
      expect({
        room: demand.roomKey,
        subject: demand.subjectId,
        periods: got,
      }).toEqual({
        room: demand.roomKey,
        subject: demand.subjectId,
        periods: demand.periodsPerWeek,
      });
    }
  });

  it("never puts a teacher in two classes at once", () => {
    const seen = new Set<string>();
    for (const l of result.lessons) {
      const key = `${l.teacherId}:${l.dayIndex}:${l.periodIndex}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("never puts two lessons in one classroom at once", () => {
    const seen = new Set<string>();
    for (const l of result.lessons) {
      const key = `${l.roomKey}:${l.dayIndex}:${l.periodIndex}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("respects every teacher's unavailable windows", () => {
    for (const l of result.lessons) {
      const day = DAYS[l.dayIndex]!;
      const period = PERIODS[l.periodIndex]!;
      const clash = input.blocks.find(
        (b) =>
          b.teacherId === l.teacherId &&
          b.dayOfWeek === day &&
          b.startMinute < period.endMinute &&
          period.startMinute < b.endMinute,
      );
      expect(clash).toBeUndefined();
    }
  });

  it("spreads a subject across days unless its count forces a repeat", () => {
    for (const demand of input.demands) {
      const byDay = new Map<number, number>();
      for (const l of result.lessons) {
        if (l.roomKey !== demand.roomKey || l.subjectId !== demand.subjectId) continue;
        byDay.set(l.dayIndex, (byDay.get(l.dayIndex) ?? 0) + 1);
      }
      const cap = Math.max(1, Math.ceil(demand.periodsPerWeek / DAYS.length));
      for (const count of byDay.values()) expect(count).toBeLessThanOrEqual(cap);
    }
  });

  it("explains the repeats it could not avoid", () => {
    // 8thA/8thB carry 4-period subjects over 5 days, which fits; nothing here
    // exceeds 5, so the solver should not be claiming unavoidable repeats.
    expect(result.notes.filter((n) => n.includes("unavoidable"))).toHaveLength(0);
  });

  it("reports failure instead of dropping lessons when asked for the impossible", () => {
    const impossible = baseInput();
    // One teacher, every class, far more lessons than the week can hold.
    impossible.demands = ROOMS.map((r) => ({
      roomKey: r.key,
      subjectId: "Everything",
      subjectName: "Everything",
      teacherId: "OnlyTeacher",
      teacherName: "Only Teacher",
      periodsPerWeek: 30,
    }));
    const bad = solveTimetable({ ...impossible, timeLimitMs: 3000 });
    expect(bad.ok).toBe(false);
    expect(bad.lessons).toHaveLength(0);
    expect(bad.failure).toBeTruthy();
  });

  it("treats an already-published lesson in the other shift as a hard block", () => {
    const withOtherShift = baseInput();
    // Cabdigeedi teaches in the afternoon shift on Saturday, overlapping P1.
    withOtherShift.blocks = [
      ...withOtherShift.blocks,
      {
        teacherId: "Cabdigeedi",
        dayOfWeek: 6,
        startMinute: 460,
        endMinute: 520,
      },
    ];
    const solved = solveTimetable(withOtherShift);
    expect(solved.ok).toBe(true);
    const violation = solved.lessons.find(
      (l) =>
        l.teacherId === "Cabdigeedi" &&
        DAYS[l.dayIndex] === 6 &&
        PERIODS[l.periodIndex]!.startMinute < 520 &&
        460 < PERIODS[l.periodIndex]!.endMinute,
    );
    expect(violation).toBeUndefined();
  });
});
