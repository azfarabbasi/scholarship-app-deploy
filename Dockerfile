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
