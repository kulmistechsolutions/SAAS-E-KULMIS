import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

/** Maps a Prisma unique-constraint violation (P2002) to a 409 Conflict. */
export function onUniqueViolation(message: string) {
  return (e: unknown): never => {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new ConflictException(message);
    }
    throw e;
  };
}

/**
 * Maps a Prisma "record to delete/update does not exist" error (P2025) to a
 * 404. Without this, a delete that loses a race — the record already got
 * removed by a duplicate/double-submitted request between the existence
 * check and the delete itself — surfaces as an unhandled 500 instead of a
 * clean "already gone" response.
 */
export function onRecordNotFound(message: string) {
  return (e: unknown): never => {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      throw new NotFoundException(message);
    }
    throw e;
  };
}
