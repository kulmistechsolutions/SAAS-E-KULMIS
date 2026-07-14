# eKulmis API (NestJS + Prisma) — build from the monorepo root:
#   docker build -f apps/api/Dockerfile .
# Runs `prisma migrate deploy` on startup, then serves on $API_PORT (4000).

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

# Install with a warm layer cache: manifests first, then sources.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@ekulmis/api..." --filter "@ekulmis/shared"

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @ekulmis/shared build \
 && cd apps/api \
 && npx prisma generate \
 && pnpm build

FROM node:22-alpine
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production
# Full built workspace (includes the generated Prisma client + engines).
COPY --from=build /app ./

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s \
  CMD curl -fsS http://localhost:4000/health || exit 1

WORKDIR /app/apps/api
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
