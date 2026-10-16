FROM node:24-bookworm-slim AS base
RUN npm install --global pnpm@11.25.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN pnpm install --frozen-lockfile --filter @halora/admin...
COPY apps/admin apps/admin
COPY packages/api-client packages/api-client
RUN pnpm --filter @halora/api-client build

FROM base AS development
CMD ["pnpm", "--filter", "@halora/admin", "dev", "--host", "0.0.0.0"]

FROM base AS build
RUN pnpm --filter @halora/admin build

FROM nginx:stable-alpine AS runtime
COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 8080
