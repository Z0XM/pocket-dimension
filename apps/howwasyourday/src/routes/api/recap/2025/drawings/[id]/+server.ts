import type { RequestHandler } from "./$types";
import { canAccessDrawing } from "$lib/server/legacy-recap/access";

export const GET: RequestHandler = async ({ params, cookies, locals }) => {
  const id = params.id;
  if (!id) {
    return new Response("Not found", { status: 404 });
  }

  const result = await canAccessDrawing({
    drawingId: id,
    cookies,
    userId: locals.user?.id,
  });

  if (!result.ok) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(result.png), {
    headers: {
      "Content-Type": result.contentType || "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
};
