import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { UsersService } from "./users.service";

/**
 * Each school has exactly one Super Administrator — its owner account, made
 * when the school was set up. daaris switched its own owner account off from
 * the users list; an Administrator could equally have demoted, locked or
 * deleted it. None of that may happen, and no one may make a second one.
 */
const OWNER = { id: "owner", role: "SUPER_ADMINISTRATOR" };
const STAFF = { id: "staff", role: "ADMINISTRATOR" };

function service(target: { id: string; role: string }) {
  const tx = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ ...target, schoolId: "s" }),
      update: jest.fn().mockImplementation(({ data }) => ({ ...target, ...data })),
      delete: jest.fn(),
    },
  };
  const prisma = {
    forTenant: (_s: string, fn: (t: typeof tx) => unknown) => fn(tx),
    refreshToken: { updateMany: jest.fn() },
  };
  const policy = { assertAllowed: jest.fn() };
  return { svc: new UsersService(prisma as never, policy as never), tx };
}

describe("the school's owner account", () => {
  it("cannot be switched off or locked, even by the owner", async () => {
    for (const status of ["INACTIVE", "LOCKED"] as const) {
      const { svc, tx } = service(OWNER);
      await expect(svc.update("s", "owner", { status }, "owner")).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.user.update).not.toHaveBeenCalled();
    }
  });

  it("cannot be given another role", async () => {
    const { svc } = service(OWNER);
    await expect(
      svc.update("s", "owner", { role: "ADMINISTRATOR" as never }, "owner"),
    ).rejects.toThrow(BadRequestException);
  });

  it("cannot be put on a school role", async () => {
    const { svc } = service(OWNER);
    await expect(
      svc.update("s", "owner", { customRoleId: "r1" }, "owner"),
    ).rejects.toThrow(BadRequestException);
  });

  it("lets the owner save their own name with the role sent back unchanged", async () => {
    const { svc, tx } = service(OWNER);
    await svc.update(
      "s",
      "owner",
      { fullName: "Daaris", role: "SUPER_ADMINISTRATOR" as never, status: "ACTIVE" },
      "owner",
    );
    expect(tx.user.update).toHaveBeenCalled();
  });

  it("cannot be changed, reset or deleted by an Administrator", async () => {
    const { svc, tx } = service(OWNER);
    await expect(svc.update("s", "owner", { fullName: "x" }, "staff")).rejects.toThrow(
      ForbiddenException,
    );
    await expect(svc.resetPassword("s", "owner", "Secret123!", "staff")).rejects.toThrow(
      ForbiddenException,
    );
    await expect(svc.remove("s", "owner", "staff")).rejects.toThrow(ForbiddenException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it("cannot be deleted by the owner either", async () => {
    const { svc } = service(OWNER);
    await expect(svc.remove("s", "owner", "owner")).rejects.toThrow(ForbiddenException);
  });
});

describe("making another Super Administrator", () => {
  it("is refused when promoting a staff account", async () => {
    const { svc, tx } = service(STAFF);
    await expect(
      svc.update("s", "staff", { role: "SUPER_ADMINISTRATOR" as never }, "owner"),
    ).rejects.toThrow(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("is refused when creating a user", () => {
    const controller = readFileSync(join(__dirname, "users.controller.ts"), "utf8");
    expect(controller).toContain("!ASSIGNABLE_STAFF_ROLES.includes(parsed.data.role)");
  });
});

describe("anyone's own account", () => {
  it("cannot be switched off by its own user", async () => {
    const { svc } = service(STAFF);
    await expect(
      svc.update("s", "staff", { status: "INACTIVE" }, "staff"),
    ).rejects.toThrow(BadRequestException);
  });

  it("other staff can still be switched off as before", async () => {
    const { svc, tx } = service(STAFF);
    await svc.update("s", "staff", { status: "INACTIVE" }, "owner");
    expect(tx.user.update).toHaveBeenCalled();
  });
});
