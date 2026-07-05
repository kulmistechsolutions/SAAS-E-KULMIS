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
}

/**
 * Global interceptor that records an audit entry after a successful:
 *   - login (principal read from the response), and
 *   - authenticated mutation (POST/PATCH/PUT/DELETE).
 * Writes are fire-and-forget so they never delay or break the response.
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
        if (user && MUTATIONS.has(method)) {
          void this.audit.record({
            schoolId: user.schoolId,
            userId: user.userId,
            username: user.username,
            role: user.role,
            module: moduleFromPath(path),
            action: `${method} ${path}`,
            ip: req.ip,
          });
        }
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
