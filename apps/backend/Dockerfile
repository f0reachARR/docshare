FROM node:22-alpine

WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN corepack enable && pnpm install --frozen-lockfile=false
COPY . .
RUN pnpm --filter backend build
EXPOSE 8787
CMD ["pnpm", "--filter", "backend", "start"]
