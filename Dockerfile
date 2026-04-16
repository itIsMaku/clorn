FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy source and migrations
COPY src ./src
COPY drizzle ./drizzle
COPY drizzle.config.ts tsconfig.json ./

CMD ["bun", "run", "src/index.ts"]
