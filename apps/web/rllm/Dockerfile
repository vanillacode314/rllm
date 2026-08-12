FROM oven/bun:latest AS build
COPY . /app
WORKDIR /app
RUN --mount=type=cache,id=s/b6d262ac-3498-4b13-925e-0662b955481d-/root/.bun/install/cache,target=/root/.bun/install/cache \
    bun ci;
ARG VITE_SYNC_SERVER_BASE_URL
ARG VITE_MODE

RUN bun run build --filter rllm


FROM caddy:alpine
COPY --from=build /app/apps/web/rllm/dist /var/www
COPY --from=build /app/apps/web/rllm/caddy/Caddyfile /etc/caddy/Caddyfile
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
