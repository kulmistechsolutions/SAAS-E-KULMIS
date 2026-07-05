# eKulmis — Enterprise School Management ERP (multi-tenant SaaS)

A multi-tenant SaaS that digitalizes school operations, academics, finance, and
administration. Built to serve many schools (target ~10k) from one platform, each
with isolated data and branding.

See [`MASTER_PRD.md`](./MASTER_PRD.md) for the full product spec and the plan
file for the phased delivery roadmap.

## Stack

- **Frontend:** Next.js 15 · React 19 · TypeScript · Tailwind · shadcn/ui ·
  TanStack Query/Table · React Hook Form · Zod
- **Backend:** NestJS · Prisma · PostgreSQL (PgBouncer) · Redis · BullMQ · MinIO ·
  Socket.IO
- **Multi-tenancy:** shared DB + `schoolId` on every table + Postgres RLS +
  tenant-context middleware (Phase 0.5)
- **Ops:** Docker · Coolify (→ Kubernetes later) · GitHub Actions

## Monorepo layout

```
apps/
  api/        NestJS backend (+ Prisma schema)
  web/        Next.js 15 frontend
packages/
  shared/     Zod schemas & types shared by api + web
```

## Prerequisites

- Node.js >= 20 (tested on 25)
- pnpm 11 (`npm install -g pnpm`)
- Docker Desktop (for Postgres / Redis / MinIO / PgBouncer)

## Getting started

```bash
# 1. Install deps
pnpm install

# 2. Env
cp .env.example .env        # then edit secrets

# 3. Start infrastructure (needs Docker)
docker compose up -d

# 4. Prisma client + first migration
pnpm --filter @ekulmis/api exec prisma generate
pnpm --filter @ekulmis/api exec prisma migrate dev --name init

# 5. Run everything (turbo)
pnpm dev
```

- Web: http://localhost:3000
- API health: http://localhost:4000/health
- MinIO console: http://localhost:9001

## Scripts (root, via Turbo)

| Command | Description |
|---|---|
| `pnpm dev` | Run api + web (+ shared watch) |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run tests |
