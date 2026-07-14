/**
 * Runs Prisma CLI with monorepo root .env loaded (same paths as Nest AppModule).
 * Usage: node prisma/with-env.cjs migrate deploy
 */
const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const apiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiRoot, "../..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
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

loadEnvFile(path.join(repoRoot, ".env"));
loadEnvFile(path.join(apiRoot, ".env"));

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node prisma/with-env.cjs <prisma-command> [args...]");
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", ...args], {
  cwd: apiRoot,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
