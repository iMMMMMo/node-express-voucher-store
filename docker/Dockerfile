# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "npx prisma generate --schema prisma/schema.prisma && npx prisma migrate deploy --schema prisma/schema.prisma && node scripts/seed.js && node app.js"]
