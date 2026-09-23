import { auth, isDevModeEnabled } from "@pocket-dimension/auth";
import { Elysia, status } from "elysia";

/**
 * Dev Mode HTTP surface.
 * Thin wrappers around Better Auth plugin endpoints.
 * Refuse before calling auth when gates fail (defense in depth; plugin also gates).
 */
export const devHandler = new Elysia({ name: "dev-mode" })
  .get(
    "/dev/sign-in",
    async ({ request }) => {
      if (!isDevModeEnabled()) {
        return status(404, { error: "Not found" });
      }
      return auth.handler(request);
    },
    {
      detail: {
        summary: "Dev Mode sign-in",
        description: "DEV_MODE + NODE_ENV=development only. Creates a session for an allowlisted account and redirects.",
        tags: ["dev"],
      },
    }
  )
  .get(
    "/dev/accounts",
    async ({ request }) => {
      if (!isDevModeEnabled()) {
        return status(404, { error: "Not found" });
      }
      return auth.handler(request);
    },
    {
      detail: {
        summary: "Dev Mode accounts",
        description: "DEV_MODE + NODE_ENV=development only. Lists allowlisted accounts (no secrets).",
        tags: ["dev"],
      },
    }
  );
