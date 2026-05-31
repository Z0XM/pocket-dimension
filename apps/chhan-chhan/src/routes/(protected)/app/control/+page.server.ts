import { fail, redirect } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import {
  createCategory,
  createGroup,
  createTag,
  deleteCategory as removeCategory,
  deleteGroup as removeGroup,
  deleteTag as removeTag,
  getAccountCurrency,
  getOrCreateDefaultAccount,
  listCategories,
  listGroups,
  listTags,
  updateAccountCurrency,
  updateCategory as saveCategory,
  updateGroup as saveGroup,
  updateTag as saveTag,
} from "$lib/server/finance";
import { SUPPORTED_CURRENCIES } from "$lib/finance/currencies";
import { importTransactionRows } from "$lib/server/import";
import { getImporter, listImporters } from "$lib/importers";
import {
  createCategorySchema,
  createGroupSchema,
  createTagSchema,
  deleteCategorySchema,
  deleteGroupSchema,
  deleteTagSchema,
  updateAccountCurrencySchema,
  updateCategorySchema,
  updateGroupSchema,
  updateTagSchema,
} from "$lib/validation/finance";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, parent }) => {
  if (!locals.user?.id) redirect(307, "/login");

  const { account } = await parent();
  const [categories, tags, groups] = await Promise.all([listCategories(account.id), listTags(account.id), listGroups(account.id)]);

  return {
    account,
    categories,
    tags,
    groups,
    currencies: SUPPORTED_CURRENCIES,
    importers: listImporters().map(({ id, label }) => ({ id, label })),
  };
};

export const actions: Actions = {
  createCategory: async ({ request, locals }) => {
    const user = requireUser(locals);
    const account = await getOrCreateDefaultAccount(user.id);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const parsed = createCategorySchema.safeParse({
      name: form.get("name"),
      kind: form.get("kind") ?? "expense",
      colorHex: form.get("colorHex") || undefined,
    });

    if (!parsed.success) {
      return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid category" });
    }

    const category = await createCategory(user.id, account.id, parsed.data);
    if (!category) {
      return fail(409, { message: "Category already exists" });
    }

    return { success: true, message: `Added category “${category.name}”` };
  },

  updateCategory: async ({ request, locals }) => {
    const user = requireUser(locals);
    const account = await getOrCreateDefaultAccount(user.id);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const parsed = updateCategorySchema.safeParse({
      id: form.get("id"),
      name: form.get("name"),
      kind: form.get("kind") ?? "expense",
      colorHex: form.get("colorHex") || undefined,
    });

    if (!parsed.success) {
      return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid category" });
    }

    try {
      const category = await saveCategory(user.id, account.id, parsed.data);
      if (!category) {
        return fail(404, { message: "Category not found" });
      }

      return { success: true, message: `Updated category “${category.name}”` };
    } catch {
      return fail(409, { message: "A category with that name already exists" });
    }
  },

  deleteCategory: async ({ request, locals }) => {
    const user = requireUser(locals);
    const account = await getOrCreateDefaultAccount(user.id);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const parsed = deleteCategorySchema.safeParse({ id: form.get("id") });
    if (!parsed.success) {
      return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid category" });
    }

    const deleted = await removeCategory(account.id, parsed.data.id);
    if (!deleted) {
      return fail(404, { message: "Category not found" });
    }

    return { success: true, message: "Category deleted" };
  },

  createTag: async ({ request, locals }) => {
    const user = requireUser(locals);
    const account = await getOrCreateDefaultAccount(user.id);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const parsed = createTagSchema.safeParse({
      name: form.get("name"),
      colorHex: form.get("colorHex") || undefined,
    });

    if (!parsed.success) {
      return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid tag" });
    }

    const tag = await createTag(user.id, account.id, parsed.data);
    if (!tag) {
      return fail(409, { message: "Tag already exists" });
    }

    return { success: true, message: `Added tag “${tag.name}”` };
  },

  updateTag: async ({ request, locals }) => {
    const user = requireUser(locals);
    const account = await getOrCreateDefaultAccount(user.id);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const parsed = updateTagSchema.safeParse({
      id: form.get("id"),
      name: form.get("name"),
      colorHex: form.get("colorHex") || undefined,
    });

    if (!parsed.success) {
      return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid tag" });
    }

    try {
      const tag = await saveTag(user.id, account.id, parsed.data);
      if (!tag) {
        return fail(404, { message: "Tag not found" });
      }

      return { success: true, message: `Updated tag “${tag.name}”` };
    } catch {
      return fail(409, { message: "A tag with that name already exists" });
    }
  },

  deleteTag: async ({ request, locals }) => {
    const user = requireUser(locals);
    const account = await getOrCreateDefaultAccount(user.id);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const parsed = deleteTagSchema.safeParse({ id: form.get("id") });
    if (!parsed.success) {
      return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid tag" });
    }

    const deleted = await removeTag(account.id, parsed.data.id);
    if (!deleted) {
      return fail(404, { message: "Tag not found" });
    }

    return { success: true, message: "Tag deleted" };
  },

  createGroup: async ({ request, locals }) => {
    const user = requireUser(locals);
    const account = await getOrCreateDefaultAccount(user.id);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const parsed = createGroupSchema.safeParse({
      name: form.get("name"),
    });

    if (!parsed.success) {
      return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid group" });
    }

    const group = await createGroup(user.id, account.id, parsed.data);
    if (!group) {
      return fail(409, { message: "Group already exists" });
    }

    return { success: true, message: `Added group “${group.name}”` };
  },

  updateGroup: async ({ request, locals }) => {
    const user = requireUser(locals);
    const account = await getOrCreateDefaultAccount(user.id);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const parsed = updateGroupSchema.safeParse({
      id: form.get("id"),
      name: form.get("name"),
    });

    if (!parsed.success) {
      return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid group" });
    }

    try {
      const group = await saveGroup(user.id, account.id, parsed.data);
      if (!group) {
        return fail(404, { message: "Group not found" });
      }

      return { success: true, message: `Updated group “${group.name}”` };
    } catch {
      return fail(409, { message: "A group with that name already exists" });
    }
  },

  deleteGroup: async ({ request, locals }) => {
    const user = requireUser(locals);
    const account = await getOrCreateDefaultAccount(user.id);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const parsed = deleteGroupSchema.safeParse({ id: form.get("id") });
    if (!parsed.success) {
      return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid group" });
    }

    const deleted = await removeGroup(account.id, parsed.data.id);
    if (!deleted) {
      return fail(404, { message: "Group not found" });
    }

    return { success: true, message: "Group deleted" };
  },

  updateCurrency: async ({ request, locals }) => {
    const user = requireUser(locals);
    const account = await getOrCreateDefaultAccount(user.id);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const parsed = updateAccountCurrencySchema.safeParse({
      currencyCode: form.get("currencyCode"),
    });

    if (!parsed.success) {
      return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid currency" });
    }

    const updated = await updateAccountCurrency(user.id, account.id, parsed.data.currencyCode);
    if (!updated) {
      return fail(404, { message: "Account not found" });
    }

    return { success: true, message: `Currency set to ${updated.currencyCode}` };
  },

  importStatement: async ({ request, locals }) => {
    const user = requireUser(locals);
    const account = await getOrCreateDefaultAccount(user.id);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { message: "Choose a statement file to import" });
    }

    const importerId = String(form.get("importer") ?? "kotak");

    try {
      const importer = getImporter(importerId);
      const parsed = await importer.parse({
        fileName: file.name,
        mimeType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
      if (!parsed.rows.length) {
        return fail(400, { message: "No transactions found in statement" });
      }

      const currencyCode = await getAccountCurrency(account.id);
      const result = await importTransactionRows(user.id, account.id, parsed.rows, {
        skipDuplicates: true,
        currencyCode,
      });

      return {
        success: true,
        message: `Imported ${result.accepted} transactions (${result.skipped} skipped, ${result.rejected} rejected)`,
        importResult: result,
        importReportCsv: result.reportCsv,
        metadata: parsed.metadata,
      };
    } catch (cause) {
      return fail(400, {
        message: cause instanceof Error ? cause.message : "Failed to import statement",
      });
    }
  },
};
