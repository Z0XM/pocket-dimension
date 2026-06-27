/// <reference types="@sveltejs/kit" />

import type { schema } from "@pocket-dimension/db";
import type { Session } from "$lib/auth";

declare global {
  namespace App {
    interface Locals {
      session?: Session;
      user?: typeof schema.user.$inferSelect;
    }
  }
}

export {};
