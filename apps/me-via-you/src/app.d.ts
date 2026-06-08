// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { schema } from "@pocket-dimension/db";
import type { Session } from "$lib/auth";

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      session?: Session;
      user?: typeof schema.user.$inferSelect;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
