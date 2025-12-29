import { createAuthClient } from "better-auth/react";

const baseURL = import.meta.env.VITE_AUTH_BASE_URL;
const basePath = import.meta.env.VITE_AUTH_BASE_PATH;

export const authClient = createAuthClient({
  baseURL,
  basePath,
});
