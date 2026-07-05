/**
 * Seeds a demo tenant + administrator so login can be tested.
 * Tenant subdomain: "demo" | username: "admin" | password: "admin123"
 * Run: node apps/api/seed-admin.cjs
 */
const { PrismaClient } = require("@prisma/client");
const { randomBytes, scryptSync } = require("node:crypto");

function hashPassword(pw) {
  const salt = randomBytes(16);
  const derived = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

const prisma = new PrismaClient({
  transactionOptions: { maxWait: 120000, timeout: 120000 },
});

async function main() {
  const school = await prisma.school.upsert({
    where: { subdomain: "demo" },
    update: {},
    create: { subdomain: "demo", name: "Demo School" },
  });

  const passwordHash = hashPassword("admin123");
  const user = await prisma.user.upsert({
    where: { schoolId_username: { schoolId: school.id, username: "admin" } },
    update: { passwordHash },
    create: {
      schoolId: school.id,
      username: "admin",
      role: "ADMINISTRATOR",
      passwordHash,
    },
  });

  console.log("Tenant:", school.subdomain, "->", school.id);
  console.log("Admin :", user.username, `(${user.role})`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
