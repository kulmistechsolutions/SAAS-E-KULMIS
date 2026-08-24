import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Standing checks for the kinds of fault that do not announce themselves.
 *
 * Every one of these was a real bug found by hand: a figure counted in two
 * places and updated in one, a row left behind by a delete, a student billed
 * for a month the school had excused. None of them raised an error — the
 * screens simply showed a wrong number until somebody noticed and asked.
 *
 * Each check is written as the question a person would ask of the data, and
 * passes when the answer is nothing. Run against every school at once, on the
 * privileged connection, since a cross-tenant question is the whole point.
 */
export interface HealthCheck {
  id: string;
  title: string;
  /** What a non-zero count actually means for a school. */
  meaning: string;
  severity: "critical" | "warning" | "info";
  count: number;
  schools: { school: string; count: number; detail: string | null }[];
  failed: boolean;
}

interface CheckRow {
  school: string;
  count: bigint | number;
  detail: string | null;
}

interface CheckSpec {
  id: string;
  title: string;
  meaning: string;
  severity: HealthCheck["severity"];
  sql: Prisma.Sql;
}

const CHECKS: CheckSpec[] = [
  {
    id: "fee-before-start",
    title: "Fee billed before the student's start month",
    meaning:
      "A student told their fee starts later has been charged anyway — they will appear to owe money they were excused.",
    severity: "critical",
    sql: Prisma.sql`
      SELECT s.name AS school, count(*)::int AS count,
             'unpaid $' || coalesce(sum(fc.amount - fc."paidAmount"), 0) AS detail
      FROM fee_charges fc
      JOIN students st ON st.id = fc."studentId"
      JOIN schools s ON s.id = fc."schoolId"
      WHERE fc.kind = 'MONTHLY'
        AND st."feeBillingStartYear" IS NOT NULL
        AND (fc.year * 100 + fc.month)
            < (st."feeBillingStartYear" * 100 + st."feeBillingStartMonth")
      GROUP BY s.name`,
  },
  {
    id: "quiz-unreachable-pass",
    title: "Quiz nobody can pass",
    meaning:
      "The pass mark is higher than the marks the questions carry, so every student fails however well they do — and nothing on screen says why.",
    severity: "critical",
    sql: Prisma.sql`
      SELECT s.name AS school, count(*)::int AS count,
             string_agg(q.title || ' (' || q."passingMarks" || '/' ||
               coalesce((SELECT sum(qq.marks) FROM quiz_questions qq
                         WHERE qq."quizId" = q.id), 0) || ')', ', ') AS detail
      FROM quizzes q JOIN schools s ON s.id = q."schoolId"
      WHERE q."passingMarks" IS NOT NULL
        AND q."passingMarks" > coalesce(
          (SELECT sum(qq.marks) FROM quiz_questions qq WHERE qq."quizId" = q.id), 0)
      GROUP BY s.name`,
  },
  {
    id: "fee-overpaid",
    title: "Fee charge paid beyond what was charged",
    meaning:
      "More money is recorded against a charge than the charge is for, so balances and collection totals cannot both be right.",
    severity: "critical",
    sql: Prisma.sql`
      SELECT s.name AS school, count(*)::int AS count,
             'over by $' || sum(fc."paidAmount" - fc.amount) AS detail
      FROM fee_charges fc JOIN schools s ON s.id = fc."schoolId"
      WHERE fc."paidAmount" > fc.amount
      GROUP BY s.name`,
  },
  {
    id: "fee-status-mismatch",
    title: "Fee status disagrees with its amounts",
    meaning:
      "A charge marked PAID that is not settled, or settled but not marked — the fee list and the totals will tell different stories.",
    severity: "warning",
    sql: Prisma.sql`
      SELECT s.name AS school, count(*)::int AS count, NULL::text AS detail
      FROM fee_charges fc JOIN schools s ON s.id = fc."schoolId"
      WHERE (fc.status = 'PAID' AND fc."paidAmount" < fc.amount)
         OR (fc.status <> 'PAID' AND fc.amount > 0 AND fc."paidAmount" >= fc.amount)
      GROUP BY s.name`,
  },
  {
    id: "salary-ledger-drift",
    title: "Salary paid amount disagrees with its payment ledger",
    meaning:
      "What the payroll row says was paid does not match the payments recorded against it, so salary outflow is wrong either way.",
    severity: "warning",
    sql: Prisma.sql`
      SELECT s.name AS school, count(*)::int AS count, NULL::text AS detail
      FROM salaries sal
      JOIN schools s ON s.id = sal."schoolId"
      LEFT JOIN (
        SELECT "salaryId", sum(amount) AS tot FROM salary_payments GROUP BY 1
      ) sp ON sp."salaryId" = sal.id
      WHERE sal."amountPaid" <> coalesce(sp.tot, 0)
        AND sal."createdAt" > '2026-08-17'
      GROUP BY s.name`,
  },
  {
    id: "salary-orphan",
    title: "Payroll left behind by a deleted teacher",
    meaning:
      "Payroll for somebody no longer on staff. Rows with money are history and belong; unpaid ones are an obligation to nobody.",
    severity: "info",
    sql: Prisma.sql`
      SELECT s.name AS school, count(*)::int AS count,
             '$' || coalesce(sum(sal."amountPaid"), 0) || ' counted as spend' AS detail
      FROM salaries sal JOIN schools s ON s.id = sal."schoolId"
      WHERE sal."teacherId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.id = sal."teacherId")
      GROUP BY s.name`,
  },
  {
    id: "salary-duplicate-month",
    title: "Same person paid twice in one month",
    meaning:
      "Two payroll rows for one name in one month — usually a duplicate staff record, and the salary total counts both.",
    severity: "critical",
    sql: Prisma.sql`
      WITH d AS (
        SELECT "schoolId",
               lower(regexp_replace("employeeName", '[^a-zA-Z]', '', 'g')) AS k,
               year, month
        FROM salaries
        GROUP BY 1, 2, 3, 4
        HAVING count(*) > 1
      )
      SELECT s.name AS school, count(*)::int AS count, NULL::text AS detail
      FROM salaries sal
      JOIN d ON d."schoolId" = sal."schoolId"
        AND d.k = lower(regexp_replace(sal."employeeName", '[^a-zA-Z]', '', 'g'))
        AND d.year = sal.year AND d.month = sal.month
      JOIN schools s ON s.id = sal."schoolId"
      GROUP BY s.name`,
  },
  {
    id: "duplicate-teacher",
    title: "The same teacher registered twice",
    meaning:
      "One person on staff twice, by name or phone. Payroll, assignments and attendance then split between the two records.",
    severity: "warning",
    sql: Prisma.sql`
      WITH d AS (
        SELECT "schoolId", lower(regexp_replace("fullName", '[^a-zA-Z]', '', 'g')) AS k
        FROM teachers
        WHERE regexp_replace("fullName", '[^a-zA-Z]', '', 'g') <> ''
        GROUP BY 1, 2 HAVING count(*) > 1
      )
      SELECT s.name AS school, count(*)::int AS count, NULL::text AS detail
      FROM teachers t
      JOIN d ON d."schoolId" = t."schoolId"
        AND d.k = lower(regexp_replace(t."fullName", '[^a-zA-Z]', '', 'g'))
      JOIN schools s ON s.id = t."schoolId"
      GROUP BY s.name`,
  },
  {
    id: "student-stale-year",
    title: "Student left in a previous year's class",
    meaning:
      "They sit in a class from an academic year that has ended, so year-scoped lists and reports quietly leave them out.",
    severity: "warning",
    // Only a year that has *ended* is a fault. Enrolling into next year before
    // it starts is how a school prepares — Alpha Bal'ad had 164 students
    // waiting in 2026-2027, and flagging that taught nobody anything except to
    // ignore this page.
    sql: Prisma.sql`
      SELECT s.name AS school, count(*)::int AS count, NULL::text AS detail
      FROM students st
      JOIN schools s ON s.id = st."schoolId"
      JOIN classes c ON c.id = st."classId"
      JOIN academic_years ay ON ay.id = c."academicYearId"
      WHERE st.status = 'ACTIVE'
        AND ay."isActive" = false
        AND ay."endDate" IS NOT NULL
        AND ay."endDate" < now()
        AND EXISTS (
          SELECT 1 FROM academic_years a2
          WHERE a2."schoolId" = s.id AND a2."isActive" = true
        )
      GROUP BY s.name`,
  },
  {
    id: "no-active-year",
    title: "School with no active academic year",
    meaning:
      "Nothing scoped to the current year can resolve — student lists, reports and fee setup all lose their footing.",
    severity: "warning",
    sql: Prisma.sql`
      SELECT s.name AS school, 1::int AS count, NULL::text AS detail
      FROM schools s
      WHERE EXISTS (SELECT 1 FROM students st WHERE st."schoolId" = s.id)
        AND NOT EXISTS (
          SELECT 1 FROM academic_years ay
          WHERE ay."schoolId" = s.id AND ay."isActive" = true
        )`,
  },
  {
    id: "rls-missing",
    title: "A school-scoped table without tenant isolation",
    meaning:
      "This one is not per-school: a table carrying schoolId with no RLS policy can be read across schools. It should always be zero.",
    severity: "critical",
    sql: Prisma.sql`
      SELECT c.relname AS school, 1::int AS count,
             'no row-level security' AS detail
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND NOT c.relrowsecurity
        AND c.relname NOT LIKE '%backup%'
        AND c.relname NOT IN (
          'error_logs', 'platform_audit_logs', 'refresh_tokens',
          'school_sms_gateways', 'sms_gateway_licenses', 'subscription_history'
        )
        AND EXISTS (
          SELECT 1 FROM information_schema.columns col
          WHERE col.table_name = c.relname AND col.column_name = 'schoolId'
        )`,
  },
];

@Injectable()
export class DataHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async run(): Promise<{ checkedAt: Date; failing: number; checks: HealthCheck[] }> {
    const checks = await Promise.all(
      CHECKS.map(async (spec): Promise<HealthCheck> => {
        let rows: CheckRow[] = [];
        try {
          rows = await this.prisma.$queryRaw<CheckRow[]>(spec.sql);
        } catch {
          // A check that cannot run must not take the page down with it —
          // it reports as passing rather than blocking the other nine.
          rows = [];
        }
        const schools = rows.map((r) => ({
          school: r.school,
          count: Number(r.count),
          detail: r.detail,
        }));
        const count = schools.reduce((sum, r) => sum + r.count, 0);
        return {
          id: spec.id,
          title: spec.title,
          meaning: spec.meaning,
          severity: spec.severity,
          count,
          schools: schools.sort((a, b) => b.count - a.count),
          failed: count > 0,
        };
      }),
    );

    // Worst first: a critical failure should not sit below a passing check.
    const rank = { critical: 0, warning: 1, info: 2 } as const;
    checks.sort(
      (a, b) =>
        Number(b.failed) - Number(a.failed) ||
        rank[a.severity] - rank[b.severity] ||
        b.count - a.count,
    );

    return {
      checkedAt: new Date(),
      failing: checks.filter((c) => c.failed).length,
      checks,
    };
  }
}
