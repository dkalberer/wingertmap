FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/frontend/package.json ./apps/frontend/
RUN pnpm install --no-frozen-lockfile --filter frontend
COPY apps/frontend/src ./apps/frontend/src
COPY apps/frontend/public ./apps/frontend/public
COPY apps/frontend/index.html apps/frontend/tsconfig.json apps/frontend/tsconfig.tsbuildinfo apps/frontend/vite.config.ts ./apps/frontend/
RUN pnpm --filter frontend build

FROM nginx:1.27-alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
