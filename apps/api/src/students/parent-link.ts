/**
 * What editing the parent details on a student record should do.
 *
 * A school correcting a child registered under the wrong family types the
 * right parent's name and phone. The obvious reading of that — rewrite the
 * parent row the student points at — is wrong twice over: it renames a real
 * family for every one of their other children, and it collides with the
 * unique phone of the parent actually being named, so the save fails outright.
 *
 * Which of the four outcomes applies turns on two facts: who already holds the
 * typed phone, and whether the current parent has other children. The lookups
 * live in the service; this decides.
 */
export type ParentChange =
  /** Nothing about the parent moved. */
  | { kind: "none" }
  /** The current parent's own details were mistyped; fix them in place. */
  | { kind: "rename" }
  /** Another parent already holds this phone; the child joins that family. */
  | { kind: "attach"; parentId: string }
  /** Nobody holds this phone and siblings remain; the child needs their own. */
  | { kind: "create" };

export interface ParentChangeFacts {
  /** Id of the parent already holding the typed phone, if any. */
  holderId: string | null;
  /** The parent the student points at today. */
  currentParentId: string;
  /** Children under the current parent other than this one. */
  siblingCount: number;
  /** Whether the typed name/phone differ from what the current parent has. */
  nameChanged: boolean;
  phoneChanged: boolean;
}

export function decideParentChange(f: ParentChangeFacts): ParentChange {
  // Somebody else's phone: the child belongs to that family. Their stored name
  // stands — an existing parent is not renamed by a correction typed into one
  // of their children's records.
  if (f.holderId && f.holderId !== f.currentParentId) {
    return { kind: "attach", parentId: f.holderId };
  }

  if (!f.nameChanged && !f.phoneChanged) return { kind: "none" };

  // The phone is unchanged, or free. An only child means the parent row
  // describes this family alone, so correcting it in place is right. Siblings
  // mean the row belongs to them too, and editing it would rewrite their
  // parent as well — the very mix-up being corrected — so the child leaves
  // for a parent of their own.
  if (f.holderId || f.siblingCount === 0) return { kind: "rename" };
  return { kind: "create" };
}
