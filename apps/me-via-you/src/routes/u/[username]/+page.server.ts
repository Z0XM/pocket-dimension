import { getFormsWithPreviews, getHeroAnswersForUser } from "$lib/server/answers";
import { isProfileOwner, requireProfileOwner } from "$lib/server/authz";
import { closeForm, createForm, getPublicFormUrl, listFormsForUser, setFormHiddenFromPublic, type FormClassification } from "$lib/server/forms";
import { getUserByUsername } from "$lib/server/users";
import { optionalText, parseClosesAt } from "$lib/server/validation";
import { error, fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const profileUser = await getUserByUsername(params.username);
  if (!profileUser?.username) {
    error(404, "User not found.");
  }

  const isOwner = isProfileOwner(locals, params.username);
  const forms = await listFormsForUser(profileUser.id, { publicOnly: !isOwner });
  const [hero, formsWithPreviews] = await Promise.all([getHeroAnswersForUser(profileUser.id), getFormsWithPreviews(forms)]);

  return {
    profileUser,
    isOwner,
    showNotes: isOwner,
    hero,
    forms: formsWithPreviews,
    origin: url.origin,
  };
};

export const actions: Actions = {
  createForm: async ({ request, locals, params, url }) => {
    const user = requireProfileOwner(locals, params.username);
    const formData = await request.formData();

    const question = optionalText(formData.get("question"));
    const classification = String(formData.get("classification") ?? "general") as FormClassification;
    const closesAt = parseClosesAt(formData.get("closesAt"));

    if (!question) {
      return fail(400, { error: "Question is required." });
    }

    if (!["positive", "negative", "general"].includes(classification)) {
      return fail(400, { error: "Invalid classification." });
    }

    try {
      const form = await createForm({
        userId: user.id,
        question,
        classification,
        closesAt,
      });

      const launched = getPublicFormUrl(form.publicSlug, url.origin);
      return { launchedUrl: launched };
    } catch (createError) {
      return fail(400, {
        error: createError instanceof Error ? createError.message : "Could not create form.",
      });
    }
  },

  closeForm: async ({ request, locals, params }) => {
    const user = requireProfileOwner(locals, params.username);
    const formData = await request.formData();
    const formId = String(formData.get("formId") ?? "");

    if (!formId) {
      return fail(400, { error: "Form is required." });
    }

    const form = await closeForm(formId, user.id);
    if (!form) {
      return fail(400, { error: "Form not found or already closed." });
    }

    return { success: true };
  },

  toggleFormVisibility: async ({ request, locals, params }) => {
    const user = requireProfileOwner(locals, params.username);
    const formData = await request.formData();
    const formId = String(formData.get("formId") ?? "");
    const hidden = formData.get("hidden") === "true";

    if (!formId) {
      return fail(400, { error: "Form is required." });
    }

    const form = await setFormHiddenFromPublic(formId, user.id, hidden);
    if (!form) {
      return fail(400, { error: "Form not found." });
    }

    return { success: true };
  },
};
