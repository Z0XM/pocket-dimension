FROM oven/bun:latest AS base
WORKDIR /app

# Copy package files for dependency installation
COPY package.json bun.lock ./
COPY apps/web/web-z0xm/package.json ./apps/web/web-z0xm/
COPY apps/backend/api/package.json ./apps/backend/api/

# Copy packages directory for workspace dependencies
COPY packages ./packages

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build --filter=@pocket-dimension/web-z0xm

# Set working directory to the app
WORKDIR /app/apps/web/web-z0xm

# Expose port (Railway/Docker will set PORT env var)
EXPOSE 3000

# Start the server
CMD ["bun", "run", "start"]
