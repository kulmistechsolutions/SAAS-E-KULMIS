/**
 * A student's S/N: their place in their class register.
 *
 * Counted within the class, in the order students took their place in it,
 * with the ID as the tie-break (IDs are issued in registration order, so a
 * batch imported in one instant still numbers in sheet order). A new student
 * goes to the end; a deleted one closes the gap behind them.
 *
 * Computed, not stored: a stored number has to be rewritten for everyone
 * after a deletion, and every path that moves a student — the form, a
 * promotion, a transfer, an import — would have to remember to do it.
 */
export interface RosterRow {
  id: string;
  classId: string;
  rosterAt: Date;
  code: string;
}

/** Compare IDs the way a person reads them: STU0009 before STU0010. */
export function compareCodes(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function rosterRanks(rows: RosterRow[]): Map<string, number> {
  const byClass = new Map<string, RosterRow[]>();
  for (const r of rows) {
    const list = byClass.get(r.classId);
    if (list) list.push(r);
    else byClass.set(r.classId, [r]);
  }
  const out = new Map<string, number>();
  for (const list of byClass.values()) {
    list.sort(
      (a, b) =>
        a.rosterAt.getTime() - b.rosterAt.getTime() || compareCodes(a.code, b.code),
    );
    list.forEach((r, i) => out.set(r.id, i + 1));
  }
  return out;
}

/**
 * Give a group of students who joined a class in the same instant moments of
 * their own, a millisecond apart, in the order their IDs already put them.
 *
 * An import can enter a whole sheet in one instant, and then the ID is what
 * orders them. That is fine until one of them is replaced by a student with a
 * new ID: the newcomer would take the old moment but sort by their own,
 * higher ID — to the end of the group, not into the place they were given.
 * Spreading the group first makes each place a moment of its own, so taking
 * the moment takes exactly the place. Nobody's S/N changes in doing it.
 */
export function spreadTies(
  base: Date,
  group: { id: string; code: string }[],
): Map<string, Date> {
  const sorted = [...group].sort((a, b) => compareCodes(a.code, b.code));
  return new Map(sorted.map((g, i) => [g.id, new Date(base.getTime() + i)]));
}
