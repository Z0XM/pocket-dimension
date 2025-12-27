import { auth } from "@pocket-dimension/auth";
import { Elysia, t } from "elysia";

export const authHandler = new Elysia({ name: "better-auth" })
  .post(
    "/sign-up/email",
    async ({ body }) => {
      return await auth.api.signUpEmail({ body });
    },
    {
      body: t.Object({
        email: t.Required(t.String()),
        password: t.Required(t.String()),
        name: t.Required(t.String()),
        username: t.Optional(t.String()),
      }),
      detail: {
        summary: "Sign up",
        description: "Register a new user account",
        tags: ["auth"],
      },
    }
  )
  .post(
    "/sign-in/email",
    async ({ body, headers }) => {
      return await auth.api.signInEmail({
        body,
        headers,
      });
    },
    {
      body: t.Object({
        email: t.Required(t.String()),
        password: t.Required(t.String()),
      }),
      detail: {
        summary: "Sign in with email",
        description: "Authenticate a user and create a session with email.",
        tags: ["auth"],
      },
    }
  )
  .post(
    "/sign-in/username",
    async ({ body, headers }) => {
      return await auth.api.signInUsername({
        body,
        headers,
      });
    },
    {
      body: t.Object({
        username: t.Required(t.String()),
        password: t.Required(t.String()),
      }),
      detail: {
        summary: "Sign in with username",
        description: "Authenticate a user and create a session with username.",
        tags: ["auth"],
      },
    }
  )
  .post(
    "/update-user",
    async ({ body, headers }) => {
      return await auth.api.updateUser({
        body,
        headers,
      });
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        username: t.Optional(t.String()),
      }),
      detail: {
        summary: "Update user",
        description: "Update the current user",
        tags: ["auth"],
      },
    }
  )
  .post(
    "/is-username-available",
    async ({ body }) => {
      return await auth.api.isUsernameAvailable({ body });
    },
    {
      body: t.Object({
        username: t.Required(t.String()),
      }),
      detail: {
        summary: "Check if username is available",
        description: "Check if username is available",
        tags: ["auth"],
      },
    }
  )
  .get(
    "/session",
    async ({ headers }) => {
      return await auth.api.getSession({ headers });
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
    "/reset-password",
    async ({ body, headers }) => {
      return await auth.api.resetPassword({ body, headers });
    },
    {
      body: t.Object({
        token: t.Required(t.String()),
        newPassword: t.Required(t.String()),
      }),
      detail: {
        summary: "Reset password",
        description: "Reset user password using a reset token",
        tags: ["auth"],
      },
    }
  )
  .post(
    "/sign-out",
    async ({ headers }) => {
      return await auth.api.signOut({ headers });
    },
    {
      detail: {
        summary: "Sign out",
        description: "Sign out the current user and invalidate session",
        tags: ["auth"],
      },
    }
  );
