FROM oven/bun:1 AS install

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1-slim

WORKDIR /app
COPY --from=install /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src/ ./src/

USER bun
EXPOSE 8080
CMD ["bun", "src/index.ts"]
