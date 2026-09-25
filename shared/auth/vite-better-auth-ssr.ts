/**
 * Vite SSR settings for apps that use `@pocket-dimension/auth`.
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

/** Externalize the package root; Vite keeps subpath imports external with it. */
export const betterAuthSsrExternal = ["better-auth"] as const;
