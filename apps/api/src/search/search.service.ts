import { Injectable } from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";

export interface SearchHit {
  id: string;
  type: string;
  label: string;
}

export interface SearchOptions {
  types?: string[];
  limit?: number;
  /**
   * Classes the viewer may look at, or null for the whole school. Set for an
   * attendance officer, whose student list is limited to the registers they
   * were assigned.
   */
  classIds?: string[] | null;
  /** Students the viewer may look at, or null for no such limit (teachers). */
  studentIds?: string[] | null;
}

export type SearchType = "student" | "teacher" | "parent";

/**
 * What each role may find in the search box.
 *
 * The box searched students, teachers and parents for every staff role, which
 * walked straight around the fences on the pages themselves: an attendance
 * officer holding one register could type a letter and read back the whole
 * school's children, its staff, and its parents' phone numbers. A shortcut
 * must not reach further than the page it is a shortcut to.
 *
 * Teachers and parents are separated deliberately. A finance officer needs to
 * find the parent who is paying and the employee being paid; an exam manager
 * needs neither, and a librarian needs only the child holding the book.
 */
export function searchableTypesForRole(role: string): SearchType[] {
  switch (role) {
    case UserRole.ADMINISTRATOR:
    case UserRole.SUPER_ADMINISTRATOR:
    case UserRole.RECEPTION_OFFICER:
    case UserRole.RECEPTION:
      return ["student", "teacher", "parent"];
    case UserRole.FINANCE_OFFICER:
      return ["student", "teacher", "parent"];
    case UserRole.ACADEMIC_MANAGER:
      return ["student", "teacher"];
    case UserRole.EXAM_MANAGER:
      return ["student", "teacher"];
    // Both hold a slice of the school, and the slice is applied on top of
    // this by the caller: an officer's assigned classes, a teacher's own
    // students. Neither has any business in the staff or parent directory.
    case UserRole.ATTENDANCE_OFFICER:
    case UserRole.TEACHER:
    case UserRole.LIBRARIAN:
      return ["student"];
    default:
      return [];
  }
}

@Injectable()
export abstract class SearchService {
  abstract search(
    schoolId: string,
    query: string,
    options?: SearchOptions,
  ): Promise<SearchHit[]>;
}
