# GitHub Actions Workflows

## CI Workflow (`ci.yml`)

Runs on every push and pull request:
- **Lint and Typecheck**: Runs Biome linter and TypeScript type checking
- **Build**: Builds all workspaces using Turborepo
- **Docker Build Verification**: Verifies Docker builds for all apps (if Dockerfiles exist)

## Deploy Workflow (`deploy.yml`)

Deploys to Railway on push to main/master branch.

### Setup Instructions

1. Get your Railway token:
   - Go to Railway dashboard → Settings → Tokens
   - Create a new token

2. Get your Railway service ID(s):
   - Go to your Railway project → Settings → General
   - Copy the Service ID

3. Add GitHub Secrets:
   - Go to your GitHub repo → Settings → Secrets and variables → Actions
   - Add `RAILWAY_TOKEN` with your Railway token
   - Add `RAILWAY_SERVICE_ID` with your service ID

4. For multiple services, uncomment the `services` section in `deploy.yml` and add individual service IDs as secrets.

### Railway Auto-Deploy

Railway can also auto-deploy from GitHub. If you prefer that:
- Connect your GitHub repo in Railway dashboard
- Railway will auto-deploy on push to main
- You can disable the GitHub Actions deploy workflow if using Railway's auto-deploy

