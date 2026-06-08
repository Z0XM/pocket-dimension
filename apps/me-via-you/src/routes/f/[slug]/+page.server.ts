import { parseAnswersInput, submitAnswers } from "$lib/server/answers";
import { getFormBySlug, isFormAcceptingResponses } from "$lib/server/forms";
import { error, fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const form = await getFormBySlug(params.slug);
  if (!form) {
    error(404, "Form not found.");
  }

  return {
    form,
    closed: !isFormAcceptingResponses(form),
  };
};

export const actions: Actions = {
  submit: async ({ request, params }) => {
    const form = await getFormBySlug(params.slug);
    if (!form) {
      return fail(404, { error: "Form not found." });
    }

    if (!isFormAcceptingResponses(form)) {
      return fail(400, { error: "This form is closed." });
    }

    const formData = await request.formData();

    try {
      const inputs = parseAnswersInput(formData);
      const answers = await submitAnswers(form.id, inputs);
      return { success: true, count: answers.length };
    } catch (error) {
      return fail(400, {
        error: error instanceof Error ? error.message : "Could not submit answers.",
      });
    }
  },
};
