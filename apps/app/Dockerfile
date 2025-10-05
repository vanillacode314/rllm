FROM oven/bun AS base
ENV BUN_INSTALL_CACHE_DIR="/root/.cache/bun"

FROM base as build
COPY . /app
WORKDIR /app
RUN --mount=type=cache,id=s/9198bc32-97e7-4be3-944b-cb5f323ddbb4-/root/.cache/bun,target=/root/.cache/bun bun install --frozen-lockfile
ARG DATABASE_CONNECTION_URL
ARG DATABASE_AUTH_TOKEN
RUN bun run build --filter app

FROM base
COPY --from=build /app/apps/app/dist /dist
CMD [ "bun", "run", "/dist/index.js" ]
