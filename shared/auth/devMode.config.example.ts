/**
 * Example Dev Mode config.
 *
 * Setup:
 *   cp shared/auth/devMode.config.example.ts shared/auth/devMode.config.ts
 *
 * `devMode.config.ts` is gitignored — never commit real local accounts.
 * Accounts must already exist in the auth DB (username match).
 * Default for this VM: admin.
 *
 * Local sample accounts (create via signup + verify in DB; see DEV_MODE.md):
 *   admin        — role admin
 *   z0xm, mukul  — role user
 *   lordsparos   — role contributor (Bunko auto-import destination + catalog actor)
 */
import type { DevModeConfig } from "./src/lib/dev-mode";

const config: DevModeConfig = {
  defaultAccount: "admin",
  allowedAccounts: [
    { username: "admin", email: "admin@local.dev", label: "admin" },
    { username: "z0xm", email: "user1@local.dev", label: "z0xm" },
    { username: "mukul", email: "user2@local.dev", label: "mukul" },
    { username: "lordsparos", email: "lordsparos@local.dev", label: "lordsparos (bunko)" },
  ],
};

export default config;
