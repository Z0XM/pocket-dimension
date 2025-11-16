FROM oven/bun:1.3.1 AS base
WORKDIR /app

# Copy package files for dependency installation
COPY package.json bun.lock ./
COPY apps/backend/reminder/package.json ./apps/backend/reminder/
COPY apps/web/web-z0xm/package.json ./apps/web/web-z0xm/
COPY apps/backend/api/package.json ./apps/backend/api/

# Copy packages directory for workspace dependencies
COPY packages ./packages

# Copy workspace config files that Bun might need
COPY turbo.json ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Set working directory to the app
WORKDIR /app/apps/backend/reminder

# Run the script (Railway cron will execute this)
CMD ["bun", "run", "start"]
