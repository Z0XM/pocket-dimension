FROM oven/bun:latest AS base
WORKDIR /app

# Copy package files for dependency installation
COPY package.json bun.lock ./
COPY apps/web/web-app-1/package.json ./apps/web/web-app-1/

# Copy packages directory for workspace dependencies
COPY packages ./packages

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build --filter=@pocket-dimension/web-app-1

# Set working directory to the app
WORKDIR /app/apps/web/web-app-1

# Expose port (Railway will set PORT env var)
EXPOSE 3000

# Start the server
CMD ["bun", "run", "start"]
