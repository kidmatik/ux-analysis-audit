# Production image: Next.js app + Chromium for live URL and demo-account capture.
# Mount a persistent volume at /data (SQLite database and uploaded/captured screens).
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-color-emoji ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production \
    PORT=3000 \
    CHROMIUM_PATH=/usr/bin/chromium \
    DATABASE_URL=file:/data/app.db \
    STORAGE_DIR=/data/uploads

EXPOSE 3000
# NEXTAUTH_URL falls back to the URL Render assigns, so no manual step is needed there.
CMD ["sh", "-c", "export NEXTAUTH_URL=${NEXTAUTH_URL:-$RENDER_EXTERNAL_URL}; mkdir -p /data/uploads && npx prisma db push --skip-generate && npx next start -p ${PORT}"]
