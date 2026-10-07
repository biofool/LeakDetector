# backend/Dockerfile — build TS, ship prod-only deps. Same image runs
# api (default CMD), worker, and migrate via command override.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations
RUN npx tsc

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY migrations ./dist/migrations
CMD ["node", "dist/src/index.js"]
