FROM oven/bun AS build
ENV BUN_INSTALL_CACHE_DIR="/root/.cache/bun"
COPY . /app
WORKDIR /app
RUN --mount=type=cache,id=s/b6d262ac-3498-4b13-925e-0662b955481d-/root/.cache/bun,target=/root/.cache/bun bun install --frozen-lockfile
ARG VITE_SYNC_SERVER_BASE_URL
RUN bun run build --filter web

FROM caddy:alpine
COPY --from=build /app/apps/web/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /var/www
