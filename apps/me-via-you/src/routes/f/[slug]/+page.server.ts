import { parseAnswersInput, submitAnswers } from "$lib/server/answers";
import { getFormBySlug, isFormAcceptingResponses } from "$lib/server/forms";
import { userHomePath } from "$lib/paths";
import { getPublicProfileByUserId } from "$lib/server/users";
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const form = await getFormBySlug(params.slug);
  if (!form) {
    error(404, "Form not found.");
  }

  const owner = await getPublicProfileByUserId(form.userId);
  if (!owner) {
    error(404, "Form not found.");
  }

  return {
    form,
    owner,
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
      await submitAnswers(form.id, inputs);
    } catch (submitError) {
      return fail(400, {
        error: submitError instanceof Error ? submitError.message : "Could not submit answers.",
      });
    }

    const owner = await getPublicProfileByUserId(form.userId);
    if (!owner) {
      return fail(500, { error: "Could not find the form owner." });
    }

    redirect(303, userHomePath(owner.username));
  },
};
