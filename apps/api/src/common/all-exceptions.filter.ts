import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Logger } from "nestjs-pino";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/auth.types";
import type { TenantRequest } from "../tenant/tenant-request";

interface FilteredRequest extends TenantRequest {
  user?: AuthUser;
  method: string;
  originalUrl: string;
}

/**
 * Global catch-all so every unhandled error gets a durable record — container
 * stdout is wiped on each deploy, so before this there was no way to see what
 * had actually failed for a school after the fact. Only true server errors
 * (5xx) are persisted; expected 4xx (validation, auth, not-found) stay out of
 * the log so it reflects real bugs, not routine denials.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<FilteredRequest>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const responseBody = isHttp
      ? exception.getResponse()
      : { message: "Internal server error" };
    const message =
      exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;

    if (status >= 500) {
      this.logger.error(
        { err: exception, path: req.originalUrl, method: req.method },
        "Unhandled server error",
      );
      const schoolId = req.user?.schoolId ?? req.tenant?.schoolId ?? null;
      // Fire-and-forget: logging an error must never itself crash the
      // response path, and the caller shouldn't wait on it.
      void this.prisma.errorLog
        .create({
          data: {
            schoolId,
            userId: req.user?.userId ?? null,
            role: req.user?.role ?? null,
            method: req.method,
            path: req.originalUrl,
            statusCode: status,
            message: message.slice(0, 2000),
            stack: stack?.slice(0, 8000) ?? null,
          },
        })
        .catch((e) => this.logger.error({ err: e }, "Failed to persist error log"));
    }

    res.status(status).json(
      typeof responseBody === "object"
        ? responseBody
        : { statusCode: status, message: responseBody },
    );
  }
}
