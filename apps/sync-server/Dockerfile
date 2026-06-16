FROM ghcr.io/lix-project/lix:latest AS base
RUN echo "experimental-features = nix-command flakes" >> /etc/nix/nix.conf;
COPY . /app
WORKDIR /app
RUN nix build .#devShells.x86_64-linux.default;

FROM base AS build
RUN nix develop --command bun install --frozen-lockfile;
ARG DATABASE_CONNECTION_URL
ARG DATABASE_AUTH_TOKEN
RUN nix develop --command bun run build --filter sync-server;

FROM base AS prod
RUN nix build .#bun
RUN mkdir /tmp/nix-store-closure;
RUN cp -R $(nix-store -qR result/) /tmp/nix-store-closure;

FROM scratch
COPY --from=prod /tmp/nix-store-closure /nix/store
COPY --from=build /app/apps/sync-server/dist /dist
COPY --from=prod /tmp/nix-store-closure/*bun-*/bin/bun /usr/local/bin/bun

CMD [ "/usr/local/bin/bun", "run", "/dist/index.js" ]
