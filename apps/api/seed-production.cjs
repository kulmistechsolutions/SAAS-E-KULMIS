/**
 * Production seed: rotates the demo tenant admin password to a strong
 * random value and creates the platform Super Admin account (if missing).
 * Run inside the deployed API container where DATABASE_URL is already set:
 *   node seed-production.cjs
 * Prints both generated passwords once — save them immediately.
 */
const { PrismaClient } = require("@prisma/client");
const { randomBytes, scryptSync } = require("node:crypto");

function hashPassword(pw) {
  const salt = randomBytes(16);
  const derived = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function genPassword() {
  return randomBytes(12).toString("base64url");
}

const prisma = new PrismaClient({
  transactionOptions: { maxWait: 120000, timeout: 120000 },
});

async function main() {
  const school = await prisma.school.findUnique({ where: { subdomain: "demo" } });
  if (!school) throw new Error('Tenant "demo" not found — run seed-admin.cjs first.');

  const adminPassword = genPassword();
  const adminHash = hashPassword(adminPassword);
  await prisma.user.update({
    where: { schoolId_username: { schoolId: school.id, username: "admin" } },
    data: { passwordHash: adminHash },
  });

  const platformUsername = "superadmin";
  const platformPassword = genPassword();
  const platformHash = hashPassword(platformPassword);
  const platformAdmin = await prisma.platformAdmin.upsert({
    where: { username: platformUsername },
    update: { passwordHash: platformHash },
    create: {
      username: platformUsername,
      name: "Platform Super Admin",
      passwordHash: platformHash,
    },
  });

  const fs = require("node:fs");
  const out = [
    `Tenant admin   -> demo / admin / ${adminPassword}`,
    `Platform admin -> ${platformAdmin.username} / ${platformPassword}`,
    "",
  ].join("\n");
  fs.writeFileSync("/tmp/production-credentials.txt", out, { mode: 0o600 });
  console.log("Credentials written to /tmp/production-credentials.txt");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
