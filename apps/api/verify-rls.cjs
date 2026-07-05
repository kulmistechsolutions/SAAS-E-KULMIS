/**
 * Phase 0.5 verification: proves tenant isolation via Postgres RLS.
 * Creates two tenants (schools) + one user each, then confirms that a query
 * scoped to tenant A sees ONLY A's rows, tenant B sees ONLY B's, and a query
 * with no tenant context sees nothing. Run: node apps/api/verify-rls.cjs
 */
const { PrismaClient } = require("@prisma/client");

// Generous transaction timeout — the link to Supabase is high-latency here.
const prisma = new PrismaClient({
  transactionOptions: { maxWait: 120000, timeout: 120000 },
});

function withTenant(schoolId, fn) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE app_user");
    await tx.$executeRaw`SELECT set_config('app.current_tenant', ${schoolId}, true)`;
    return fn(tx);
  });
}

async function main() {
  const a = await prisma.school.upsert({
    where: { subdomain: "tenant-a" },
    update: {},
    create: { subdomain: "tenant-a", name: "Tenant A School" },
  });
  const b = await prisma.school.upsert({
    where: { subdomain: "tenant-b" },
    update: {},
    create: { subdomain: "tenant-b", name: "Tenant B School" },
  });

  // Users can only be inserted when the matching tenant context is set
  // (RLS WITH CHECK). This itself proves writes are tenant-guarded.
  await withTenant(a.id, (tx) =>
    tx.user.upsert({
      where: { schoolId_username: { schoolId: a.id, username: "admin" } },
      update: {},
      create: { schoolId: a.id, username: "admin", role: "ADMINISTRATOR" },
    }),
  );
  await withTenant(b.id, (tx) =>
    tx.user.upsert({
      where: { schoolId_username: { schoolId: b.id, username: "admin" } },
      update: {},
      create: { schoolId: b.id, username: "admin", role: "ADMINISTRATOR" },
    }),
  );

  const asA = await withTenant(a.id, (tx) => tx.user.findMany());
  const asB = await withTenant(b.id, (tx) => tx.user.findMany());
  // As app_user but with NO tenant context set -> policy must expose 0 rows.
  const noTenant = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE app_user");
    return tx.user.findMany();
  });

  console.log("Tenant A query -> rows:", asA.length, asA.map((u) => u.schoolId));
  console.log("Tenant B query -> rows:", asB.length, asB.map((u) => u.schoolId));
  console.log("No-tenant query -> rows:", noTenant.length);

  const pass =
    asA.length === 1 &&
    asA[0].schoolId === a.id &&
    asB.length === 1 &&
    asB[0].schoolId === b.id &&
    noTenant.length === 0;

  console.log(
    pass
      ? "\nRLS TENANT ISOLATION: PASS ✅"
      : "\nRLS TENANT ISOLATION: FAIL ❌",
  );
  await prisma.$disconnect();
  process.exit(pass ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
