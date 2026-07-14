import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { AuditService } from "./audit.service";
import type { AuthUser } from "../auth/auth.types";

const MUTATIONS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

interface AuditableRequest {
  method: string;
  path?: string;
  originalUrl?: string;
  ip?: string;
  user?: AuthUser;
  body?: Record<string, unknown>;
}

/**
 * Global interceptor that records an audit entry after a successful:
 *   - login (principal read from the response),
 *   - authenticated mutation (POST/PATCH/PUT/DELETE), and
 *   - a small allow-list of auditable GETs (e.g. Excel template downloads).
 *
 * Known paths get a friendly action name (MARKS_ENTERED, ATTENDANCE_RECORDED…)
 * and the class/section/subject/exam context is captured into metadata so the
 * audit trail reads the way the PRD describes. Writes are fire-and-forget so
 * they never delay or break the response.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuditableRequest>();
    const method = req.method;
    const path = req.path ?? req.originalUrl ?? "";

    return next.handle().pipe(
      tap((body: unknown) => {
        if (path.endsWith("/auth/login") && isLoginResponse(body)) {
          const u = body.user;
          void this.audit.record({
            schoolId: u.schoolId,
            userId: u.id,
            username: u.username,
            role: u.role,
            module: "auth",
            action: "LOGIN",
            ip: req.ip,
          });
          return;
        }

        const user = req.user;
        if (!user) return;

        const auditableGet =
          method === "GET" && GET_ACTIONS.some((r) => r.test.test(path));
        if (!MUTATIONS.has(method) && !auditableGet) return;

        const metadata = extractMetadata(req.body);
        void this.audit.record({
          schoolId: user.schoolId,
          userId: user.userId,
          username: user.username,
          role: user.role,
          module: moduleFromPath(path),
          action: friendlyAction(method, path),
          ip: req.ip,
          ...(Object.keys(metadata).length ? { metadata } : {}),
        });
      }),
    );
  }
}

interface LoginResponse {
  user: { id: string; username: string; role: AuthUser["role"]; schoolId: string };
}

function isLoginResponse(body: unknown): body is LoginResponse {
  return (
    !!body &&
    typeof body === "object" &&
    "user" in body &&
    !!(body as LoginResponse).user?.id
  );
}

function moduleFromPath(path: string): string {
  const m = /^\/api\/([^/]+)/.exec(path);
  return m ? m[1] : "app";
}

/** Auditable GET endpoints (downloads etc.) that would otherwise be skipped. */
const GET_ACTIONS: { test: RegExp; action: string }[] = [
  { test: /\/marks\/template$/, action: "EXCEL_DOWNLOADED" },
  { test: /\/transcript\/pdf$/, action: "REPORT_PRINTED" },
  { test: /\/results\/matrix\/export\/pdf$/, action: "RESULTS_PDF_EXPORTED" },
  { test: /\/results\/matrix\/export\/xlsx$/, action: "RESULTS_EXCEL_EXPORTED" },
];

/** Map a (method, path) to a human-readable audit action. */
const ACTION_RULES: { method?: string; test: RegExp; action: string }[] = [
  { method: "POST", test: /\/auth\/logout$/, action: "LOGOUT" },
  { method: "POST", test: /\/marks\/import$/, action: "MARKS_IMPORTED" },
  { method: "GET", test: /\/marks\/template$/, action: "EXCEL_DOWNLOADED" },
  { method: "POST", test: /\/subjects\/[^/]+\/submit$/, action: "MARKS_SUBMITTED" },
  { method: "POST", test: /\/examinations\/marks$/, action: "MARKS_ENTERED" },
  { method: "POST", test: /\/monitoring\/remind$/, action: "EXAM_REMINDER_SENT" },
  { method: "PATCH", test: /\/teacher-lock$/, action: "EXAM_TEACHER_LOCK_CHANGED" },
  { method: "PATCH", test: /\/student-portal$/, action: "EXAM_PORTAL_PUBLISH_CHANGED" },
  { method: "PATCH", test: /\/examinations\/[^/]+\/status$/, action: "EXAM_STATUS_CHANGED" },
  { method: "POST", test: /\/examinations\/[^/]+\/publish$/, action: "EXAM_RESULTS_PUBLISHED" },
  { method: "POST", test: /\/student-attendance\/mark$/, action: "ATTENDANCE_RECORDED" },
  { method: "POST", test: /\/teacher-attendance\/mark$/, action: "ATTENDANCE_RECORDED" },
  { method: "POST", test: /\/quiz\/[^/]+\/publish$/, action: "QUIZ_PUBLISHED" },
  { method: "POST", test: /\/quiz\/[^/]+\/close$/, action: "QUIZ_CLOSED" },
  { method: "PATCH", test: /\/quiz\//, action: "QUIZ_UPDATED" },
  { method: "POST", test: /\/quiz$/, action: "QUIZ_CREATED" },
  { method: "POST", test: /\/change-password$/, action: "PASSWORD_CHANGED" },
  { method: "POST", test: /\/reset-password$/, action: "PASSWORD_RESET" },
  { method: "POST", test: /\/examinations$/, action: "EXAM_CREATED" },
  { method: "POST", test: /\/teacher-assignments(\/bulk)?$/, action: "ASSIGNMENT_CREATED" },
];

function friendlyAction(method: string, path: string): string {
  for (const r of ACTION_RULES) {
    if ((!r.method || r.method === method) && r.test.test(path)) return r.action;
  }
  return `${method} ${path}`;
}

/** Pull the class/section/subject/exam context from a request body, if present. */
function extractMetadata(
  body: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const key of [
    "classId",
    "sectionId",
    "subjectId",
    "examId",
    "academicYearId",
    "date",
    "locked",
    "published",
    "sms",
    "email",
  ]) {
    const v = body[key];
    if (typeof v === "string" && v) out[key] = v;
    if (typeof v === "boolean") out[key] = v;
  }
  return out;
}
