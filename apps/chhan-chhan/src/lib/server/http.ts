import { error } from "@sveltejs/kit";
import type { ZodType } from "zod";

export async function readJsonBody<T>(request: Request, validator: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, "Invalid JSON request body");
  }

  const parsed = validator.safeParse(body);
  if (!parsed.success) {
    throw error(400, parsed.error.issues[0]?.message ?? "Invalid payload");
  }
  return parsed.data;
}

export function parseSearch<T>(url: URL, validator: ZodType<T>): T {
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = validator.safeParse(raw);
  if (!parsed.success) {
    throw error(400, parsed.error.issues[0]?.message ?? "Invalid query");
  }
  return parsed.data;
}
