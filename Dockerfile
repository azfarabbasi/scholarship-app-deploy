# syntax=docker/dockerfile:1

FROM node:22-alpine AS development

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Require the committed npm lockfile so every image receives the same dependency
# graph. Create writable mount points before dropping root privileges.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit --no-fund \
    && npm cache clean --force \
    && mkdir -p /app/.next \
    && chown -R node:node /app

COPY --chown=node:node . .

USER node

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

# ---------------------------------------------------------------------------
# Production image — three stages so the final image never contains
# devDependencies (typescript, tailwindcss, eslint, test tooling, ...) or the
# raw source tree, only the built `.next` output, `public/`, `next.config.ts`,
# and a production-only `node_modules`. A naive single `npm ci --omit=dev`
# before `next build` would actually break the build: `typescript` and
# `tailwindcss`/`postcss` (needed by `next build` itself) live in
# devDependencies, not dependencies — see package.json.
# ---------------------------------------------------------------------------

# deps: every dependency (prod + dev), used only to build.
FROM node:22-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# builder: compiles the app using the full dependency set above.
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# production: minimal runtime image — prod-only node_modules plus just the
# build output, never the raw TypeScript source or dev tooling.
FROM node:22-alpine AS production
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --omit=dev && npm cache clean --force

COPY --chown=node:node --from=builder /app/next.config.ts ./next.config.ts
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/.next ./.next

USER node

EXPOSE 3000

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
