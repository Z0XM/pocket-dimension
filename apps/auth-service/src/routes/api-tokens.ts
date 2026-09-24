import { createApiToken, listApiTokens, revokeApiToken } from "@pocket-dimension/auth";
import { Elysia, status, t } from "elysia";
import { authMiddleware } from "../middlewares/auth";

export const apiTokensHandler = new Elysia({ name: "api-tokens" })
  .use(authMiddleware)
  .get(
    "/api-tokens",
    async ({ user }) => {
      const tokens = await listApiTokens(user.id);
      return { tokens };
    },
    {
      authVerified: true,
      detail: {
        summary: "List API tokens",
        description: "List API tokens for the authenticated user (metadata only)",
        tags: ["api-tokens"],
      },
    }
  )
  .post(
    "/api-tokens",
    async ({ user, body }) => {
      try {
        const expiresAt = body.expiresAt === undefined || body.expiresAt === null ? null : new Date(body.expiresAt);
        if (expiresAt && Number.isNaN(expiresAt.getTime())) {
          return status(400, { error: "Invalid expiresAt" });
        }
        if (expiresAt && expiresAt.getTime() <= Date.now()) {
          return status(400, { error: "expiresAt must be in the future" });
        }

        const created = await createApiToken({
          userId: user.id,
          name: body.name,
          expiresAt,
        });
        return { token: created };
      } catch (error: any) {
        return status(400, { error: error?.message || "Failed to create API token" });
      }
    },
    {
      authVerified: true,
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        expiresAt: t.Optional(t.Union([t.String(), t.Null()])),
      }),
      detail: {
        summary: "Create API token",
        description: "Create a new API token. The raw token is returned once.",
        tags: ["api-tokens"],
      },
    }
  )
  .delete(
    "/api-tokens/:id",
    async ({ user, params }) => {
      const revoked = await revokeApiToken(user.id, params.id);
      if (!revoked) {
        return status(404, { error: "Token not found" });
      }
      return { token: revoked };
    },
    {
      authVerified: true,
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: "Revoke API token",
        description: "Revoke an API token owned by the authenticated user",
        tags: ["api-tokens"],
      },
    }
  );
