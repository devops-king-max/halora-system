FROM node:24-bookworm-slim AS base
RUN npm install --global pnpm@11.25.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN pnpm install --frozen-lockfile --filter @halora/api

FROM base AS development
COPY apps/api apps/api
COPY docs/api docs/api
COPY database database
CMD ["pnpm", "--filter", "@halora/api", "dev"]

FROM development AS build
RUN pnpm --filter @halora/api build
RUN pnpm --filter @halora/api --config.inject-workspace-packages=true deploy --prod /opt/api

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /opt/api ./apps/api
COPY --chown=node:node docs/api ./docs/api
COPY --chown=node:node database ./database
RUN mkdir -p /app/.local/uploads && chown -R node:node /app/.local
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/src/main.js"]
