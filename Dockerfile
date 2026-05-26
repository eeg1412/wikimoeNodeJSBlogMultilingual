FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS builder
COPY admin/package.json admin/yarn.lock ./admin/
COPY server/package.json server/yarn.lock ./server/
RUN yarn --cwd admin install --frozen-lockfile
RUN yarn --cwd server install --frozen-lockfile

COPY admin ./admin
COPY server ./server

RUN yarn --cwd admin build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

COPY --from=builder /app/server /app

RUN chmod +x /app/entrypoint.sh && \
    mkdir -p /app/log /app/backups /app/cache /app/public /app/ailog /app/secret /app/utils/ip2location

EXPOSE 3016
CMD ["/app/entrypoint.sh"]