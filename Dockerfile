# Multi-stage production Dockerfile for MillLedger

# ── Stage 1: Build Environment ──────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.18.0 --activate

# Copy manifest and workspace definitions
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application source files
COPY shared/ ./shared/
COPY client/ ./client/
COPY server/ ./server/
COPY tsconfig.json ./

# Generate Prisma Client & Build all workspace packages
RUN pnpm --filter @mill-ledger/server exec prisma generate && \
    pnpm build

# ── Stage 2: Production Runtime ─────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=4000

# Create non-root application user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 millapp

RUN corepack enable && corepack prepare pnpm@12.18.0 --activate

# Copy production artifacts and generated clients
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/client/dist ./client/dist

# Set ownership to unprivileged user
RUN chown -R millapp:nodejs /app

USER millapp

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health || exit 1

CMD ["node", "server/dist/index.js"]
