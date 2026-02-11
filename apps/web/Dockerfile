FROM nixos/nix AS base
RUN echo "experimental-features = nix-command flakes" >> /etc/nix/nix.conf;
COPY . /app
WORKDIR /app
RUN nix build .#devShells.x86_64-linux.default;

FROM base AS build
RUN nix develop --command bun install --frozen-lockfile
ARG VITE_SYNC_SERVER_BASE_URL
RUN nix develop --command bun run build --filter web


FROM base AS prod
RUN nix build .#caddy
RUN mkdir /tmp/nix-store-closure;
RUN cp -R $(nix-store -qR result/) /tmp/nix-store-closure;

FROM scratch
COPY --from=prod /tmp/nix-store-closure /nix/store
COPY --from=build /app/apps/web/dist /var/www
COPY --from=build /app/apps/web/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=prod /tmp/nix-store-closure/*caddy-*/bin/caddy /usr/local/bin/caddy
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
