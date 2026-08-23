# API Contracts — auth-service

**Base:** `http://localhost:5001` (`PORT`). Path prefix from `BETTER_AUTH_PATH` (usually `/`).

Swagger UI: `GET /swagger`.

## App

| Method | Path | Auth | Response |
| --- | --- | --- | --- |
| GET | `/health` | No | `{ status: "ok" }` |
| GET | `/check` | Session | `{ user, session }` |

## Auth (`apps/auth-service/src/routes/auth.ts`)

| Method | Path | Better Auth API |
| --- | --- | --- |
| POST | `/sign-up/email` | `signUpEmail` (optional username, callbackURL) |
| POST | `/sign-in/email` | `signInEmail` |
| POST | `/sign-in/username` | `signInUsername` |
| POST | `/update-user` | `updateUser` (session) |
| POST | `/is-username-available` | `isUsernameAvailable` |
| GET | `/get-session` | `getSession` |
| GET | `/reset-password/:token` | Redirect helper to callbackURL |
| POST | `/reset-password` | `resetPassword` |
| POST | `/sign-out` | `signOut` |
| POST | `/forgot-password` | `requestPasswordReset` |
| GET | `/verify-email` | `verifyEmail` (query token, callbackURL) |
| POST | `/send-verification-email` | `sendVerificationEmail` |

Cookies are Better Auth session cookies (`secure`, `sameSite=none`). CORS allows credentials.

## Gap (backlog)

Magic-link is configured in `shared/auth` (`magicLink` plugin). **auth-service has no Elysia handlers** for it. Tracked as a monorepo-wide future task: [deferred-work.md](./implementation-artifacts/deferred-work.md).
