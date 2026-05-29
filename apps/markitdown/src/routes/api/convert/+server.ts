import { json } from "@sveltejs/kit";
import { ConversionError, convertUploadedFile } from "$lib/server/markitdown";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return json({ error: "No file provided." }, { status: 400 });
  }

  try {
    const markdown = await convertUploadedFile(file);
    return json({
      markdown,
      filename: `${file.name.replace(/\.[^.]+$/, "")}.md`,
    });
  } catch (error) {
    if (error instanceof ConversionError) {
      return json({ error: error.message }, { status: 400 });
    }

    console.error("MarkItDown conversion failed:", error);
    return json({ error: "An unexpected error occurred during conversion." }, { status: 500 });
  }
};
