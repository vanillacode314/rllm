FROM nixos/nix AS base
COPY . /app
WORKDIR /app

FROM base AS build
RUN nix --extra-experimental-features 'nix-command flakes' develop --command bun install --frozen-lockfile
ARG DATABASE_CONNECTION_URL
ARG DATABASE_AUTH_TOKEN
RUN nix --extra-experimental-features 'nix-command flakes' develop --command bun run build --filter app

FROM base
COPY --from=build /app/apps/app/dist /dist
CMD [ "nix", "--extra-experimental-features", "nix-command flakes", "develop", "--command", "bun", "run", "/dist/index.js" ]
