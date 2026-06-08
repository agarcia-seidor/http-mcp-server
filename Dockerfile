FROM node:26-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN npm install -g pnpm@10.14.0

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY . ./

RUN pnpm build && pnpm prune --prod

FROM node:26-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV MCP_NAME=mcp-mock

WORKDIR /app

COPY --chown=node:node package.json ./
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]
