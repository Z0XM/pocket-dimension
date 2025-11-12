# Railway Configuration File Options

Complete reference for all available options in `railway.json` or `railway.toml` configuration files.

## Schema

```json
{
  "$schema": "https://railway.app/railway.schema.json"
}
```

## Build Section (`build`)

### `builder`
**Type:** `string`
**Options:**
- `RAILPACK` (default) - Railway's automatic build system
- `DOCKERFILE` - Use a Dockerfile for building
- `NIXPACKS` (deprecated) - Legacy build system

**Example:**
```json
{
  "build": {
    "builder": "DOCKERFILE"
  }
}
```

### `buildCommand`
**Type:** `string`
**Description:** Override the default build command detected by the builder.

**Example:**
```json
{
  "build": {
    "buildCommand": "bun run build --filter=@pocket-dimension/web-z0xm"
  }
}
```

### `dockerfilePath`
**Type:** `string`
**Description:** Path to a custom Dockerfile (relative to service root directory). Only used when `builder` is `DOCKERFILE`.

**Example:**
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  }
}
```

### `watchPatterns`
**Type:** `array<string>`
**Description:** Gitignore-style patterns to conditionally trigger deployments based on file changes. Only deploys when matching files change.

**Example:**
```json
{
  "build": {
    "watchPatterns": ["src/**", "package.json"]
  }
}
```

## Deploy Section (`deploy`)

### `startCommand`
**Type:** `string`
**Description:** Command to start your application. Overrides the default start command.

**Example:**
```json
{
  "deploy": {
    "startCommand": "bun run start"
  }
}
```

### `preDeployCommand`
**Type:** `array<string>`
**Description:** Commands to run before deployment starts (e.g., database migrations).

**Example:**
```json
{
  "deploy": {
    "preDeployCommand": ["bun run db:migrate", "bun run seed"]
  }
}
```

### `healthcheckPath`
**Type:** `string`
**Description:** Endpoint path for health checks. Railway will ping this endpoint to verify service health.

**Example:**
```json
{
  "deploy": {
    "healthcheckPath": "/health"
  }
}
```

### `healthcheckTimeout`
**Type:** `number`
**Description:** Timeout in seconds for health check responses. Default is typically 100 seconds.

**Example:**
```json
{
  "deploy": {
    "healthcheckTimeout": 100
  }
}
```

### `restartPolicyType`
**Type:** `string`
**Options:**
- `ALWAYS` - Always restart the service
- `ON_FAILURE` - Restart only when the service fails
- `NEVER` - Never restart the service

**Example:**
```json
{
  "deploy": {
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### `restartPolicyMaxRetries`
**Type:** `number`
**Description:** Maximum number of restart attempts when using `ON_FAILURE` restart policy.

**Example:**
```json
{
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Complete Example

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile",
    "buildCommand": "bun run build",
    "watchPatterns": ["src/**", "package.json"]
  },
  "deploy": {
    "startCommand": "bun run start",
    "preDeployCommand": ["bun run db:migrate"],
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## TOML Format Example

If you prefer TOML format (`railway.toml`):

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"
buildCommand = "bun run build"
watchPatterns = ["src/**", "package.json"]

[deploy]
startCommand = "bun run start"
preDeployCommand = ["bun run db:migrate"]
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

## Additional Environment Variables

These can be set in Railway dashboard or via environment variables (not in config file):

- `RAILPACK_PACKAGES` - List of Mise packages to install
- `RAILPACK_BUILD_APT_PACKAGES` - Additional Apt packages during build
- `RAILPACK_DEPLOY_APT_PACKAGES` - Additional Apt packages in final image
- `RAILPACK_INSTALL_COMMAND` - Override install command
- `NO_CACHE` - Set to `1` to disable build layer caching

## Notes

- Configuration files override dashboard settings
- Files must be in the service root directory (or specify absolute path in dashboard)
- For monorepos, each service should have its own `railway.json` in its root directory
- The `$schema` field enables autocomplete in supported editors

## References

- [Railway Config as Code Documentation](https://docs.railway.com/reference/config-as-code)
- [Railway Build Configuration Guide](https://docs.railway.com/guides/build-configuration)
