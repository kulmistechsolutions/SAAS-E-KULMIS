# eKulmis — Production Deploy (Hostinger VPS + Coolify)

Multi-tenant School ERP. One deployment serves every school via wildcard
subdomains: `school1.YOURDOMAIN.com`, `school2.YOURDOMAIN.com`, …

## 1. DNS (do this first)

At your DNS provider, point at the VPS IP:

| Record | Name | Value |
|--------|------|-------|
| A | `@` | VPS IP |
| A | `*` (wildcard) | VPS IP |
| A | `api` | VPS IP |

Wildcard SSL needs a **DNS-01 challenge** — in Coolify set up the Let's
Encrypt DNS provider integration (Hostinger DNS API or move DNS to
Cloudflare, which Coolify supports directly).

## 2. Coolify resources (on the VPS)

1. **PostgreSQL 16** (Coolify resource) — this replaces Supabase in prod.
   Note the internal connection URL.
2. **Redis 7** (Coolify resource) — cache/queues.
3. Optional: keep Supabase Storage for uploads (works fine remotely), or add
   a **MinIO** resource and set the `MINIO_*` env vars instead.

> Why move off the Supabase pooler? Measured 2–9 s/query from the VPS-to-
> Supabase path. A local Postgres on the same box is sub-millisecond — this
> is the single biggest speed win.

## 3. Applications (Coolify → New Resource → Dockerfile)

Both build from the **repo root** (set Build Context = `/`).

### API
- Dockerfile: `apps/api/Dockerfile`
- Domain: `api.YOURDOMAIN.com`, port `4000`
- Env vars (Runtime):
  - `NODE_ENV=production`
  - `DATABASE_URL=postgresql://…` (Coolify Postgres URL)
  - `DIRECT_URL=` same as DATABASE_URL
  - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — generate:
    `openssl rand -hex 48` (NEVER the dev defaults)
  - `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=7d`
  - `APP_ROOT_DOMAIN=YOURDOMAIN.com`
  - `REDIS_ENABLED=true`, `REDIS_URL=redis://…`
  - Storage: either `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` +
    `SUPABASE_STORAGE_BUCKET`, or the `MINIO_*` set.
- Migrations run automatically on start (`prisma migrate deploy`).

### Web
- Dockerfile: `apps/web/Dockerfile`
- Domains: `YOURDOMAIN.com` **and** `*.YOURDOMAIN.com`, port `3000`
- **Build args** (not runtime — Next.js inlines them):
  - `NEXT_PUBLIC_API_URL=https://api.YOURDOMAIN.com`
  - `NEXT_PUBLIC_APP_ROOT_DOMAIN=YOURDOMAIN.com`
- The web client resolves each school's tenant from the browser subdomain
  at runtime; one build serves all schools.

## 4. First boot

1. Deploy API → watch logs for `migrate deploy` success.
2. Seed the platform super-admin (run once inside the API container):
   `node seed-admin.cjs` (or create via your existing seed flow).
3. Create schools from `https://YOURDOMAIN.com/platform` (Super Admin).
4. Enter the OpenAI key at `/platform/ai` (quiz AI grading).

## 5. Production hardening checklist

- [ ] Strong `JWT_*` secrets set (dev defaults are `*_change_me`)
- [ ] `DEFAULT_TEACHER_PASSWORD` ("12345") — force password change on first
      login, or switch resets to random generated passwords
- [ ] Postgres automated backups (Coolify scheduled backup → S3/offsite)
- [ ] Rate limiting on `/api/auth/*` (e.g. @nestjs/throttler) before launch
- [ ] CORS: restrict API origins to `https://*.YOURDOMAIN.com`
- [ ] Rotate any API keys that were ever shared in chat/screenshots

## 6. Scaling path to ~10k schools

Phased — do NOT buy everything up front:

| Phase | Schools | Setup |
|-------|---------|-------|
| 1 | 0–200 | 1 VPS (8 GB / 4 vCPU): Coolify + Postgres + Redis + both apps |
| 2 | 200–1k | Move Postgres to its own VPS (16 GB), add PgBouncer (transaction pooling), 2× API containers behind Coolify's proxy |
| 3 | 1k–5k | Managed/dedicated Postgres (32–64 GB) + read replica; 3–6 API replicas; Redis caching of dashboards; move uploads fully to object storage |
| 4 | 5k–10k | Partition heaviest tables by `schoolId` hash or shard tenants across 2–3 Postgres clusters (the RLS-per-tenant design ports cleanly); CDN in front of web |

Architecture notes that already work in your favor:
- Every table is keyed + indexed by `schoolId` with Postgres RLS enforced
  per-transaction (`forTenant`) — tenant isolation is DB-level, so sharding
  later is a routing change, not a rewrite.
- Keep an eye on `forTenant` transaction volume: each request = 1 interactive
  transaction. With local Postgres this is fast; PgBouncer must stay in
  **transaction** pool mode.

## 7. Useful commands

```bash
# build images locally to test
docker build -f apps/api/Dockerfile -t ekulmis-api .
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_APP_ROOT_DOMAIN=example.com \
  -t ekulmis-web .

# one-off DB shell in prod
docker exec -it <postgres> psql -U ekulmis ekulmis
```
