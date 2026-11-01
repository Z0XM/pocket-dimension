import { fail } from "@sveltejs/kit";
import { isUuid } from "$lib/admin-access";
import { requireZapAdmin } from "$lib/server/admin/access";
import {
  TagAdminError,
  createSystemTag,
  deleteSystemTag,
  listSystemTagsForAdmin,
  setSystemTagIcon,
} from "$lib/server/admin/tags";
import type { Actions, PageServerLoad } from "./$types";

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ locals }) => {
  requireZapAdmin(locals);
  const result = await listSystemTagsForAdmin({ limit: PAGE_SIZE, offset: 0 });
  return { ...result, pageSize: PAGE_SIZE };
};

export const actions: Actions = {
  create: async ({ locals, request }) => {
    requireZapAdmin(locals);
    const form = await request.formData();
    const name = String(form.get("name") ?? "");
    const icon = form.get("icon");
    try {
      const tag = await createSystemTag(name, icon);
      return { ok: `Added system tag "${tag.name}".` };
    } catch (err) {
      if (err instanceof TagAdminError) return fail(err.status, { error: err.message, name });
      throw err;
    }
  },

  setIcon: async ({ locals, request }) => {
    requireZapAdmin(locals);
    const form = await request.formData();
    const tagId = String(form.get("tagId") ?? "");
    if (!isUuid(tagId)) return fail(400, { error: "Pick a tag." });
    try {
      const tag = await setSystemTagIcon(tagId, form.get("icon"));
      return { ok: tag.icon ? `Icon set on "${tag.name}".` : `Icon cleared on "${tag.name}".` };
    } catch (err) {
      if (err instanceof TagAdminError) return fail(err.status, { error: err.message });
      throw err;
    }
  },

  delete: async ({ locals, request }) => {
    requireZapAdmin(locals);
    const form = await request.formData();
    const tagId = String(form.get("tagId") ?? "");
    if (!isUuid(tagId)) return fail(400, { error: "Pick a tag." });
    try {
      const tag = await deleteSystemTag(tagId);
      return { ok: `Removed system tag "${tag.name}".` };
    } catch (err) {
      if (err instanceof TagAdminError) return fail(err.status, { error: err.message });
      throw err;
    }
  },
};
