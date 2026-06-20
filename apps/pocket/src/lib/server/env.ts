import { validateEnv } from "@pocket-dimension/utils";
import { z } from "zod";
import { appCatalog, type AppEntry, type LinkedApp } from "$lib/apps";

const envSchema = z.object({
  PORT: z.coerce.number().default(3007),
  HOST: z.string().default("0.0.0.0"),
  POCKET_APP_WATCHLIST_URL: z.string().url().optional(),
  POCKET_APP_RHYMES_URL: z.string().url().optional(),
  POCKET_APP_HOWWASYOURDAY_URL: z.string().url().optional(),
  POCKET_APP_CHHAN_CHAN_URL: z.string().url().optional(),
  POCKET_APP_ME_VIA_YOU_URL: z.string().url().optional(),
  POCKET_APP_MARKITDOWN_URL: z.string().url().optional(),
});

export const env = validateEnv("pocket", envSchema, Bun.env);

export function getLinkedApps(): LinkedApp[] {
  return appCatalog.flatMap((app: AppEntry) => {
    const url = env[app.envKey as keyof typeof env];
    if (typeof url !== "string" || !url) return [];
    return [{ id: app.id, name: app.name, description: app.description, url }];
  });
}
