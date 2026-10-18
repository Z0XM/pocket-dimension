// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { schema } from "@pocket-dimension/db";
import type { Session } from "$lib/auth";
import type { ZapAccess } from "$lib/server/admin/access";

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      devMode?: boolean;
      session?: Session;
      user?: typeof schema.user.$inferSelect;
      /** Set by hooks for verified sessions; drives admin checks and the portal block. */
      zapAccess?: ZapAccess;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
