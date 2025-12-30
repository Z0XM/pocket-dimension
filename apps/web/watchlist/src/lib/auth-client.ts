import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/svelte";
import { PUBLIC_BASE_AUTH_PATH, PUBLIC_BASE_AUTH_URL } from "$env/static/public";

export const authClient = createAuthClient({
  baseURL: PUBLIC_BASE_AUTH_URL,
  basePath: PUBLIC_BASE_AUTH_PATH,
  plugins: [usernameClient()],
});
