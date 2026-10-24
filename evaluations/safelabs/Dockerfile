FROM node:22.14.0-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY . .
ENV DATABASE_URL=postgresql://build-only@localhost/unused DIRECT_URL=postgresql://build-only@localhost/unused
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @stealth-trails-bank/api exec prisma generate
RUN pnpm --filter @stealth-trails-bank/api... --workspace-concurrency=1 run build

FROM node:22.14.0-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/config ./packages/config
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/packages/types ./packages/types
COPY --from=builder /app/packages/security ./packages/security
COPY --from=builder /app/packages/contracts-sdk ./packages/contracts-sdk
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
WORKDIR /app/apps/api
USER node
CMD ["node", "dist/ai/evaluation/main.js"]
