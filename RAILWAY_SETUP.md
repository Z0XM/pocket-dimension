# Railway Setup Guide

This guide explains how to set up Railway deployment for your monorepo.

## What is Railway?

Railway is a deployment platform that can automatically deploy your applications from GitHub. The command you saw (`railway link -p 34d7727b-0646-40f5-a4cc-280f38cd5b50`) is Railway's way of linking your local project to a Railway project.

## Why Use Railway Link?

The `railway link` command connects your local repository to a Railway project. However, for a monorepo with multiple services, you have two options:

1. **Auto-deploy from GitHub** (Recommended) - Railway watches your GitHub repo and deploys automatically
2. **Manual linking** - Link each service separately for local development/testing

## Setup Options

### Option 1: GitHub Auto-Deploy (Recommended)

This is the easiest and most common approach:

1. **Install Railway CLI** (optional, for local testing):
   ```bash
   npm i -g @railway/cli
   # or
   bun add -g @railway/cli
   ```

2. **Connect GitHub Repository in Railway Dashboard**:
   - Go to your Railway project dashboard
   - Click "New" → "GitHub Repo"
   - Select your repository
   - Railway will automatically detect your services

3. **Configure Each Service**:
   For each app (web-app-1, web-app-2, backend-app-1, backend-app-2):
   - Create a new service in Railway
   - Connect it to your GitHub repo
   - Set the root directory (e.g., `apps/web/web-app-1`)
   - Configure build and start commands
   - Add environment variables

4. **Set up Environment Variables**:
   - Copy values from `.env.example` files
   - Add them in Railway dashboard for each service

### Option 2: Manual Linking (For Local Development)

If you want to test deployments locally or use Railway CLI:

```bash
# Install Railway CLI
npm i -g @railway/cli
# or
bun add -g @railway/cli

# Login to Railway
railway login

# Link to your project (use the project ID from Railway dashboard)
railway link -p 34d7727b-0646-40f5-a4cc-280f38cd5b50

# For each service, you'll need to:
# 1. Create a service in Railway dashboard
# 2. Link to that specific service
railway link
```

## Monorepo Configuration

Since you have multiple apps, you'll need to configure each one separately in Railway:

### For Web Apps

1. **Create a service** in Railway for each web app
2. **Set Root Directory**: `apps/web/web-app-1` (or `web-app-2`)
3. **Build Command**: `cd ../.. && bun install && bun run build --filter=@pocket-dimension/web-app-1`
4. **Start Command**: Depends on your framework (e.g., `bun run start` or `node dist/index.js`)

### For Backend Apps

1. **Create a service** in Railway for each backend app
2. **Set Root Directory**: `apps/backend/backend-app-1` (or `backend-app-2`)
3. **Build Command**: `cd ../.. && bun install && bun run build --filter=@pocket-dimension/backend-app-1`
4. **Start Command**: `bun run start` or `node dist/index.js`

## Railway Configuration Files

You can create `railway.json` or `railway.toml` files in each app directory for Railway-specific settings:

### Example: `apps/web/web-app-1/railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd ../.. && bun install && bun run build --filter=@pocket-dimension/web-app-1"
  },
  "deploy": {
    "startCommand": "bun run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Environment Variables

For each service in Railway:

1. Go to the service settings
2. Click "Variables"
3. Add all variables from the corresponding `.env.example` file
4. Set production values (never commit these!)

## Docker Deployment (Alternative)

If you prefer Docker (which you mentioned earlier):

1. **Create Dockerfiles** for each app:
   - `apps/web/web-app-1/Dockerfile`
   - `apps/web/web-app-2/Dockerfile`
   - `apps/backend/backend-app-1/Dockerfile`
   - `apps/backend/backend-app-2/Dockerfile`

2. **Railway will automatically detect Dockerfiles** and use them for deployment

3. **Example Dockerfile** (for a Bun app):
   ```dockerfile
   FROM oven/bun:latest AS base
   WORKDIR /app

   # Install dependencies
   COPY package.json bun.lock ./
   COPY apps/web/web-app-1/package.json ./apps/web/web-app-1/
   COPY packages ./packages
   RUN bun install --frozen-lockfile

   # Copy source code
   COPY . .

   # Build
   RUN bun run build --filter=@pocket-dimension/web-app-1

   # Run
   WORKDIR /app/apps/web/web-app-1
   CMD ["bun", "run", "start"]
   ```

## GitHub Actions Integration

We've already set up a GitHub Actions workflow (`.github/workflows/deploy.yml`) that can deploy to Railway. To use it:

1. **Get Railway Token**:
   - Go to Railway Dashboard → Settings → Tokens
   - Create a new token

2. **Get Service IDs**:
   - For each service, go to Settings → General
   - Copy the Service ID

3. **Add GitHub Secrets**:
   - Go to your GitHub repo → Settings → Secrets and variables → Actions
   - Add `RAILWAY_TOKEN` with your Railway token
   - Add service IDs as secrets (e.g., `RAILWAY_WEB_APP_1_SERVICE_ID`)

4. **Update deploy.yml** if needed to use multiple service IDs

## Recommended Approach

For a monorepo, I recommend:

1. **Use GitHub Auto-Deploy** (easiest)
   - Connect repo in Railway dashboard
   - Configure each service separately
   - Railway handles deployments automatically

2. **Use Docker** (if you want more control)
   - Create Dockerfiles for each app
   - Railway will build and deploy from Dockerfiles
   - Better for complex build processes

3. **Skip the `railway link` command** unless you need local testing
   - The link command is mainly for local development/testing
   - For production, GitHub auto-deploy is better

## Next Steps

1. Decide on deployment method (GitHub auto-deploy or Docker)
2. Create services in Railway dashboard for each app
3. Configure build/start commands for each service
4. Add environment variables
5. Test deployment

## Troubleshooting

- **Build fails**: Check that root directory and build commands are correct
- **Service not found**: Make sure you've created the service in Railway dashboard first
- **Environment variables missing**: Add them in Railway dashboard → Service → Variables
- **Monorepo issues**: Ensure build commands use Turborepo filters correctly
