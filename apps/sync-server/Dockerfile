FROM oven/bun:alpine AS build
COPY . /app
WORKDIR /app
RUN bun ci;
ARG DATABASE_CONNECTION_URL
ARG DATABASE_AUTH_TOKEN
RUN bun run build --filter sync-server;

FROM oven/bun:alpine
COPY --from=build /app/apps/sync-server/dist /dist
CMD [ "bun", "run", "/dist/index.js" ]
