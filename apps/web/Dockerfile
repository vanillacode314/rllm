FROM nixos/nix AS build
COPY . /app
WORKDIR /app
RUN nix --extra-experimental-features 'nix-command flakes' develop --command bun install --frozen-lockfile
ARG VITE_SYNC_SERVER_BASE_URL
RUN nix --extra-experimental-features 'nix-command flakes' develop --command bun run build --filter web

FROM caddy:alpine
COPY --from=build /app/apps/web/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /var/www
