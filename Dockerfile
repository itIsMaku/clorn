FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy source, migrations, and assets
COPY src ./src
COPY drizzle ./drizzle
COPY assets ./assets
COPY drizzle.config.ts tsconfig.json ./

CMD ["bun", "run", "src/index.ts"]
