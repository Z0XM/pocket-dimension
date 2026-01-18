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
          console.error(`[sign-up/email] Sign up failed for email: ${body.email}`, {
            statusCode: error.statusCode,
            error: error.body,
            username: body.username || "not provided",
            callbackURL: body.callbackURL || "not provided",
          });
          return status(error.statusCode, error.body);
        }
        console.error(`[sign-up/email] Unexpected error during sign up for email: ${body.email}`, {
          error: error.message || error,
          stack: error.stack,
        });
        return status(500, { error: "Something went wrong!" });
      }
    },
    {
      body: t.Object({
        email: t.Required(t.String()),
        password: t.Required(t.String()),
        name: t.Required(t.String()),
        username: t.Optional(t.String()),
        callbackURL: t.Optional(t.String()),
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
      try {
        return await auth.api.signInEmail({
          asResponse: true,
          body,
          headers: new Headers(headers as Record<string, string>),
        });
      } catch (error: any) {
        console.error(`[sign-in/email] Sign in failed for email: ${body.email}`, {
          statusCode: error.statusCode,
          error: error.body || error.message || error,
        });
        throw error;
      }
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
      try {
        return await auth.api.signInUsername({
          asResponse: true,
          body,
          headers: new Headers(headers as Record<string, string>),
        });
      } catch (error: any) {
        console.error(`[sign-in/username] Sign in failed for username: ${body.username}`, {
          statusCode: error.statusCode,
          error: error.body || error.message || error,
        });
        throw error;
      }
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

      // Validate callbackURL - must be a valid absolute URL
      const isValidCallbackURL = callbackURL && (callbackURL.startsWith("http://") || callbackURL.startsWith("https://"));

      // Always redirect, even if callbackURL is missing or invalid (frontend will handle error)
      if (!isValidCallbackURL) {
        console.error(`[reset-password/:token] Missing or invalid callbackURL for token reset`, {
          token: token.substring(0, 8) + "...",
          callbackURL: callbackURL || "missing",
          origin: request.headers.get("origin"),
          referer: request.headers.get("referer"),
        });
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
      try {
        return await auth.api.resetPassword({
          body,
          headers: new Headers(headers as Record<string, string>),
          asResponse: true,
        });
      } catch (error: any) {
        console.error(`[reset-password] Password reset failed`, {
          statusCode: error.statusCode,
          error: error.body || error.message || error,
          token: body.token.substring(0, 8) + "...",
        });
        throw error;
      }
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
          console.error(`[forgot-password] Password reset request failed for email: ${body.email}`, {
            statusCode: error.statusCode,
            error: error.body,
            redirectTo: body.redirectTo,
          });
          return status(error.statusCode, error.body);
        }
        console.error(`[forgot-password] Unexpected error during password reset request for email: ${body.email}`, {
          error: error.message || error,
          stack: error.stack,
        });
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

      // Validate callbackURL - must be a valid absolute URL
      const isValidCallbackURL = callbackURL && (callbackURL.startsWith("http://") || callbackURL.startsWith("https://"));

      // Always redirect, even if callbackURL is missing or invalid (frontend will handle error)
      if (!isValidCallbackURL) {
        console.error(`[verify-email] Missing or invalid callbackURL for email verification`, {
          token: token?.substring(0, 8) + "...",
          callbackURL: callbackURL || "missing",
          origin: request.headers.get("origin"),
          referer: request.headers.get("referer"),
        });
        // Try to extract origin from request headers as fallback
        const origin = request.headers.get("origin") || request.headers.get("referer")?.split("/").slice(0, 3).join("/") || "http://localhost:3002";
        const errorURL = new URL("/verify-email", origin);
        errorURL.searchParams.set("error", "missing_callback");
        return redirect(errorURL.toString());
      }

      const redirectURL = new URL(callbackURL);

      try {
        const response = await auth.api.verifyEmail({
          query: { token, callbackURL },
          asResponse: true,
        });

        // Check if response is a redirect (302) - Better Auth redirects on success
        if (response instanceof Response && response.status === 302) {
          // Check if Better Auth redirected to our callbackURL (success) or somewhere else (error)
          const location = response.headers.get("location");
          if (location?.includes(callbackURL)) {
            // Verification successful - redirect to callbackURL without error
            return redirect(redirectURL.toString());
          } else {
            // Better Auth redirected elsewhere, might be an error redirect
            // Follow Better Auth's redirect
            return redirect(location || redirectURL.toString());
          }
        }

        // If not a redirect, return the response as-is
        return response;
      } catch (error: any) {
        // Handle redirect responses that are thrown as errors
        // Better Auth might throw redirects as errors in some cases
        if (error.statusCode === 302 || error.status === "FOUND") {
          // Check if there's a Location header in the error
          const location = error.headers?.get?.("location") || error.headers?.location;
          if (location?.includes(callbackURL)) {
            // Verification likely succeeded - redirect to callbackURL without error
            return redirect(redirectURL.toString());
          } else if (location) {
            // Follow Better Auth's redirect
            return redirect(location);
          }
          // Default to our callbackURL
          return redirect(redirectURL.toString());
        }

        // Extract error code from error message
        let errorCode = "unknown";
        let errorMessage = "";

        if (error.statusCode && error.body) {
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
        } else if (error.message) {
          // Try to extract error message from error.message if error.body is undefined
          const messageLower = error.message.toLowerCase();
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

        // Log full error details to understand what's happening
        console.error(`[verify-email] Email verification failed`, {
          statusCode: error.statusCode,
          status: error.status,
          errorCode,
          errorMessage: errorMessage || error.message || error,
          errorBody: error.body,
          errorHeaders: error.headers ? Object.fromEntries(error.headers.entries?.() || []) : error.headers,
          fullError: error,
          token: token.substring(0, 8) + "...",
          callbackURL,
        });

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
          console.error(`[send-verification-email] Failed to send verification email for: ${body.email}`, {
            statusCode: error.statusCode,
            error: error.body,
            callbackURL: body.callbackURL,
          });
          return status(error.statusCode, error.body);
        }
        console.error(`[send-verification-email] Unexpected error sending verification email for: ${body.email}`, {
          error: error.message || error,
          stack: error.stack,
        });
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
