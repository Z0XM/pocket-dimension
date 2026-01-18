import { auth } from "@pocket-dimension/auth";
import { Elysia, redirect, status, t } from "elysia";

export const authHandler = new Elysia({ name: "better-auth" })
  .post(
    "/sign-up/email",
    async ({ body }) => {
      try {
        return await auth.api.signUpEmail({ body, asResponse: true });
      } catch (error: any) {
        if (error.statusCode && error.body) {
          return status(error.statusCode, error.body);
        }
        return status(500, { error: "Something went wrong!" });
      }
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
        asResponse: true,
        body,
        headers: new Headers(headers as Record<string, string>),
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
        asResponse: true,
        body,
        headers: new Headers(headers as Record<string, string>),
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
        headers: new Headers(headers as Record<string, string>),
        asResponse: true,
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
      return await auth.api.isUsernameAvailable({ body, asResponse: true });
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
    "/get-session",
    async ({ headers }) => {
      return await auth.api.getSession({ headers: new Headers(headers as Record<string, string>) });
    },
    {
      detail: {
        summary: "Get session",
        description: "Get the current user session",
        tags: ["auth"],
      },
    }
  )
  .get(
    "/reset-password/:token",
    async ({ params, query, request }) => {
      const { token } = params;
      const { callbackURL } = query;

      // Always redirect, even if callbackURL is missing (frontend will handle error)
      if (!callbackURL) {
        // Try to extract origin from request headers as fallback
        const origin = request.headers.get("origin") || request.headers.get("referer")?.split("/").slice(0, 3).join("/") || "http://localhost:3002";
        const errorURL = new URL("/reset-password", origin);
        errorURL.searchParams.set("error", "missing_callback");
        return redirect(errorURL.toString());
      }

      // Redirect to callbackURL with token as query parameter
      const redirectURL = new URL(callbackURL);
      redirectURL.searchParams.set("token", token);

      return redirect(redirectURL.toString());
    },
    {
      params: t.Object({
        token: t.Required(t.String()),
      }),
      query: t.Object({
        callbackURL: t.Optional(t.String()),
      }),
      detail: {
        summary: "Reset password redirect",
        description: "Redirect to callbackURL with reset token",
        tags: ["auth"],
      },
    }
  )
  .post(
    "/reset-password",
    async ({ body, headers }) => {
      return await auth.api.resetPassword({
        body,
        headers: new Headers(headers as Record<string, string>),
        asResponse: true,
      });
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
      return await auth.api.signOut({
        asResponse: true,
        headers: new Headers(headers as Record<string, string>),
      });
    },
    {
      detail: {
        summary: "Sign out",
        description: "Sign out the current user and invalidate session",
        tags: ["auth"],
      },
    }
  )
  .post(
    "/forgot-password",
    async ({ body }) => {
      try {
        return await auth.api.requestPasswordReset({
          body,
          asResponse: true,
        });
      } catch (error: any) {
        if (error.statusCode && error.body) {
          return status(error.statusCode, error.body);
        }
        return status(500, { error: "Something went wrong!" });
      }
    },
    {
      body: t.Object({
        email: t.Required(t.String()),
        redirectTo: t.Optional(t.String()),
      }),
      detail: {
        summary: "Forgot password",
        description: "Request a password reset email",
        tags: ["auth"],
      },
    }
  )
  .get(
    "/verify-email",
    async ({ query, request }) => {
      const { token, callbackURL } = query;

      // Always redirect, even if callbackURL is missing (frontend will handle error)
      if (!callbackURL) {
        // Try to extract origin from request headers as fallback
        const origin = request.headers.get("origin") || request.headers.get("referer")?.split("/").slice(0, 3).join("/") || "http://localhost:3002";
        const errorURL = new URL("/verify-email", origin);
        errorURL.searchParams.set("error", "missing_callback");
        return redirect(errorURL.toString());
      }

      const redirectURL = new URL(callbackURL);

      try {
        await auth.api.verifyEmail({
          query: { token, callbackURL },
          asResponse: false,
        });

        // Success - redirect without error
        return redirect(redirectURL.toString());
      } catch (error: any) {
        // Extract error code from error message
        let errorCode = "unknown";

        if (error.statusCode && error.body) {
          let errorMessage = "";
          if (typeof error.body === "string") {
            errorMessage = error.body;
          } else if (error.body.message) {
            errorMessage = error.body.message;
          } else if (error.body.error) {
            errorMessage = error.body.error;
          }

          // Map error messages to error codes
          const messageLower = errorMessage.toLowerCase();
          if (messageLower.includes("expired")) {
            errorCode = "token_expired";
          } else if (messageLower.includes("invalid")) {
            errorCode = "token_invalid";
          } else if (messageLower.includes("already") && messageLower.includes("used")) {
            errorCode = "token_already_used";
          } else if (messageLower.includes("already") && messageLower.includes("verified")) {
            errorCode = "email_already_verified";
          } else if (messageLower.includes("not found") || messageLower.includes("user")) {
            errorCode = "user_not_found";
          }
        }

        // Redirect with error code as query parameter
        redirectURL.searchParams.set("error", errorCode);
        return redirect(redirectURL.toString());
      }
    },
    {
      query: t.Object({
        token: t.Required(t.String()),
        callbackURL: t.Optional(t.String()),
      }),
      detail: {
        summary: "Verify email",
        description: "Verify user email address using a verification token and redirect to callbackURL",
        tags: ["auth"],
      },
    }
  )
  .post(
    "/send-verification-email",
    async ({ body }) => {
      try {
        return await auth.api.sendVerificationEmail({
          body,
          asResponse: true,
        });
      } catch (error: any) {
        if (error.statusCode && error.body) {
          return status(error.statusCode, error.body);
        }
        return status(500, { error: "Something went wrong!" });
      }
    },
    {
      body: t.Object({
        email: t.Required(t.String()),
        callbackURL: t.Optional(t.String()),
      }),
      detail: {
        summary: "Send verification email",
        description: "Resend email verification link",
        tags: ["auth"],
      },
    }
  );
