# Railpack Deployment Configuration

This project uses Railpack for deployment via Dokploy. Railpack automatically detects and builds Bun/Node.js applications.

## Overview

This monorepo contains multiple services that should be deployed as separate applications in Dokploy:

1. **Backend API** (`apps/backend/api`) - Port 5000
2. **Web App** (`apps/web/web-z0xm`) - Port 3000

## Dokploy Configuration

### For Each Service in Dokploy

When setting up each service in Dokploy:

1. **Build Type**: Select "Railpack"
2. **Railpack Version**: Use latest (or specify version like `0.15.1`)
3. **Root Directory**: Set based on the service (see below)

### Backend API Service Configuration

- **Service Name**: `backend-api` (or `pocket-dimension-backend-api`)
- **Build Type**: Railpack
- **Root Directory**: `/` (repository root - required for monorepo workspace)
- **Environment Variables**:
  ```
  RAILPACK_BUILD_CMD=bun install --frozen-lockfile && bun run --filter "@pocket-dimension/backend-api" build
  RAILPACK_START_CMD=cd apps/backend/api && bun run start
  PORT=5000
  NODE_ENV=production
  ```

### Web App Service Configuration

- **Service Name**: `web-z0xm` (or `pocket-dimension-web-z0xm`)
- **Build Type**: Railpack
- **Root Directory**: `/` (repository root - required for monorepo workspace)
- **Environment Variables**:
  ```
  RAILPACK_BUILD_CMD=bun install --frozen-lockfile && bun run --filter "@pocket-dimension/web-z0xm" build
  RAILPACK_START_CMD=cd apps/web/web-z0xm && bun run start
  PORT=3000
  NODE_ENV=production
  ```

## Environment Variables

### Common Environment Variables

Both services may need:
- `NODE_ENV=production`
- Database connection strings (if applicable)
- API keys and secrets
- Service-specific configuration

### Service-Specific Variables

**Backend API:**
- `PORT=5000` (default, can be overridden)

**Web App:**
- `PORT=3000` (default, can be overridden)

## Deployment Steps

1. **Create Applications in Dokploy**:
   - Create two separate applications in Dokploy
   - One for backend-api, one for web-z0xm

2. **Configure Build Settings**:
   - Set Build Type to "Railpack"
   - Configure the environment variables as shown above
   - Set the root directory to repository root (`/`)

3. **Deploy**:
   - Push your code to the connected Git repository
   - Dokploy will automatically build and deploy using Railpack

## How Railpack Works

Railpack automatically:
- Detects Bun runtime (from `packageManager` field in `package.json`)
- Installs dependencies using `bun install`
- Builds the project using the specified build command
- Runs the application using the specified start command

## Monorepo Considerations

Since this is a monorepo:
- The root directory must be set to `/` (repository root)
- Build commands use Turbo filters to build specific packages
- Start commands navigate to the appropriate app directory
- All workspace dependencies are available due to running from root

## Migration from Docker

The previous Docker setup has been replaced with Railpack:
- Dockerfiles are archived in `docker/` directory
- `docker-compose.yml` files are no longer used
- Railpack provides faster builds and smaller images automatically

## Troubleshooting

### Build Fails

- Ensure `RAILPACK_BUILD_CMD` includes both dependency installation and build steps
- Verify the Turbo filter names match package names in `package.json`
- Check that root directory is set to repository root

### Runtime Errors

- Verify `RAILPACK_START_CMD` correctly navigates to the app directory
- Ensure `PORT` environment variable matches your application's expected port
- Check that all required environment variables are set in Dokploy

### Workspace Resolution Issues

- Make sure root directory is set to `/` (repository root)
- Verify `package.json`, `bun.lock`, and workspace configuration are in root
- Check that `shared/` dependencies are properly included
