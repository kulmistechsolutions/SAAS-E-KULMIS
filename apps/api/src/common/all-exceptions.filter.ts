import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { Prisma } from "@prisma/client";
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
    // A handful of Prisma failures are ordinary outcomes of concurrent use,
    // not bugs: two people submitting the same form at once, or deleting a
    // record someone else just deleted. Services that expect them map these
    // themselves with a specific message (see prisma-errors.ts); this is the
    // net for the ones that don't, so a routine collision stops being a 500
    // and stops filling the error log with noise.
    const known = !isHttp ? mapPrismaError(exception) : null;

    const status = isHttp
      ? exception.getStatus()
      : (known?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    const responseBody = isHttp
      ? exception.getResponse()
      : { statusCode: status, message: known?.message ?? "Internal server error" };
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

/**
 * The Prisma error codes that mean "someone else got there first", mapped to
 * the status that actually describes them. Messages stay generic on purpose —
 * the ones a user should read are raised at the call site, where the code
 * knows which field collided.
 */
function mapPrismaError(
  e: unknown,
): { status: number; message: string } | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return null;
  switch (e.code) {
    case "P2002":
      return {
        status: HttpStatus.CONFLICT,
        message: "That record already exists.",
      };
    case "P2025":
      return {
        status: HttpStatus.NOT_FOUND,
        message: "That record no longer exists.",
      };
    case "P2003":
      return {
        status: HttpStatus.CONFLICT,
        message: "Other records still depend on this one.",
      };
    default:
      return null;
  }
}
