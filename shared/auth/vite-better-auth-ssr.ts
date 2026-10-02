/**
 * Vite SSR settings for apps that use `@pocket-dimension/auth`.
 *
 * Import from `@pocket-dimension/auth/vite-ssr` in app `vite.config.ts` (workspace
 * package resolution) — do not use a relative `../../shared/auth/...` path. Relative
 * cross-root imports break Dokploy/Docker layouts the same way `../../vite-kysely-compat`
 * did.
 *
 * Better Auth request state uses AsyncLocalStorage. Bundling `better-auth` into
 * the SvelteKit SSR graph while runtime also loads it from `node_modules` creates
 * a dual-module hazard ("No request state found" / Failed to get session).
 *
 * Externalize the package so Bun/Node loads a single copy from node_modules.
 *
 * @see https://www.better-auth.com/docs/reference/faq
 */
export const betterAuthDedupe = ["better-auth", "@better-auth/core", "@better-auth/utils", "better-call"] as const;

/** Externalize so Bun/Node load a single copy from node_modules (no dual-module hazard). */
export const betterAuthSsrExternal = ["better-auth", "@pocket-dimension/auth"] as const;
