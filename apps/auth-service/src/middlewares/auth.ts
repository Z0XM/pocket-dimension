import { auth } from "@pocket-dimension/auth";
import { Elysia } from "elysia";

export const authMiddleware = new Elysia({ name: "better-auth" }).macro({
  auth: {
    async resolve({ status, request: { headers } }) {
      const session = await auth.api.getSession({
        headers,
      });
      if (!session) return status(401);
      return {
        user: session.user,
        session: session.session,
      };
    },
  },
  // Auth macro that also requires email verification
  authVerified: {
    async resolve({ status, request: { headers } }) {
      const session = await auth.api.getSession({
        headers,
      });
      if (!session) return status(401);
      if (!session.user.emailVerified) {
        return status(403, { error: "Email not verified. Please verify your email to access this feature." });
      }
      return {
        user: session.user,
        session: session.session,
      };
    },
  },
});
