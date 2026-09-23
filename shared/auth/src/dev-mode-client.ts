/**
 * Browser-safe Dev Mode helpers (no Node builtins).
 * Import from `@pocket-dimension/auth/dev-mode` in Svelte components.
 */
export {
  buildDevAccountsUrl,
  buildDevSignInUrl,
  isDevModeEnabled,
  type DevModeAccount,
  type DevModeConfig,
  type DevModePublicAccount,
} from "./lib/dev-mode-core";
