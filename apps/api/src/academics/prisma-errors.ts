import { ConflictException } from "@nestjs/common";
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
