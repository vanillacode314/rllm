FROM oven/bun:latest AS build
COPY . /app
WORKDIR /app
RUN bun ci
ARG VITE_SYNC_SERVER_BASE_URL
ARG VITE_MODE
RUN bun run build --filter rllm


FROM caddy:alpine
COPY --from=build /app/apps/web/rllm/dist /var/www
COPY --from=build /app/apps/web/rllm/caddy/Caddyfile /etc/caddy/Caddyfile
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
