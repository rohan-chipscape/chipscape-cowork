FROM node:22-slim AS base
# whatsapp-web.js's own "puppeteer" dependency normally downloads its own
# Chromium build on install — skip that everywhere (deps stage included)
# and use the system "chromium" package installed below in the runner
# stage instead, which pulls in its actual runtime libraries via apt's own
# dependency resolution rather than guessing which ones a slim base needs.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Chromium for whatsapp-web.js (lib/whatsapp/client.ts) to actually drive a
# real WhatsApp Web session.
RUN apt-get update && apt-get install -y --no-install-recommends chromium \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# adduser --system gives this user HOME=/nonexistent, which doesn't exist —
# Chromium's crashpad handler computes its crash-database path from $HOME,
# so with no real $HOME it refuses to start at all with
# "chrome_crashpad_handler: --database is required", even with
# --disable-crash-reporter passed as a launch arg. Give it a real, writable
# HOME.
ENV HOME=/home/nextjs
RUN mkdir -p /home/nextjs && chown nextjs:nodejs /home/nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
RUN mkdir -p .data && chown nextjs:nodejs .data

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
