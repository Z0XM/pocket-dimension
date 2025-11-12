# Pocket Dimension Monorepo

A monorepo setup using Turborepo, Bun, and Biome.

> 📦 **Deploying to Railway?** See [RAILWAY_SETUP.md](./RAILWAY_SETUP.md) for detailed setup instructions.

## Structure

```
pocket-dimension/
├── apps/
│   ├── web/          # Web applications
│   │   ├── web-z0xm/
│   │   └── web-app-2/
│   └── backend/      # Backend applications
│       ├── backend-app-1/
│       └── backend-app-2/
├── packages/         # Shared packages
│   ├── shared/
│   └── env-validation/  # Environment variable validation
└── package.json      # Root package.json
```

## Getting Started

1. Install dependencies:
   ```bash
   bun install
   ```

2. Run all apps in development mode:
   ```bash
   bun run dev
   ```

3. Build all apps:
   ```bash
   bun run build
   ```

4. Start all apps (production mode):
   ```bash
   bun run start
   ```

   Or start a specific app:
   ```bash
   cd apps/web/web-z0xm
   bun run start
   ```

5. Lint all workspaces:
   ```bash
   bun run lint
   ```

6. Format code:
   ```bash
   bun run format
   ```

7. Type check:
   ```bash
   bun run typecheck
   ```

8. Run tests:
   ```bash
   bun run test
   ```

9. Run tests with coverage:
   ```bash
   bun run test:coverage
   ```

## Tech Stack

- **Runtime & Package Manager**: Bun
- **Monorepo Tool**: Turborepo
- **Linting & Formatting**: Biome
- **Testing**: Vitest with coverage
- **Language**: TypeScript

## Testing

Tests are located in each workspace and follow these patterns:
- `*.test.ts` or `*.test.tsx` for test files
- `*.spec.ts` or `*.spec.tsx` for spec files

Coverage reports are generated in the `coverage/` directory of each workspace when running `test:coverage`.

## Environment Variables

Each app has a `.env.example` file that documents the required environment variables. Copy this file to `.env` and fill in the values:

```bash
# For web apps
cp apps/web/web-z0xm/.env.example apps/web/web-z0xm/.env

# For backend apps
cp apps/backend/backend-app-1/.env.example apps/backend/backend-app-1/.env
```

### Type-Safe Environment Validation

Use the `@pocket-dimension/env-validation` package for type-safe environment variable validation:

```typescript
// In web apps
import { validateWebEnvSafe } from "@pocket-dimension/env-validation/web";
const env = validateWebEnvSafe();

// In backend apps
import { validateBackendEnvSafe } from "@pocket-dimension/env-validation/backend";
const env = validateBackendEnvSafe();
```

See `packages/env-validation/README.md` for more details.

## Path Aliases

TypeScript path aliases are configured for easy imports across the monorepo:

```typescript
// Import from shared package
import { something } from "@pocket-dimension/shared";

// Import from env-validation package
import { validateWebEnvSafe } from "@pocket-dimension/env-validation/web";
```

Available aliases:
- `@pocket-dimension/shared` - Shared utilities and code
- `@pocket-dimension/shared/*` - Specific exports from shared package
- `@pocket-dimension/env-validation` - Environment validation utilities
- `@pocket-dimension/env-validation/*` - Specific exports from env-validation package

All workspaces have these aliases configured in their `tsconfig.json` files.

## Versioning and Releases

This monorepo uses [Changesets](https://github.com/changesets/changesets) for version management and changelog generation.

### Adding a Changeset

When you make changes that should be released, add a changeset:

```bash
bun run changeset
```

This will prompt you to select packages and describe the changes.

### Versioning

To version packages based on changesets:

```bash
bun run version
```

This updates package versions and generates changelogs.

### Release Workflow

1. Make changes and add a changeset: `bun run changeset`
2. Commit the changeset file
3. When ready to release, run `bun run version`
4. Review and commit version changes
5. The release workflow will handle publishing (if configured)

See `.changeset/README.md` for more details.
