# @pocket-dimension/env-validation

A shared package for type-safe environment variable validation using Zod.

## Installation

This package is part of the monorepo and is automatically available to all workspaces.

## Usage

### Web Apps

```typescript
import { validateWebEnvSafe } from "@pocket-dimension/env-validation/web";

// This will throw an error with helpful messages if validation fails
const env = validateWebEnvSafe();

// Now you have type-safe access to env variables
console.log(env.API_URL); // TypeScript knows this is a string
console.log(env.PORT); // TypeScript knows this is a number
console.log(env.ENABLE_FEATURE_X); // TypeScript knows this is a boolean
```

### Backend Apps

```typescript
import { validateBackendEnvSafe } from "@pocket-dimension/env-validation/backend";

// This will throw an error with helpful messages if validation fails
const env = validateBackendEnvSafe();

// Now you have type-safe access to env variables
console.log(env.DATABASE_URL); // TypeScript knows this is a string
console.log(env.DATABASE_POOL_MIN); // TypeScript knows this is a number
console.log(env.JWT_SECRET); // TypeScript knows this is a string
```

### Custom Validation

```typescript
import { validateEnvSafe } from "@pocket-dimension/env-validation";
import { z } from "zod";

const customSchema = z.object({
  CUSTOM_VAR: z.string().min(1),
  CUSTOM_NUMBER: z.string().transform(Number).pipe(z.number()),
});

const env = validateEnvSafe(customSchema);
```

## API

### `validateWebEnv(env?)`
Validates web app environment variables. Throws ZodError on failure.

### `validateWebEnvSafe(env?)`
Validates web app environment variables with formatted error messages.

### `validateBackendEnv(env?)`
Validates backend app environment variables. Throws ZodError on failure.

### `validateBackendEnvSafe(env?)`
Validates backend app environment variables with formatted error messages.

### `validateEnv(schema, env?)`
Generic validation function. Throws ZodError on failure.

### `validateEnvSafe(schema, env?)`
Generic validation function with formatted error messages.

## Environment Variables

See `.env.example` files in each app directory for the required environment variables.

