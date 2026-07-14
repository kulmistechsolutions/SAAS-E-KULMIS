/**
 * Seeds demo tenant + administrator + default academic structure.
 * Tenant: "demo" | admin / admin123
 * Run from repo root: node apps/api/seed-admin.cjs
 */
const path = require("node:path");
const fs = require("node:fs");
const { PrismaClient } = require("@prisma/client");
const { randomBytes, scryptSync } = require("node:crypto");

// Load root .env when run via `node apps/api/seed-admin.cjs`
const envPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([^#][^=]*)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function hashPassword(pw) {
  const salt = randomBytes(16);
  const derived = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

const GRADES = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
];

const SECTIONS = ["A", "B", "C"]; // legacy demo constant (sections are no longer auto-seeded)

const SUBJECTS = [
  { name: "Mathematics", code: "MATH" },
  { name: "English", code: "ENG" },
  { name: "Science", code: "SCI" },
  { name: "Social Studies", code: "SOC" },
  { name: "Somali", code: "SOM" },
  { name: "Islamic Studies", code: "ISL" },
];

const ACADEMIC_YEARS = [
  { name: "2024-2025", active: true },
  { name: "2023-2024", active: false },
  { name: "2022-2023", active: false },
];

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
  transactionOptions: { maxWait: 120000, timeout: 120000 },
});

async function seedAcademics(schoolId) {
  // Only one active year per school (partial unique index).
  await prisma.academicYear.updateMany({
    where: { schoolId },
    data: { isActive: false },
  });

  const yearIds = new Map();

  for (const y of ACADEMIC_YEARS) {
    const year = await prisma.academicYear.upsert({
      where: { schoolId_name: { schoolId, name: y.name } },
      update: {
        startDate: new Date(`${y.name.split("-")[0]}-09-01`),
        endDate: new Date(`${y.name.split("-")[1]}-06-30`),
        isActive: false,
      },
      create: {
        schoolId,
        name: y.name,
        isActive: false,
        startDate: new Date(`${y.name.split("-")[0]}-09-01`),
        endDate: new Date(`${y.name.split("-")[1]}-06-30`),
      },
    });
    yearIds.set(y.name, year.id);
  }

  const activeYear = ACADEMIC_YEARS.find((y) => y.active)?.name ?? "2024-2025";
  await prisma.academicYear.update({
    where: { schoolId_name: { schoolId, name: activeYear } },
    data: { isActive: true },
  });

  let classesCreated = 0;

  const activeYearId = yearIds.get(activeYear);
  for (let i = 0; i < GRADES.length; i++) {
    const gradeName = GRADES[i];
    let cls = await prisma.class.findFirst({
      where: { schoolId, academicYearId: activeYearId, name: gradeName },
    });
    if (!cls) {
      cls = await prisma.class.create({
        data: {
          schoolId,
          academicYearId: activeYearId,
          name: gradeName,
          orderIndex: i + 1,
          hasSections: false,
          status: "ACTIVE",
        },
      });
      classesCreated++;
    } else if (cls.orderIndex !== i + 1) {
      await prisma.class.update({
        where: { id: cls.id },
        data: { orderIndex: i + 1 },
      });
    }
  }

  let subjectsCreated = 0;
  for (const sub of SUBJECTS) {
    const exists = await prisma.subject.findFirst({
      where: { schoolId, name: sub.name },
    });
    if (!exists) {
      await prisma.subject.create({
        data: { schoolId, name: sub.name, code: sub.code, status: "ACTIVE" },
      });
      subjectsCreated++;
    }
  }

  return { classesCreated, sectionsCreated: 0, subjectsCreated };
}

async function main() {
  const school = await prisma.school.upsert({
    where: { subdomain: "demo" },
    update: {},
    create: { subdomain: "demo", name: "Demo School" },
  });

  const passwordHash = hashPassword("admin123");
  const user = await prisma.user.upsert({
    where: { schoolId_username: { schoolId: school.id, username: "admin" } },
    update: { passwordHash, fullName: "Administrator", role: "ADMINISTRATOR" },
    create: {
      schoolId: school.id,
      username: "admin",
      fullName: "Administrator",
      role: "ADMINISTRATOR",
      passwordHash,
    },
  });

  const academics = await seedAcademics(school.id);

  console.log("Tenant:", school.subdomain, "->", school.id);
  console.log("Admin :", user.username, `(${user.role})`);
  console.log(
    "Academics:",
    `+${academics.classesCreated} classes,`,
    `+${academics.sectionsCreated} sections,`,
    `+${academics.subjectsCreated} subjects`,
  );
  console.log("Grades seeded:", GRADES.join(", "));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
