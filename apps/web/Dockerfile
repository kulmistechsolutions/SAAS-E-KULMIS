# eKulmis Web (Next.js standalone) — build from the monorepo root:
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
#     --build-arg NEXT_PUBLIC_APP_ROOT_DOMAIN=example.com .
# NEXT_PUBLIC_* values are inlined at BUILD time — set them as build args
# (in Coolify: Build Variables), not runtime env.

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@ekulmis/web..." --filter "@ekulmis/shared"

COPY packages/shared packages/shared
COPY apps/web apps/web

# @ekulmis/shared resolves via package.json "main": "./dist/index.js" — it must
# be compiled before Next.js (webpack module resolution needs dist/ to exist
# even though transpilePackages re-transpiles the source for bundling).
RUN pnpm --filter @ekulmis/shared build

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_ROOT_DOMAIN
ARG NEXT_PUBLIC_TENANT_SUBDOMAIN=demo
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_ROOT_DOMAIN=$NEXT_PUBLIC_APP_ROOT_DOMAIN \
    NEXT_PUBLIC_TENANT_SUBDOMAIN=$NEXT_PUBLIC_TENANT_SUBDOMAIN \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @ekulmis/web build

FROM node:22-alpine
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
  CMD curl -fsS http://localhost:3000/login || exit 1

CMD ["node", "apps/web/server.js"]
