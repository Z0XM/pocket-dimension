# Railway Monorepo Configuration Guide

Step-by-step guide to configure Railway for your monorepo with multiple services.

## Prerequisites

- Railway account (sign up at [railway.app](https://railway.app))
- GitHub repository connected to Railway
- Your monorepo structure:
  ```
  pocket-dimension/
  ├── apps/
  │   ├── web/web-z0xm/
  │   └── backend/api/
  ├── packages/
  └── package.json
  ```

## Step-by-Step Setup

### Step 1: Create a Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository (`pocket-dimension`)
5. Railway will create a project and connect your repository

### Step 2: Create Service for Web App

1. In your Railway project, click **"New Service"**
2. Select **"GitHub Repo"** (if not already connected)
3. Choose your repository

4. **Configure the Service:**
   - **Service Name**: `web-z0xm` (or any name you prefer)
   - **Root Directory**: `apps/web/web-z0xm`
     - This tells Railway where your app code is located
   - Railway will automatically detect:
     - `railway.json` configuration file
     - `Dockerfile` in the app directory

5. **Environment Variables** (if needed):
   - Go to the service → **Variables** tab
   - Add any environment variables your app needs
   - Reference: `apps/web/web-z0xm/.env.example` (if exists)

### Step 3: Create Service for Backend API

1. In the same Railway project, click **"New Service"** again
2. Select **"GitHub Repo"**
3. Choose the same repository

4. **Configure the Service:**
   - **Service Name**: `backend-api` (or any name you prefer)
   - **Root Directory**: `apps/backend/api`
   - Railway will automatically detect:
     - `railway.json` configuration file
     - `Dockerfile` in the app directory

5. **Environment Variables** (if needed):
   - Go to the service → **Variables** tab
   - Add any environment variables your API needs
   - Reference: `apps/backend/api/.env.example` (if exists)

### Step 4: Verify Configuration

Each service should have:

✅ **Root Directory** set correctly:
- Web app: `apps/web/web-z0xm`
- Backend API: `apps/backend/api`

✅ **railway.json** detected automatically:
- Located in each app directory
- Configures Dockerfile builder and watch patterns

✅ **Dockerfile** detected automatically:
- Located in each app directory
- Handles monorepo dependencies correctly

## How It Works

### Automatic Detection

Railway automatically detects:

1. **Configuration Files** (`railway.json`):
   ```json
   {
     "build": {
       "builder": "DOCKERFILE",
       "dockerfilePath": "Dockerfile",
       "watchPatterns": [...]
     }
   }
   ```

2. **Dockerfiles**:
   - Each app has its own Dockerfile
   - Dockerfiles handle monorepo structure:
     - Copy root `package.json` and `bun.lock`
     - Copy all app `package.json` files
     - Copy shared `packages/` directory
     - Install dependencies from monorepo root
     - Build using Turborepo filters

### Watch Patterns

The `watchPatterns` in `railway.json` ensure deployments only trigger when relevant files change:

- `src/**` - App source code
- `package.json` - App dependencies
- `Dockerfile` - Build configuration
- `../../package.json` - Root dependencies
- `../../packages/**` - Shared packages

### Build Process

When you push to your connected branch:

1. Railway detects changes via watch patterns
2. For each service:
   - Reads `railway.json` configuration
   - Uses Dockerfile to build the app
   - Dockerfile handles monorepo dependencies
   - Deploys the built application

## Configuration Files Reference

### Web App (`apps/web/web-z0xm/railway.json`)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile",
    "watchPatterns": [
      "src/**",
      "package.json",
      "Dockerfile",
      "tsconfig.json",
      "../../package.json",
      "../../bun.lock",
      "../../packages/**"
    ]
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Backend API (`apps/backend/api/railway.json`)

Same structure as web app, located in `apps/backend/api/`

## Dockerfile Structure

Each Dockerfile is designed for monorepo:

```dockerfile
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

# Expose port
EXPOSE 3000

# Start the server
CMD ["bun", "run", "start"]
```

## Environment Variables

### Setting Environment Variables

1. Go to your service in Railway dashboard
2. Click on the service
3. Go to **Variables** tab
4. Click **"New Variable"**
5. Add each variable:
   - **Name**: `PORT` (example)
   - **Value**: `3000` (example)

### Recommended Variables

**Web App:**
- `PORT` - Port number (default: 3000)
- `NODE_ENV` - `production`
- Any app-specific variables from `.env.example`

**Backend API:**
- `PORT` - Port number (default: 3001)
- `NODE_ENV` - `production`
- Any API-specific variables from `.env.example`

## Deployment Flow

```
GitHub Push
    ↓
Railway detects changes (via watchPatterns)
    ↓
For each service:
    ↓
Read railway.json
    ↓
Build using Dockerfile
    ↓
Deploy application
    ↓
Service is live!
```

## Troubleshooting

### Service Not Deploying

1. **Check Root Directory:**
   - Ensure it's set to the correct app directory
   - Web: `apps/web/web-z0xm`
   - Backend: `apps/backend/api`

2. **Check Watch Patterns:**
   - Verify files you changed match the patterns
   - Check `railway.json` in each app directory

3. **Check Dockerfile:**
   - Ensure Dockerfile exists in app directory
   - Verify it copies all necessary files

### Build Fails

1. **Lockfile Issues:**
   - Ensure `bun.lock` is committed
   - Dockerfile copies `bun.lock` from root

2. **Missing Dependencies:**
   - Verify Dockerfile copies all `package.json` files
   - Check that shared packages are copied

3. **Build Command:**
   - Verify Turborepo filter syntax
   - Check package names match workspace names

### Service Not Starting

1. **Check Port:**
   - Ensure `PORT` environment variable is set
   - Verify app listens on the correct port

2. **Check Start Command:**
   - Verify `dist/index.js` exists after build
   - Check that `bun run start` works locally

3. **Check Logs:**
   - View service logs in Railway dashboard
   - Look for error messages

## Best Practices

1. **Separate Services:**
   - Each app should be a separate Railway service
   - This allows independent scaling and configuration

2. **Use Configuration Files:**
   - Keep `railway.json` in each app directory
   - Version control your deployment settings

3. **Watch Patterns:**
   - Only deploy when relevant files change
   - Reduces unnecessary builds and costs

4. **Environment Variables:**
   - Never commit secrets
   - Use Railway's Variables tab for sensitive data

5. **Test Locally:**
   - Test Docker builds locally before pushing
   - Verify `bun run build` works from monorepo root

## Quick Reference

### Service Configuration Checklist

For each service:

- [ ] Root directory set correctly
- [ ] `railway.json` exists in app directory
- [ ] `Dockerfile` exists in app directory
- [ ] Environment variables configured
- [ ] Service connected to GitHub repository
- [ ] Watch patterns configured in `railway.json`

### File Locations

```
pocket-dimension/
├── apps/
│   ├── web/
│   │   └── web-z0xm/
│   │       ├── railway.json    ← Service config
│   │       ├── Dockerfile      ← Build config
│   │       └── src/
│   └── backend/
│       └── api/
│           ├── railway.json    ← Service config
│           ├── Dockerfile      ← Build config
│           └── src/
├── packages/
└── package.json
```

## Next Steps

1. ✅ Create Railway project
2. ✅ Create service for web app
3. ✅ Create service for backend API
4. ✅ Configure environment variables
5. ✅ Push code to trigger first deployment
6. ✅ Verify both services are running

Your monorepo is now configured for Railway! 🚀
