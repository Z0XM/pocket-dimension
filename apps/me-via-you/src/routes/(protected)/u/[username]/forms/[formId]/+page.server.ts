import { listAnswersForForm } from "$lib/server/answers";
import { closeForm, getFormByIdForUser, getPublicFormUrl, isFormAcceptingResponses } from "$lib/server/forms";
import { requireVerifiedUserForUsername } from "$lib/server/authz";
import { error, fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const user = requireVerifiedUserForUsername(locals, params.username);
  const form = await getFormByIdForUser(params.formId, user.id);

  if (!form) {
    error(404, "Form not found.");
  }

  const answers = await listAnswersForForm(form.id);

  return {
    form,
    answers,
    publicUrl: isFormAcceptingResponses(form) ? getPublicFormUrl(form.publicSlug, url.origin) : null,
    origin: url.origin,
    username: user.username,
  };
};

export const actions: Actions = {
  closeForm: async ({ locals, params }) => {
    const user = requireVerifiedUserForUsername(locals, params.username);
    const form = await closeForm(params.formId, user.id);

    if (!form) {
      return fail(400, { error: "Form not found or already closed." });
    }

    return { success: true };
  },
};
