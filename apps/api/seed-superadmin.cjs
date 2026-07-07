/**
 * Seeds a platform Super Admin (separate from any school).
 * Login: superadmin / super123   (at /api/platform/auth/login)
 * Run: node apps/api/seed-superadmin.cjs
 */
const { PrismaClient } = require("@prisma/client");
const { randomBytes, scryptSync } = require("node:crypto");

function hashPassword(pw) {
  const salt = randomBytes(16);
  const derived = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

const prisma = new PrismaClient();

async function main() {
  const passwordHash = hashPassword("super123");
  const admin = await prisma.platformAdmin.upsert({
    where: { username: "superadmin" },
    update: { passwordHash },
    create: { username: "superadmin", name: "Super Admin", passwordHash },
  });
  console.log("Platform Super Admin ready:", admin.username);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
