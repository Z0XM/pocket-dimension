export type DevModeAccount = {
  /** Better Auth username (normalized lowercase alphanumeric) */
  username: string;
  /** Email for display / docs; optional at runtime */
  email?: string;
  /** Short label shown in the switcher UI */
  label?: string;
};

export type DevModeConfig = {
  /** Username of the account to auto-sign-in when no session exists */
  defaultAccount: string;
  /** Allowlisted accounts that can be selected in the Dev Mode switcher */
  allowedAccounts: DevModeAccount[];
};

/**
 * Dual gate: Dev Mode is only active when both `DEV_MODE=true` and
 * `NODE_ENV=development`. Never enable in production or test.
 *
 * This monorepo uses `NODE_ENV` (see shared/utils + app `.env` files).
 * `NODE_ENV` is accepted as an alias if present.
 */
export function isDevModeEnabled(env: NodeJS.Dict<string | undefined> = Bun.env): boolean {
  const nodeEnv = env.NODE_ENV;
  const devMode = env.DEV_MODE === "true" || env.DEV_MODE === "1";
  return nodeEnv === "development" && devMode;
}

export function assertDevModeEnabled(env: NodeJS.Dict<string | undefined> = Bun.env): void {
  if (!isDevModeEnabled(env)) {
    throw new Error("Dev Mode endpoints are only available when DEV_MODE=true and NODE_ENV=development");
  }
}

/** Public account shape (no secrets) for notch / switcher UI */
export type DevModePublicAccount = {
  username: string;
  email?: string;
  label: string;
};

export function toPublicAccounts(config: DevModeConfig): DevModePublicAccount[] {
  return config.allowedAccounts.map((account) => ({
    username: account.username,
    email: account.email,
    label: account.label ?? account.username,
  }));
}

export function findAllowedAccount(config: DevModeConfig, username: string): DevModeAccount | undefined {
  const normalized = username.trim().toLowerCase();
  return config.allowedAccounts.find((a) => a.username.toLowerCase() === normalized);
}

/**
 * Build auth-service Dev Mode sign-in URL.
 * `authBaseUrl` is typically PUBLIC_BASE_AUTH_URL (e.g. http://localhost:5001).
 */
export function buildDevSignInUrl(authBaseUrl: string, options: { account?: string; redirect: string }): string {
  const base = authBaseUrl.replace(/\/$/, "");
  const url = new URL(`${base}/dev/sign-in`);
  if (options.account) {
    url.searchParams.set("account", options.account);
  }
  url.searchParams.set("redirect", options.redirect);
  return url.toString();
}

export function buildDevAccountsUrl(authBaseUrl: string): string {
  const base = authBaseUrl.replace(/\/$/, "");
  return `${base}/dev/accounts`;
}

/**
 * When Dev Mode is on and there is no session, redirect to auth-service to establish one.
 * Returns a redirect target URL, or null if no redirect is needed.
 */
export function getDevModeSessionRedirect(options: {
  authBaseUrl: string;
  appOrigin: string;
  pathname: string;
  search: string;
  hasSession: boolean;
  env?: NodeJS.Dict<string | undefined>;
}): string | null {
  if (!isDevModeEnabled(options.env) || options.hasSession) {
    return null;
  }
  const redirect = `${options.appOrigin}${options.pathname}${options.search}`;
  return buildDevSignInUrl(options.authBaseUrl, { redirect });
}
