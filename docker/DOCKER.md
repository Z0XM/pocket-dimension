# Docker Setup

This monorepo uses Docker Compose for containerized development and production deployments.

## Development

To run the project in development mode with hot-reload:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

This will:
- Build the images using the `install` stage (includes dev dependencies)
- Mount the source code as volumes for hot-reload
- Run both backend API (port 3001) and web app (port 3000)

To run in detached mode:

```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

To stop:

```bash
docker-compose -f docker-compose.dev.yml down
```

## Production

To run the project in production mode:

```bash
docker-compose up --build
```

This will:
- Build optimized production images using the `runner` stage
- Run both services with production dependencies only
- Expose backend API on port 3001 and web app on port 3000

To run in detached mode:

```bash
docker-compose up -d --build
```

To stop:

```bash
docker-compose down
```

## Services

### Backend API
- **Port**: 3001
- **Container**: `pocket-dimension-backend-api` (prod) / `pocket-dimension-backend-api-dev` (dev)
- **Dockerfile**: `apps/backend/api/Dockerfile`

### Web App
- **Port**: 3000
- **Container**: `pocket-dimension-web-z0xm` (prod) / `pocket-dimension-web-z0xm-dev` (dev)
- **Dockerfile**: `apps/web/web-z0xm/Dockerfile`

## Dockerfile Structure

Each Dockerfile uses a multi-stage build:

1. **base**: Base image with Bun
2. **install**: Full dev dependencies installation
3. **prod-deps**: Production dependencies only
4. **prerelease**: Assemble source + dev deps, run build
5. **runner**: Minimal runtime image (production)

## Environment Variables

Create a `.env` file in the root directory if you need to set environment variables:

```env
NODE_ENV=production
PORT=3001  # Backend API port
PORT=3000  # Web app port
```

## Troubleshooting

### Rebuild from scratch

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend-api
docker-compose logs -f web-z0xm
```

### Access container shell

```bash
docker-compose exec backend-api sh
docker-compose exec web-z0xm sh
```
