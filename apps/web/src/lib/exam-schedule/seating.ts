/**
 * Mixed exam seating.
 *
 * Students from several classes are seated so that no two from the same
 * class sit side by side or one behind the other. Seats are filled row by
 * row; each seat takes the class with the most students still waiting that
 * differs from the student to its left and the one in front. When the only
 * students left would break that rule and the rooms have room to spare, the
 * seat is left empty instead; only when there is no spare seat does a clash
 * happen — and it is counted, so the page can say so.
 */

export interface SeatStudent {
  id: string;
  className: string;
}

export interface SeatRoom {
  id: string;
  rows: number;
  cols: number;
}

export interface SeatingResult {
  rooms: { roomId: string; seats: (string | null)[][] }[];
  /** Students who did not fit in the rooms chosen. */
  unseated: string[];
  /** Neighbouring seats that ended up with the same class. */
  clashes: number;
}

/** Deterministic shuffle, so the same input gives the same plan. */
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function generateSeating(
  students: SeatStudent[],
  rooms: SeatRoom[],
  opts: { seed?: number; shuffleWithinClass?: boolean } = {},
): SeatingResult {
  // Queue per class, largest first so the big classes are spread evenly.
  const byClass = new Map<string, string[]>();
  for (const st of students) {
    const q = byClass.get(st.className) ?? [];
    q.push(st.id);
    byClass.set(st.className, q);
  }
  if (opts.shuffleWithinClass) {
    let k = 0;
    for (const [c, q] of byClass) byClass.set(c, shuffle(q, (opts.seed ?? 7) + k++ * 31));
  }
  const classOf = new Map(students.map((s) => [s.id, s.className]));

  let waiting = students.length;
  let seatsLeft = rooms.reduce((n, r) => n + r.rows * r.cols, 0);
  let clashes = 0;
  const out: SeatingResult["rooms"] = [];

  for (const room of rooms) {
    const seats: (string | null)[][] = Array.from({ length: room.rows }, () =>
      Array<string | null>(room.cols).fill(null),
    );
    for (let r = 0; r < room.rows; r++) {
      for (let c = 0; c < room.cols; c++) {
        seatsLeft--;
        if (waiting === 0) continue;
        const left = c > 0 && seats[r]![c - 1] ? classOf.get(seats[r]![c - 1]!) : undefined;
        const front = r > 0 && seats[r - 1]![c] ? classOf.get(seats[r - 1]![c]!) : undefined;
        const classes = [...byClass.entries()].filter(([, q]) => q.length > 0);
        const ok = classes
          .filter(([cls]) => cls !== left && cls !== front)
          .sort((a, b) => b[1].length - a[1].length);
        let pick = ok[0];
        if (!pick) {
          // Nobody can sit here without a clash. Leave it empty while the
          // rooms still have more seats than students; otherwise seat the
          // biggest class and count the clash.
          if (seatsLeft + 1 > waiting) continue;
          pick = classes.sort((a, b) => b[1].length - a[1].length)[0]!;
          clashes++;
        }
        seats[r]![c] = pick[1].shift()!;
        waiting--;
      }
    }
    out.push({ roomId: room.id, seats });
  }

  const unseated = [...byClass.values()].flat();
  return { rooms: out, unseated, clashes };
}

/** Seat label as printed on a desk: row letter + column number (A1, B3…). */
export function seatLabel(row: number, col: number): string {
  let n = row;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${letters}${col + 1}`;
}

/** Same-class neighbours left/right or front/back, for a plan already made. */
export function countClashes(seats: (string | null)[][], classOf: (id: string) => string | undefined): number {
  let n = 0;
  for (let r = 0; r < seats.length; r++) {
    for (let c = 0; c < seats[r]!.length; c++) {
      const id = seats[r]![c];
      if (!id) continue;
      const me = classOf(id);
      const right = seats[r]![c + 1];
      const back = seats[r + 1]?.[c];
      if (right && classOf(right) === me) n++;
      if (back && classOf(back) === me) n++;
    }
  }
  return n;
}
