import { fail, redirect } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { resolveRequestAccount, setActiveAccountCookie } from "$lib/server/active-account";
import {
  createSpace,
  createTag,
  deleteSpace as removeSpace,
  deleteTag as removeTag,
  countAccountTransactions,
  getAccountCurrency,
  getAccountOpeningBalance,
  getFirstTransactionDate,
  listSpaces,
  listTags,
  createAccount,
  updateAccount,
  updateAccountCurrency,
  updateAccountOpeningBalance,
  updateSpace as saveSpace,
  updateTag as saveTag,
  accountNeedsDefaultTaxonomy,
  configureAccountDefaults,
} from "$lib/server/finance";
import { SUPPORTED_CURRENCIES } from "$lib/finance/currencies";
import { parseIndianAmount } from "$lib/finance/money";
import { importTransactionRows, resetAccountTransactions } from "$lib/server/import";
import { getImporter, listImporters } from "$lib/importers";
import {
  createSpaceSchema,
  createTagSchema,
  deleteSpaceSchema,
  deleteTagSchema,
  createAccountSchema,
  updateAccountSchema,
  switchAccountSchema,
  updateAccountCurrencySchema,
  updateAccountOpeningBalanceSchema,
  clearAccountOpeningBalanceSchema,
  updateSpaceSchema,
  updateTagSchema,
} from "$lib/validation/finance";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, parent }) => {
  if (!locals.user?.id) redirect(307, "/login");

  const { account, accounts } = await parent();
  const [tags, spaces, transactionCount, firstTransactionOn, openingBalance, needsDefaultTaxonomy] = await Promise.all([
    listTags(account.id),
    listSpaces(account.id),
    countAccountTransactions(account.id),
    getFirstTransactionDate(account.id),
    getAccountOpeningBalance(account.id),
    accountNeedsDefaultTaxonomy(account.id),
  ]);

  return {
    account,
    accounts,
    transactionCount,
    firstTransactionOn,
    openingBalance,
    tags,
    spaces,
    needsDefaultTaxonomy,
    currencies: SUPPORTED_CURRENCIES,
    importers: listImporters().map(({ id, label }) => ({ id, label })),
  };
};

export const actions: Actions = {
  createTag: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
    const { account } = await resolveRequestAccount(user.id, cookies);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const parsed = createTagSchema.safeParse({
      name: form.get("name"),
      kind: form.get("kind") || null,
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

  updateTag: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
    const { account } = await resolveRequestAccount(user.id, cookies);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const parsed = updateTagSchema.safeParse({
      id: form.get("id"),
      name: form.get("name"),
      kind: form.get("kind") || null,
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

  deleteTag: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
    const { account } = await resolveRequestAccount(user.id, cookies);
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

  createSpace: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
    const { account } = await resolveRequestAccount(user.id, cookies);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const parsed = createSpaceSchema.safeParse({
      name: form.get("name"),
      colorHex: form.get("colorHex") || undefined,
      notes: form.get("notes") || undefined,
    });

    if (!parsed.success) {
      return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid space" });
    }

    const space = await createSpace(user.id, account.id, parsed.data);
    if (!space) {
      return fail(409, { message: "Space already exists" });
    }

    return { success: true, message: `Added space “${space.name}”` };
  },

  updateSpace: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
    const { account } = await resolveRequestAccount(user.id, cookies);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const parsed = updateSpaceSchema.safeParse({
      id: form.get("id"),
      name: form.get("name"),
      colorHex: form.get("colorHex") || undefined,
      notes: form.get("notes") ?? undefined,
    });

    if (!parsed.success) {
      return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid space" });
    }

    try {
      const space = await saveSpace(user.id, account.id, parsed.data);
      if (!space) {
        return fail(404, { message: "Space not found" });
      }

      return { success: true, message: `Updated space “${space.name}”` };
    } catch {
      return fail(409, { message: "A space with that name already exists" });
    }
  },

  deleteSpace: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
    const { account } = await resolveRequestAccount(user.id, cookies);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const parsed = deleteSpaceSchema.safeParse({ id: form.get("id") });
    if (!parsed.success) {
      return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid space" });
    }

    const deleted = await removeSpace(account.id, parsed.data.id);
    if (!deleted) {
      return fail(404, { message: "Space not found" });
    }

    return { success: true, message: "Space deleted" };
  },

  updateCurrency: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
    const { account } = await resolveRequestAccount(user.id, cookies);
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

  updateOpeningBalance: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
    const { account } = await resolveRequestAccount(user.id, cookies);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const clearParsed = clearAccountOpeningBalanceSchema.safeParse({ clear: form.get("clear") });
    if (clearParsed.success) {
      await updateAccountOpeningBalance(user.id, account.id, null);
      return { success: true, message: "Opening balance cleared" };
    }

    const parsed = updateAccountOpeningBalanceSchema.safeParse({
      balanceAsOf: form.get("balanceAsOf"),
      amount: form.get("amount"),
    });
    if (!parsed.success) {
      return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid opening balance" });
    }

    let balanceMinor: number;
    try {
      balanceMinor = parseIndianAmount(parsed.data.amount);
    } catch {
      return fail(400, { message: "Invalid amount" });
    }
    if (balanceMinor < 0) {
      return fail(400, { message: "Amount must be zero or positive" });
    }

    const updated = await updateAccountOpeningBalance(user.id, account.id, {
      balanceMinor,
      balanceAsOf: parsed.data.balanceAsOf,
    });
    if (!updated) {
      return fail(404, { message: "Account not found" });
    }

    return { success: true, message: "Opening balance saved" };
  },

  importStatement: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
    const { account } = await resolveRequestAccount(user.id, cookies);
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

  clearAllTransactions: async ({ locals, cookies }) => {
    const user = requireUser(locals);
    const { account } = await resolveRequestAccount(user.id, cookies);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const removed = await resetAccountTransactions(account.id);
    if (removed === 0) {
      return { success: true, message: "No transactions to delete" };
    }

    return {
      success: true,
      message: `Deleted ${removed} transaction${removed === 1 ? "" : "s"}`,
    };
  },

  switchAccount: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
    const form = await request.formData();
    const parsed = switchAccountSchema.safeParse({ accountId: form.get("accountId") });
    if (!parsed.success) {
      return fail(400, { message: "Invalid account" });
    }

    await getMembershipOrThrow(user.id, parsed.data.accountId);
    setActiveAccountCookie(cookies, parsed.data.accountId);
    return { success: true, message: "Switched account" };
  },

  createAccount: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
    const form = await request.formData();
    const parsed = createAccountSchema.safeParse({
      name: form.get("name"),
      currencyCode: form.get("currencyCode") || "INR",
      timezone: form.get("timezone") || "Asia/Kolkata",
      colorHex: form.get("colorHex") || undefined,
      bankImporterId: form.get("bankImporterId") || undefined,
    });

    if (!parsed.success) {
      return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid account" });
    }

    const account = await createAccount(user.id, parsed.data);
    setActiveAccountCookie(cookies, account.id);

    const balanceAsOfRaw = form.get("balanceAsOf");
    const amountRaw = form.get("amount");
    const hasOpeningDate = typeof balanceAsOfRaw === "string" && balanceAsOfRaw.trim() !== "";
    const hasOpeningAmount = typeof amountRaw === "string" && amountRaw.trim() !== "";

    if (hasOpeningDate || hasOpeningAmount) {
      const openingParsed = updateAccountOpeningBalanceSchema.safeParse({
        balanceAsOf: balanceAsOfRaw,
        amount: amountRaw,
      });
      if (!openingParsed.success) {
        return fail(400, { message: openingParsed.error.issues[0]?.message ?? "Invalid opening balance" });
      }

      let balanceMinor: number;
      try {
        balanceMinor = parseIndianAmount(openingParsed.data.amount);
      } catch {
        return fail(400, { message: "Invalid opening balance amount" });
      }
      if (balanceMinor < 0) {
        return fail(400, { message: "Opening balance cannot be negative" });
      }
      await updateAccountOpeningBalance(user.id, account.id, {
        balanceMinor,
        balanceAsOf: openingParsed.data.balanceAsOf,
      });
    }

    return { success: true, message: "Account created" };
  },

  configureDefaults: async ({ locals, cookies }) => {
    const user = requireUser(locals);
    const { account } = await resolveRequestAccount(user.id, cookies);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) {
      return fail(403, { message: "You only have read access" });
    }

    await configureAccountDefaults(user.id, account.id);
    return { success: true, message: "Default tags added" };
  },

  updateAccount: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
    const { account } = await resolveRequestAccount(user.id, cookies);
    const membership = await getMembershipOrThrow(user.id, account.id);
    if (!canEdit(membership.role)) return fail(403, { message: "Read-only access" });

    const form = await request.formData();
    const parsed = updateAccountSchema.safeParse({
      name: form.get("name") || undefined,
      currencyCode: form.get("currencyCode") || undefined,
      timezone: form.get("timezone") || undefined,
      colorHex: form.get("colorHex") === "" ? "" : form.get("colorHex") || undefined,
      bankImporterId: form.get("bankImporterId") === "" ? "" : form.get("bankImporterId") || undefined,
    });

    if (!parsed.success) {
      return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid account settings" });
    }

    const updated = await updateAccount(user.id, account.id, parsed.data);
    if (!updated) {
      return fail(404, { message: "Account not found" });
    }

    const balanceAsOfRaw = form.get("balanceAsOf");
    const amountRaw = form.get("amount");
    const hasOpeningDate = typeof balanceAsOfRaw === "string" && balanceAsOfRaw.trim() !== "";
    const hasOpeningAmount = typeof amountRaw === "string" && amountRaw.trim() !== "";

    if (hasOpeningDate || hasOpeningAmount) {
      const openingParsed = updateAccountOpeningBalanceSchema.safeParse({
        balanceAsOf: balanceAsOfRaw,
        amount: amountRaw,
      });
      if (!openingParsed.success) {
        return fail(400, { message: openingParsed.error.issues[0]?.message ?? "Invalid opening balance" });
      }

      let balanceMinor: number;
      try {
        balanceMinor = parseIndianAmount(openingParsed.data.amount);
      } catch {
        return fail(400, { message: "Invalid opening amount" });
      }
      if (balanceMinor < 0) {
        return fail(400, { message: "Opening amount must be zero or positive" });
      }

      const openingUpdated = await updateAccountOpeningBalance(user.id, account.id, {
        balanceMinor,
        balanceAsOf: openingParsed.data.balanceAsOf,
      });
      if (!openingUpdated) {
        return fail(404, { message: "Account not found" });
      }
    }

    return { success: true, message: `Updated account “${updated.name}”` };
  },
};
