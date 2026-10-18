import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/** Legacy Add page → catalogue add dialog (`?add` opens it). */
export const GET: RequestHandler = ({ url }) => {
  const qs = new URLSearchParams(url.searchParams);
  if (!qs.has("add")) qs.set("add", "url");
  throw redirect(308, `/catalogue?${qs}`);
};
