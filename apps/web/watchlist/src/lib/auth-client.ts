import { createAuthClient } from "better-auth/svelte";
export const authClient = createAuthClient({
  baseURL: Bun.env.BASE_AUTH_URL,
});
