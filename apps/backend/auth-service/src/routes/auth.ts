import { auth } from "@pocket-dimension/auth";
import { Elysia } from "elysia";

export const authHandler = new Elysia({ name: "better-auth" })
  .post(
    "/api/auth/sign-up",
    async ({ request }) => {
      return auth.handler(request);
    },
    {
      detail: {
        summary: "Sign up",
        description: "Register a new user account",
        tags: ["auth"],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", description: "User email address" },
                  password: { type: "string", description: "User password" },
                  name: { type: "string", description: "User name" },
                  username: { type: "string", description: "Username" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
      },
    }
  )
  .post(
    "/api/auth/sign-in",
    async ({ request }) => {
      return auth.handler(request);
    },
    {
      detail: {
        summary: "Sign in",
        description: "Authenticate a user and create a session. Can use either email or username.",
        tags: ["auth"],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    type: "object",
                    properties: {
                      email: { type: "string", description: "User email address" },
                      password: { type: "string", description: "User password" },
                    },
                    required: ["email", "password"],
                  },
                  {
                    type: "object",
                    properties: {
                      username: { type: "string", description: "Username" },
                      password: { type: "string", description: "User password" },
                    },
                    required: ["username", "password"],
                  },
                ],
              },
            },
          },
        },
      },
    }
  )
  .post(
    "/api/auth/sign-out",
    async ({ request }) => {
      return auth.handler(request);
    },
    {
      detail: {
        summary: "Sign out",
        description: "Sign out the current user and invalidate session",
        tags: ["auth"],
      },
    }
  )
  .get(
    "/api/auth/session",
    async ({ request }) => {
      return auth.handler(request);
    },
    {
      detail: {
        summary: "Get session",
        description: "Get the current user session",
        tags: ["auth"],
      },
    }
  )
  .post(
    "/api/auth/forget-password",
    async ({ request }) => {
      return auth.handler(request);
    },
    {
      detail: {
        summary: "Forget password",
        description: "Request a password reset email",
        tags: ["auth"],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", description: "User email address" },
                },
                required: ["email"],
              },
            },
          },
        },
      },
    }
  )
  .post(
    "/api/auth/reset-password",
    async ({ request }) => {
      return auth.handler(request);
    },
    {
      detail: {
        summary: "Reset password",
        description: "Reset user password using a reset token",
        tags: ["auth"],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  token: { type: "string", description: "Password reset token" },
                  password: { type: "string", description: "New password" },
                },
                required: ["token", "password"],
              },
            },
          },
        },
      },
    }
  )
  .get(
    "/api/auth/verify-email",
    async ({ request }) => {
      return auth.handler(request);
    },
    {
      detail: {
        summary: "Verify email",
        description: "Verify user email address using a verification token",
        tags: ["auth"],
        parameters: [
          {
            name: "token",
            in: "query",
            required: true,
            description: "Email verification token",
            schema: { type: "string" },
          },
        ],
      },
    }
  )
  .post(
    "/api/auth/resend-verification-email",
    async ({ request }) => {
      return auth.handler(request);
    },
    {
      detail: {
        summary: "Resend verification email",
        description: "Resend email verification link",
        tags: ["auth"],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", description: "User email address" },
                },
                required: ["email"],
              },
            },
          },
        },
      },
    }
  );
