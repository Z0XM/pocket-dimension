import { normalizeMerchant, rankFuzzyMerchants } from "$lib/finance/merchant-match";
import { billTagSqlFilter } from "$lib/finance/bill-categories";
import { DEFAULT_TAGS } from "$lib/finance/default-taxonomy";
import { parseSqlMinor } from "$lib/finance/money";
import { maxAllocationMinor, spaceRemainders, canAllocateTransactionTypes } from "$lib/finance/space-settlement";
import { buildSummarySearchFilterSql, buildTransactionSearchCondition } from "$lib/finance/transaction-search";
import { currentMonthKey, readRowYear, type SummarySelection } from "$lib/finance/summary";
import { isBalanceSnapshotNewer } from "$lib/server/balance";
import { db, schema } from "@pocket-dimension/db";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lte, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import type {
  budgetUpsertSchema,
  createSpaceSchema,
  createTagSchema,
  goalUpsertSchema,
  transactionUpsertSchema,
  transactionsQuerySchema,
} from "$lib/validation/finance";

type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;
type TxPayload = z.infer<typeof transactionUpsertSchema>;
type BudgetPayload = z.infer<typeof budgetUpsertSchema>;
type GoalPayload = z.infer<typeof goalUpsertSchema>;
type TagPayload = z.infer<typeof createTagSchema>;
type UpdateTagPayload = z.infer<typeof import("$lib/validation/finance").updateTagSchema>;
type SpacePayload = z.infer<typeof createSpaceSchema>;
type UpdateSpacePayload = z.infer<typeof import("$lib/validation/finance").updateSpaceSchema>;

type MerchantTransactionType = "expense" | "income" | "transfer";

type SpaceAllocationPayload = {
  leftTransactionId: string;
  rightTransactionId: string;
  amountMinor: number;
};

type TransactionTag = {
  id: string;
  name: string;
  colorHex: string | null;
};

type TransactionSpace = {
  id: string;
  name: string;
  colorHex: string | null;
};

async function loadTagsForTransactions(transactionIds: string[]) {
  if (!transactionIds.length) return new Map<string, TransactionTag[]>();

  const tagRows = await db
    .select({
      transactionId: schema.financeTransactionTags.transactionId,
      id: schema.financeTags.id,
      name: schema.financeTags.name,
      colorHex: schema.financeTags.colorHex,
    })
    .from(schema.financeTransactionTags)
    .innerJoin(schema.financeTags, eq(schema.financeTags.id, schema.financeTransactionTags.tagId))
    .where(inArray(schema.financeTransactionTags.transactionId, transactionIds))
    .orderBy(asc(schema.financeTags.name));

  const tagsByTransaction = new Map<string, TransactionTag[]>();
  for (const row of tagRows) {
    const tags = tagsByTransaction.get(row.transactionId) ?? [];
    tags.push({ id: row.id, name: row.name, colorHex: row.colorHex });
    tagsByTransaction.set(row.transactionId, tags);
  }

  return tagsByTransaction;
}

async function loadSpacesForTransactions(transactionIds: string[]) {
  if (!transactionIds.length) return new Map<string, TransactionSpace[]>();

  const spaceRows = await db
    .select({
      transactionId: schema.financeSpaceTransactions.transactionId,
      id: schema.financeSpaces.id,
      name: schema.financeSpaces.name,
      colorHex: schema.financeSpaces.colorHex,
    })
    .from(schema.financeSpaceTransactions)
    .innerJoin(schema.financeSpaces, eq(schema.financeSpaces.id, schema.financeSpaceTransactions.spaceId))
    .where(inArray(schema.financeSpaceTransactions.transactionId, transactionIds))
    .orderBy(asc(schema.financeSpaces.name));

  const spacesByTransaction = new Map<string, TransactionSpace[]>();
  for (const row of spaceRows) {
    const spaces = spacesByTransaction.get(row.transactionId) ?? [];
    spaces.push({ id: row.id, name: row.name, colorHex: row.colorHex });
    spacesByTransaction.set(row.transactionId, spaces);
  }

  return spacesByTransaction;
}

const sortMap = {
  occurredOn: schema.financeTransactions.occurredOn,
  amountMinor: schema.financeTransactions.amountMinor,
  merchant: schema.financeTransactions.merchant,
  type: schema.financeTransactions.type,
  createdAt: schema.financeTransactions.createdAt,
} as const;

export const ACTIVE_ACCOUNT_COOKIE = "chhan_active_account";

const ACCOUNT_COLOR_PRESETS = ["#E85D4C", "#2F6FED", "#0F9F6E", "#C97816", "#7C3AED", "#0D9488", "#DB2777", "#475569"] as const;

export function defaultAccountColor(index = 0): string {
  return ACCOUNT_COLOR_PRESETS[index % ACCOUNT_COLOR_PRESETS.length]!;
}

export async function listAccountsForUser(userId: string) {
  return db
    .select({
      id: schema.financeAccounts.id,
      name: schema.financeAccounts.name,
      currencyCode: schema.financeAccounts.currencyCode,
      timezone: schema.financeAccounts.timezone,
      colorHex: schema.financeAccounts.colorHex,
      bankImporterId: schema.financeAccounts.bankImporterId,
      balanceMinor: schema.financeAccounts.balanceMinor,
      balanceAsOf: schema.financeAccounts.balanceAsOf,
      isArchived: schema.financeAccounts.isArchived,
      role: schema.financeAccountMembers.role,
    })
    .from(schema.financeAccountMembers)
    .innerJoin(schema.financeAccounts, eq(schema.financeAccounts.id, schema.financeAccountMembers.accountId))
    .where(and(eq(schema.financeAccountMembers.userId, userId), eq(schema.financeAccounts.isArchived, false)))
    .orderBy(asc(schema.financeAccounts.name));
}

export async function createAccount(userId: string, payload: z.infer<typeof import("$lib/validation/finance").createAccountSchema>) {
  const existing = await listAccountsForUser(userId);
  const colorHex = payload.colorHex ?? defaultAccountColor(existing.length);

  return db.transaction(async (tx) => {
    const [account] = await tx
      .insert(schema.financeAccounts)
      .values({
        name: payload.name,
        currencyCode: payload.currencyCode.toUpperCase(),
        timezone: payload.timezone,
        colorHex,
        bankImporterId: payload.bankImporterId ?? null,
        ownerUserId: userId,
        createdById: userId,
        updatedById: userId,
      })
      .returning();

    await tx.insert(schema.financeAccountMembers).values({
      accountId: account.id,
      userId,
      role: "owner",
      createdById: userId,
      updatedById: userId,
    });

    await seedDefaultTaxonomy(tx, account.id, userId);

    return account;
  });
}

async function seedDefaultTaxonomy(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], accountId: string, userId: string) {
  await tx
    .insert(schema.financeTags)
    .values(
      DEFAULT_TAGS.map((tag) => ({
        accountId,
        name: tag.name,
        kind: tag.kind ?? null,
        colorHex: tag.colorHex,
        createdById: userId,
        updatedById: userId,
      }))
    )
    .onConflictDoNothing({ target: [schema.financeTags.accountId, schema.financeTags.name] });
}

/** True when the account is missing any starter tag (typical for accounts created before defaults existed). */
export async function accountNeedsDefaultTaxonomy(accountId: string): Promise<boolean> {
  const tags = await db.select({ name: schema.financeTags.name }).from(schema.financeTags).where(eq(schema.financeTags.accountId, accountId));

  const tagNames = new Set(tags.map((row) => row.name));
  return DEFAULT_TAGS.some((tag) => !tagNames.has(tag.name));
}

/** Idempotent: inserts any missing starter tags for an existing account. */
export async function configureAccountDefaults(userId: string, accountId: string) {
  await db.transaction(async (tx) => {
    await seedDefaultTaxonomy(tx, accountId, userId);
  });
}

export async function updateAccount(
  userId: string,
  accountId: string,
  payload: z.infer<typeof import("$lib/validation/finance").updateAccountSchema>
) {
  const patch: {
    name?: string;
    currencyCode?: string;
    timezone?: string;
    colorHex?: string | null;
    bankImporterId?: string | null;
    updatedById: string;
  } = { updatedById: userId };

  if (payload.name != null) patch.name = payload.name;
  if (payload.currencyCode != null) patch.currencyCode = payload.currencyCode;
  if (payload.timezone != null) patch.timezone = payload.timezone;
  if (payload.colorHex !== undefined) {
    patch.colorHex = payload.colorHex === "" || payload.colorHex == null ? null : payload.colorHex;
  }
  if (payload.bankImporterId !== undefined) {
    patch.bankImporterId = payload.bankImporterId === "" || payload.bankImporterId == null ? null : payload.bankImporterId;
  }

  const [account] = await db.update(schema.financeAccounts).set(patch).where(eq(schema.financeAccounts.id, accountId)).returning({
    id: schema.financeAccounts.id,
    name: schema.financeAccounts.name,
    currencyCode: schema.financeAccounts.currencyCode,
    timezone: schema.financeAccounts.timezone,
    colorHex: schema.financeAccounts.colorHex,
    bankImporterId: schema.financeAccounts.bankImporterId,
    balanceMinor: schema.financeAccounts.balanceMinor,
    balanceAsOf: schema.financeAccounts.balanceAsOf,
  });

  return account ?? null;
}

export async function resolveActiveAccount(userId: string, preferredAccountId?: string | null) {
  const accounts = await listAccountsForUser(userId);

  if (preferredAccountId) {
    const preferred = accounts.find((account) => account.id === preferredAccountId);
    if (preferred) return { account: preferred, accounts };
  }

  if (accounts.length > 0) {
    return { account: accounts[0]!, accounts };
  }

  const created = await createAccount(userId, {
    name: "Personal",
    currencyCode: "INR",
    timezone: "Asia/Kolkata",
  });

  const refreshed = await listAccountsForUser(userId);
  const account = refreshed.find((row) => row.id === created.id) ?? refreshed[0]!;
  return { account, accounts: refreshed };
}

export async function getOrCreateDefaultAccount(userId: string) {
  const { account } = await resolveActiveAccount(userId);
  return account;
}

export async function getAccountCurrency(accountId: string) {
  const account = await db.query.financeAccounts.findFirst({
    where: eq(schema.financeAccounts.id, accountId),
    columns: { currencyCode: true },
  });
  return account?.currencyCode ?? "INR";
}

export async function updateAccountCurrency(userId: string, accountId: string, currencyCode: string) {
  const [updated] = await db
    .update(schema.financeAccounts)
    .set({
      currencyCode: currencyCode.toUpperCase(),
      updatedById: userId,
    })
    .where(eq(schema.financeAccounts.id, accountId))
    .returning();
  return updated ?? null;
}

export async function getFirstTransactionDate(accountId: string): Promise<string | null> {
  const [row] = await db
    .select({ occurredOn: schema.financeTransactions.occurredOn })
    .from(schema.financeTransactions)
    .where(eq(schema.financeTransactions.accountId, accountId))
    .orderBy(asc(schema.financeTransactions.occurredOn), asc(schema.financeTransactions.sortOrder), asc(schema.financeTransactions.createdAt))
    .limit(1);
  return row?.occurredOn ?? null;
}

export async function getAccountOpeningBalance(accountId: string): Promise<{ balanceMinor: number; balanceAsOf: string } | null> {
  const account = await db.query.financeAccounts.findFirst({
    where: eq(schema.financeAccounts.id, accountId),
    columns: { balanceMinor: true, balanceAsOf: true },
  });
  if (account?.balanceMinor == null || !account.balanceAsOf) return null;
  return { balanceMinor: account.balanceMinor, balanceAsOf: account.balanceAsOf };
}

export async function updateAccountOpeningBalance(userId: string, accountId: string, payload: { balanceMinor: number; balanceAsOf: string } | null) {
  const [updated] = await db
    .update(schema.financeAccounts)
    .set(
      payload
        ? {
            balanceMinor: payload.balanceMinor,
            balanceAsOf: payload.balanceAsOf,
            updatedById: userId,
          }
        : {
            balanceMinor: null,
            balanceAsOf: null,
            updatedById: userId,
          }
    )
    .where(eq(schema.financeAccounts.id, accountId))
    .returning({
      balanceMinor: schema.financeAccounts.balanceMinor,
      balanceAsOf: schema.financeAccounts.balanceAsOf,
      currencyCode: schema.financeAccounts.currencyCode,
    });
  return updated ?? null;
}

export async function listTags(accountId: string) {
  return db.query.financeTags.findMany({
    where: eq(schema.financeTags.accountId, accountId),
    orderBy: [asc(schema.financeTags.name)],
  });
}

export async function createTag(userId: string, accountId: string, payload: TagPayload) {
  const [tag] = await db
    .insert(schema.financeTags)
    .values({
      accountId,
      name: payload.name,
      kind: payload.kind,
      colorHex: payload.colorHex,
      createdById: userId,
      updatedById: userId,
    })
    .onConflictDoNothing()
    .returning();
  return tag ?? null;
}

export async function updateTag(userId: string, accountId: string, payload: UpdateTagPayload) {
  const [updated] = await db
    .update(schema.financeTags)
    .set({
      name: payload.name,
      kind: payload.kind,
      colorHex: payload.colorHex,
      updatedById: userId,
    })
    .where(and(eq(schema.financeTags.id, payload.id), eq(schema.financeTags.accountId, accountId)))
    .returning();
  return updated ?? null;
}

export async function deleteTag(accountId: string, tagId: string) {
  const [removed] = await db
    .delete(schema.financeTags)
    .where(and(eq(schema.financeTags.id, tagId), eq(schema.financeTags.accountId, accountId)))
    .returning({ id: schema.financeTags.id });
  return Boolean(removed);
}

export async function listSpaces(accountId: string) {
  return db
    .select({
      id: schema.financeSpaces.id,
      name: schema.financeSpaces.name,
      colorHex: schema.financeSpaces.colorHex,
      notes: schema.financeSpaces.notes,
      createdAt: schema.financeSpaces.createdAt,
      transactionCount: count(schema.financeSpaceTransactions.transactionId),
    })
    .from(schema.financeSpaces)
    .leftJoin(schema.financeSpaceTransactions, eq(schema.financeSpaceTransactions.spaceId, schema.financeSpaces.id))
    .where(eq(schema.financeSpaces.accountId, accountId))
    .groupBy(schema.financeSpaces.id)
    .orderBy(asc(schema.financeSpaces.name));
}

export async function getSpace(accountId: string, spaceId: string) {
  const [space] = await db
    .select()
    .from(schema.financeSpaces)
    .where(and(eq(schema.financeSpaces.id, spaceId), eq(schema.financeSpaces.accountId, accountId)))
    .limit(1);
  return space ?? null;
}

export async function createSpace(userId: string, accountId: string, payload: SpacePayload) {
  const [space] = await db
    .insert(schema.financeSpaces)
    .values({
      accountId,
      name: payload.name,
      colorHex: payload.colorHex,
      notes: payload.notes,
      createdById: userId,
      updatedById: userId,
    })
    .onConflictDoNothing()
    .returning();
  return space ?? null;
}

export async function updateSpace(userId: string, accountId: string, payload: UpdateSpacePayload) {
  const [updated] = await db
    .update(schema.financeSpaces)
    .set({
      name: payload.name,
      colorHex: payload.colorHex,
      notes: payload.notes,
      updatedById: userId,
    })
    .where(and(eq(schema.financeSpaces.id, payload.id), eq(schema.financeSpaces.accountId, accountId)))
    .returning();
  return updated ?? null;
}

export async function deleteSpace(accountId: string, spaceId: string) {
  const [removed] = await db
    .delete(schema.financeSpaces)
    .where(and(eq(schema.financeSpaces.id, spaceId), eq(schema.financeSpaces.accountId, accountId)))
    .returning({ id: schema.financeSpaces.id });
  return Boolean(removed);
}

export async function attachTransactionSpace(accountId: string, transactionId: string, spaceId: string) {
  const [transaction] = await db
    .select({ id: schema.financeTransactions.id })
    .from(schema.financeTransactions)
    .where(and(eq(schema.financeTransactions.id, transactionId), eq(schema.financeTransactions.accountId, accountId)))
    .limit(1);
  if (!transaction) return null;

  const [space] = await db
    .select({
      id: schema.financeSpaces.id,
      name: schema.financeSpaces.name,
      colorHex: schema.financeSpaces.colorHex,
    })
    .from(schema.financeSpaces)
    .where(and(eq(schema.financeSpaces.id, spaceId), eq(schema.financeSpaces.accountId, accountId)))
    .limit(1);
  if (!space) return null;

  await db.insert(schema.financeSpaceTransactions).values({ spaceId, transactionId }).onConflictDoNothing();

  return space;
}

/** Removes the transaction from the space along with any allocations that reference it inside that space. */
export async function detachTransactionSpace(accountId: string, transactionId: string, spaceId: string) {
  const [transaction] = await db
    .select({ id: schema.financeTransactions.id })
    .from(schema.financeTransactions)
    .where(and(eq(schema.financeTransactions.id, transactionId), eq(schema.financeTransactions.accountId, accountId)))
    .limit(1);
  if (!transaction) return false;

  const space = await getSpace(accountId, spaceId);
  if (!space) return false;

  return db.transaction(async (tx) => {
    await tx
      .delete(schema.financeSpaceAllocations)
      .where(
        and(
          eq(schema.financeSpaceAllocations.spaceId, spaceId),
          sql`(${schema.financeSpaceAllocations.leftTransactionId} = ${transactionId} OR ${schema.financeSpaceAllocations.rightTransactionId} = ${transactionId})`
        )
      );

    const [removed] = await tx
      .delete(schema.financeSpaceTransactions)
      .where(and(eq(schema.financeSpaceTransactions.spaceId, spaceId), eq(schema.financeSpaceTransactions.transactionId, transactionId)))
      .returning({ transactionId: schema.financeSpaceTransactions.transactionId });

    return Boolean(removed);
  });
}

export async function listSpaceTransactions(accountId: string, spaceId: string) {
  const space = await getSpace(accountId, spaceId);
  if (!space) return null;

  const rows = await db
    .select({
      id: schema.financeTransactions.id,
      occurredOn: schema.financeTransactions.occurredOn,
      amountMinor: schema.financeTransactions.amountMinor,
      type: schema.financeTransactions.type,
      merchant: schema.financeTransactions.merchant,
      notes: schema.financeTransactions.notes,
    })
    .from(schema.financeSpaceTransactions)
    .innerJoin(schema.financeTransactions, eq(schema.financeTransactions.id, schema.financeSpaceTransactions.transactionId))
    .where(and(eq(schema.financeSpaceTransactions.spaceId, spaceId), eq(schema.financeTransactions.accountId, accountId)))
    .orderBy(desc(schema.financeTransactions.occurredOn), desc(schema.financeTransactions.sortOrder), desc(schema.financeTransactions.id));

  const tagsByTransaction = await loadTagsForTransactions(rows.map((row) => row.id));

  return rows.map((row) => ({
    ...row,
    tags: tagsByTransaction.get(row.id) ?? [],
  }));
}

export async function listSpaceAllocations(accountId: string, spaceId: string) {
  const space = await getSpace(accountId, spaceId);
  if (!space) return null;

  return db
    .select({
      id: schema.financeSpaceAllocations.id,
      spaceId: schema.financeSpaceAllocations.spaceId,
      leftTransactionId: schema.financeSpaceAllocations.leftTransactionId,
      rightTransactionId: schema.financeSpaceAllocations.rightTransactionId,
      amountMinor: schema.financeSpaceAllocations.amountMinor,
      createdAt: schema.financeSpaceAllocations.createdAt,
    })
    .from(schema.financeSpaceAllocations)
    .where(eq(schema.financeSpaceAllocations.spaceId, spaceId))
    .orderBy(asc(schema.financeSpaceAllocations.createdAt));
}

export async function getSpaceDetail(accountId: string, spaceId: string) {
  const space = await getSpace(accountId, spaceId);
  if (!space) return null;

  const [transactions, allocations] = await Promise.all([listSpaceTransactions(accountId, spaceId), listSpaceAllocations(accountId, spaceId)]);

  return {
    space,
    transactions: transactions ?? [],
    allocations: allocations ?? [],
  };
}

async function countSpaceMembers(spaceId: string, transactionIds: string[]) {
  const [row] = await db
    .select({ total: count() })
    .from(schema.financeSpaceTransactions)
    .where(and(eq(schema.financeSpaceTransactions.spaceId, spaceId), inArray(schema.financeSpaceTransactions.transactionId, transactionIds)));
  return Number(row?.total ?? 0);
}

/** Both transactions must already be members of the space; amount must be a positive integer (minor units). */
export async function createSpaceAllocation(userId: string, accountId: string, spaceId: string, payload: SpaceAllocationPayload) {
  if (payload.leftTransactionId === payload.rightTransactionId) return null;
  if (!Number.isInteger(payload.amountMinor) || payload.amountMinor <= 0) return null;

  const space = await getSpace(accountId, spaceId);
  if (!space) return null;

  const memberCount = await countSpaceMembers(spaceId, [payload.leftTransactionId, payload.rightTransactionId]);
  if (memberCount !== 2) return null;

  const detail = await getSpaceDetail(accountId, spaceId);
  if (!detail) return null;

  const left = detail.transactions.find((row) => row.id === payload.leftTransactionId);
  const right = detail.transactions.find((row) => row.id === payload.rightTransactionId);
  if (!left || !right) return null;
  if (!canAllocateTransactionTypes(left.type, right.type)) return null;

  const remainders = spaceRemainders(detail.transactions, detail.allocations);
  const leftOpen = remainders.find((row) => row.transactionId === left.id)?.remainderMinor ?? 0;
  const rightOpen = remainders.find((row) => row.transactionId === right.id)?.remainderMinor ?? 0;
  if (payload.amountMinor > maxAllocationMinor(leftOpen, rightOpen)) return null;

  const [created] = await db
    .insert(schema.financeSpaceAllocations)
    .values({
      spaceId,
      leftTransactionId: payload.leftTransactionId,
      rightTransactionId: payload.rightTransactionId,
      amountMinor: payload.amountMinor,
      createdById: userId,
      updatedById: userId,
    })
    .returning();
  return created;
}

export async function updateSpaceAllocation(userId: string, accountId: string, spaceId: string, allocationId: string, amountMinor: number) {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) return null;

  const space = await getSpace(accountId, spaceId);
  if (!space) return null;

  const [updated] = await db
    .update(schema.financeSpaceAllocations)
    .set({ amountMinor, updatedById: userId })
    .where(and(eq(schema.financeSpaceAllocations.id, allocationId), eq(schema.financeSpaceAllocations.spaceId, spaceId)))
    .returning();
  return updated ?? null;
}

export async function deleteSpaceAllocation(accountId: string, spaceId: string, allocationId: string) {
  const space = await getSpace(accountId, spaceId);
  if (!space) return false;

  const [removed] = await db
    .delete(schema.financeSpaceAllocations)
    .where(and(eq(schema.financeSpaceAllocations.id, allocationId), eq(schema.financeSpaceAllocations.spaceId, spaceId)))
    .returning({ id: schema.financeSpaceAllocations.id });
  return Boolean(removed);
}

export async function attachTransactionTag(accountId: string, transactionId: string, tagId: string) {
  const [transaction] = await db
    .select({ id: schema.financeTransactions.id })
    .from(schema.financeTransactions)
    .where(and(eq(schema.financeTransactions.id, transactionId), eq(schema.financeTransactions.accountId, accountId)))
    .limit(1);
  if (!transaction) return null;

  const [tag] = await db
    .select({
      id: schema.financeTags.id,
      name: schema.financeTags.name,
      colorHex: schema.financeTags.colorHex,
    })
    .from(schema.financeTags)
    .where(and(eq(schema.financeTags.id, tagId), eq(schema.financeTags.accountId, accountId)))
    .limit(1);
  if (!tag) return null;

  await db.insert(schema.financeTransactionTags).values({ transactionId, tagId }).onConflictDoNothing();

  return tag;
}

export async function detachTransactionTag(accountId: string, transactionId: string, tagId: string) {
  const [transaction] = await db
    .select({ id: schema.financeTransactions.id })
    .from(schema.financeTransactions)
    .where(and(eq(schema.financeTransactions.id, transactionId), eq(schema.financeTransactions.accountId, accountId)))
    .limit(1);
  if (!transaction) return false;

  const [removed] = await db
    .delete(schema.financeTransactionTags)
    .where(and(eq(schema.financeTransactionTags.transactionId, transactionId), eq(schema.financeTransactionTags.tagId, tagId)))
    .returning({ tagId: schema.financeTransactionTags.tagId });

  return Boolean(removed);
}

export async function listTransactions(accountId: string, query: TransactionsQuery) {
  const conditions = [eq(schema.financeTransactions.accountId, accountId)];

  if (query.search) {
    conditions.push(
      buildTransactionSearchCondition(query.search, {
        merchant: schema.financeTransactions.merchant,
        notes: schema.financeTransactions.notes,
        amountMinor: schema.financeTransactions.amountMinor,
      })
    );
  }
  if (query.tagIds?.length) {
    const tagCondition = tagFilterCondition(query.tagIds, sql`${schema.financeTransactions.id}`, sql`${schema.financeTransactionTags}`, {
      transactionId: sql`${schema.financeTransactionTags.transactionId}`,
      tagId: sql`${schema.financeTransactionTags.tagId}`,
    });
    conditions.push(tagCondition);
  }
  if (query.type) {
    conditions.push(eq(schema.financeTransactions.type, query.type));
  }
  if (query.dateFrom) {
    conditions.push(gte(schema.financeTransactions.occurredOn, query.dateFrom));
  }
  if (query.dateTo) {
    conditions.push(lte(schema.financeTransactions.occurredOn, query.dateTo));
  }
  if (query.spaceId) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${schema.financeSpaceTransactions}
        WHERE ${schema.financeSpaceTransactions.transactionId} = ${schema.financeTransactions.id}
        AND ${schema.financeSpaceTransactions.spaceId} = ${query.spaceId}
      )`
    );
  }

  const whereExpr = and(...conditions);
  const sortColumn = sortMap[query.sortBy];
  const ascending = query.sortDirection === "asc";
  const direction = ascending ? asc(sortColumn) : desc(sortColumn);
  // Within the same day (or other primary-key ties), keep statement order.
  // Desc tables show the latest-in-day first so running balances read top→bottom.
  const tieBreakers =
    query.sortBy === "occurredOn"
      ? ascending
        ? [asc(schema.financeTransactions.sortOrder), asc(schema.financeTransactions.id)]
        : [desc(schema.financeTransactions.sortOrder), desc(schema.financeTransactions.id)]
      : [desc(schema.financeTransactions.occurredOn), desc(schema.financeTransactions.sortOrder), desc(schema.financeTransactions.id)];
  const offset = query.pageIndex * query.pageSize;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: schema.financeTransactions.id,
        occurredOn: schema.financeTransactions.occurredOn,
        amountMinor: schema.financeTransactions.amountMinor,
        balanceMinor: schema.financeTransactions.balanceMinor,
        type: schema.financeTransactions.type,
        merchant: schema.financeTransactions.merchant,
        notes: schema.financeTransactions.notes,
        createdAt: schema.financeTransactions.createdAt,
      })
      .from(schema.financeTransactions)
      .where(whereExpr)
      .orderBy(direction, ...tieBreakers)
      .limit(query.pageSize)
      .offset(offset),
    db.select({ total: count() }).from(schema.financeTransactions).where(whereExpr),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);
  const loaded = offset + rows.length;
  const transactionIds = rows.map((row) => row.id);
  const tagsByTransaction = await loadTagsForTransactions(transactionIds);
  const spacesByTransaction = await loadSpacesForTransactions(transactionIds);

  return {
    rows: rows.map((row) => ({
      ...row,
      tags: tagsByTransaction.get(row.id) ?? [],
      spaces: spacesByTransaction.get(row.id) ?? [],
    })),
    total,
    hasMore: loaded < total,
  };
}

export async function createTransaction(userId: string, accountId: string, payload: TxPayload) {
  const [created] = await db
    .insert(schema.financeTransactions)
    .values({
      accountId,
      occurredOn: payload.occurredOn,
      amountMinor: payload.amountMinor,
      currencyCode: "USD",
      type: payload.type,
      merchant: payload.merchant,
      notes: payload.notes,
      externalRef: payload.externalRef,
      sortOrder: payload.sortOrder ?? 0,
      createdById: userId,
      updatedById: userId,
    })
    .returning();
  return created;
}

export async function updateTransaction(userId: string, accountId: string, transactionId: string, payload: Partial<TxPayload>) {
  const patch: Partial<typeof schema.financeTransactions.$inferInsert> = { updatedById: userId };

  if (payload.occurredOn !== undefined) patch.occurredOn = payload.occurredOn;
  if (payload.amountMinor !== undefined) patch.amountMinor = payload.amountMinor;
  if (payload.type !== undefined) patch.type = payload.type;
  if (payload.merchant !== undefined) patch.merchant = payload.merchant;
  if (payload.notes !== undefined) patch.notes = payload.notes;
  if (payload.externalRef !== undefined) patch.externalRef = payload.externalRef;
  if (payload.sortOrder !== undefined) patch.sortOrder = payload.sortOrder;

  const [updated] = await db
    .update(schema.financeTransactions)
    .set(patch)
    .where(and(eq(schema.financeTransactions.id, transactionId), eq(schema.financeTransactions.accountId, accountId)))
    .returning();
  return updated ?? null;
}

export async function deleteTransaction(accountId: string, transactionId: string) {
  const [removed] = await db
    .delete(schema.financeTransactions)
    .where(and(eq(schema.financeTransactions.id, transactionId), eq(schema.financeTransactions.accountId, accountId)))
    .returning({ id: schema.financeTransactions.id });
  return Boolean(removed);
}

async function listDistinctMerchantsForType(accountId: string, type: MerchantTransactionType) {
  const result = await db.execute(sql`
    select distinct trim(t.merchant) as merchant
    from chhanchhan.finance_transactions t
    where t.account_id = ${accountId}
      and t.type = ${type}
      and t.merchant is not null
      and trim(t.merchant) != ''
  `);

  return result.rows.map((row) => String((row as { merchant: string }).merchant)).filter(Boolean);
}

export type SmartTagProfileBreakdown = {
  tagIds: string[];
  tagNames: string[];
  label: string;
  count: number;
};

export type SmartTagMerchantGroup = {
  merchant: string;
  profiles: SmartTagProfileBreakdown[];
};

export type SmartTaggingPreview = {
  merchant: string;
  newTagId: string;
  newTagName: string;
  exact: SmartTagMerchantGroup | null;
  fuzzy: SmartTagMerchantGroup[];
};

export type SmartTagApplyMode = "replace" | "append";

type SmartTagQuery = {
  merchant: string;
  newTagId: string;
  sourceTransactionId: string;
  type: "expense" | "income" | "transfer";
};

type SmartTagMigration = {
  merchant: string;
  fromTagIds: string[] | null;
  enabled: boolean;
};

function tagProfileKey(tagIds: string[]): string {
  return tagIds.length ? [...tagIds].sort().join(",") : "__none__";
}

function profileMatchesTags(tags: TransactionTag[], fromTagIds: string[] | null): boolean {
  const ids = tags.map((tag) => tag.id).sort();
  if (fromTagIds === null) return ids.length === 0;
  const expected = [...fromTagIds].sort();
  return ids.length === expected.length && ids.every((id, index) => id === expected[index]);
}

function profilesNeedingTag(profiles: SmartTagProfileBreakdown[], newTagId: string): SmartTagProfileBreakdown[] {
  return profiles.filter((profile) => !(profile.tagIds.length === 1 && profile.tagIds[0] === newTagId));
}

async function listTransactionIdsForMerchant(
  accountId: string,
  merchant: string,
  type: SmartTagQuery["type"],
  excludeTransactionId?: string
): Promise<string[]> {
  const excludeFilter = excludeTransactionId ? sql`and t.id != ${excludeTransactionId}` : sql``;

  const result = await db.execute(sql`
    select t.id
    from chhanchhan.finance_transactions t
    where t.account_id = ${accountId}
      and t.type = ${type}
      and lower(trim(t.merchant)) = lower(${merchant})
      ${excludeFilter}
  `);

  return result.rows.map((row) => String((row as { id: string }).id));
}

async function getMerchantTagProfileBreakdown(
  accountId: string,
  merchant: string,
  type: SmartTagQuery["type"],
  excludeTransactionId?: string
): Promise<SmartTagProfileBreakdown[]> {
  const transactionIds = await listTransactionIdsForMerchant(accountId, merchant, type, excludeTransactionId);
  if (!transactionIds.length) return [];

  const tagsByTransaction = await loadTagsForTransactions(transactionIds);
  const profileCounts = new Map<string, SmartTagProfileBreakdown>();

  for (const transactionId of transactionIds) {
    const tags = tagsByTransaction.get(transactionId) ?? [];
    const tagIds = tags.map((tag) => tag.id).sort();
    const key = tagProfileKey(tagIds);
    const existing = profileCounts.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    profileCounts.set(key, {
      tagIds,
      tagNames: tags.map((tag) => tag.name),
      label: tags.length ? tags.map((tag) => tag.name).join(", ") : "No tags",
      count: 1,
    });
  }

  return [...profileCounts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export async function previewSmartTagging(accountId: string, query: SmartTagQuery): Promise<SmartTaggingPreview | null> {
  const merchant = query.merchant.trim();
  if (!merchant) return null;

  const [newTagRow] = await db
    .select({ name: schema.financeTags.name })
    .from(schema.financeTags)
    .where(and(eq(schema.financeTags.id, query.newTagId), eq(schema.financeTags.accountId, accountId)))
    .limit(1);
  if (!newTagRow) return null;

  const exactProfiles = profilesNeedingTag(
    await getMerchantTagProfileBreakdown(accountId, merchant, query.type, query.sourceTransactionId),
    query.newTagId
  );
  const exact = exactProfiles.length ? { merchant, profiles: exactProfiles } : null;

  const distinctMerchants = await listDistinctMerchantsForType(accountId, query.type);
  const fuzzyMerchants = rankFuzzyMerchants(merchant, distinctMerchants).filter(
    (candidate) => normalizeMerchant(candidate) !== normalizeMerchant(merchant)
  );

  const fuzzy: SmartTagMerchantGroup[] = [];
  for (const fuzzyMerchant of fuzzyMerchants) {
    const profiles = profilesNeedingTag(await getMerchantTagProfileBreakdown(accountId, fuzzyMerchant, query.type), query.newTagId);
    if (profiles.length) fuzzy.push({ merchant: fuzzyMerchant, profiles });
  }

  if (!exact && !fuzzy.length) return null;

  return {
    merchant,
    newTagId: query.newTagId,
    newTagName: newTagRow.name,
    exact,
    fuzzy,
  };
}

export async function applySmartTagging(
  userId: string,
  accountId: string,
  payload: {
    sourceTransactionId: string;
    newTagId: string;
    type: SmartTagQuery["type"];
    mode: SmartTagApplyMode;
    migrations: SmartTagMigration[];
  }
) {
  await attachTransactionTag(accountId, payload.sourceTransactionId, payload.newTagId);

  let updatedCount = 0;
  const seen = new Set<string>();

  for (const migration of payload.migrations) {
    if (!migration.enabled) continue;

    const merchant = migration.merchant.trim();
    if (!merchant) continue;

    const key = `${merchant}::${tagProfileKey(migration.fromTagIds ?? [])}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const transactionIds = await listTransactionIdsForMerchant(accountId, merchant, payload.type);
    if (!transactionIds.length) continue;

    const tagsByTransaction = await loadTagsForTransactions(transactionIds);

    for (const transactionId of transactionIds) {
      if (transactionId === payload.sourceTransactionId) continue;

      const tags = tagsByTransaction.get(transactionId) ?? [];
      if (!profileMatchesTags(tags, migration.fromTagIds)) continue;

      if (payload.mode === "replace") {
        await db.delete(schema.financeTransactionTags).where(eq(schema.financeTransactionTags.transactionId, transactionId));
      } else if (tags.some((tag) => tag.id === payload.newTagId)) {
        continue;
      }

      await db.insert(schema.financeTransactionTags).values({ transactionId, tagId: payload.newTagId }).onConflictDoNothing();

      updatedCount += 1;
    }
  }

  return { updatedCount };
}

export async function listBudgets(accountId: string) {
  const budgets = await db
    .select({
      id: schema.financeBudgets.id,
      name: schema.financeBudgets.name,
      period: schema.financeBudgets.period,
      startDate: schema.financeBudgets.startDate,
      endDate: schema.financeBudgets.endDate,
      limitMinor: schema.financeBudgets.limitMinor,
      tagId: schema.financeBudgets.tagId,
      tagName: schema.financeTags.name,
      isActive: schema.financeBudgets.isActive,
    })
    .from(schema.financeBudgets)
    .leftJoin(schema.financeTags, eq(schema.financeTags.id, schema.financeBudgets.tagId))
    .where(eq(schema.financeBudgets.accountId, accountId))
    .orderBy(desc(schema.financeBudgets.createdAt));

  return budgets;
}

export async function upsertBudget(userId: string, accountId: string, payload: BudgetPayload, id?: string) {
  if (!id) {
    const [created] = await db
      .insert(schema.financeBudgets)
      .values({
        accountId,
        name: payload.name,
        tagId: payload.tagId,
        period: payload.period,
        startDate: payload.startDate,
        endDate: payload.endDate,
        limitMinor: payload.limitMinor,
        isActive: payload.isActive,
        createdById: userId,
        updatedById: userId,
      })
      .returning();
    return created;
  }

  const [updated] = await db
    .update(schema.financeBudgets)
    .set({
      name: payload.name,
      tagId: payload.tagId,
      period: payload.period,
      startDate: payload.startDate,
      endDate: payload.endDate,
      limitMinor: payload.limitMinor,
      isActive: payload.isActive,
      updatedById: userId,
    })
    .where(and(eq(schema.financeBudgets.id, id), eq(schema.financeBudgets.accountId, accountId)))
    .returning();
  return updated ?? null;
}

export async function listGoals(accountId: string) {
  return db.query.financeGoals.findMany({
    where: eq(schema.financeGoals.accountId, accountId),
    orderBy: [desc(schema.financeGoals.createdAt)],
  });
}

export async function upsertGoal(userId: string, accountId: string, payload: GoalPayload, id?: string) {
  if (!id) {
    const [created] = await db
      .insert(schema.financeGoals)
      .values({
        accountId,
        name: payload.name,
        targetMinor: payload.targetMinor,
        currentMinor: payload.currentMinor,
        targetDate: payload.targetDate,
        status: payload.status,
        createdById: userId,
        updatedById: userId,
      })
      .returning();
    return created;
  }

  const [updated] = await db
    .update(schema.financeGoals)
    .set({
      name: payload.name,
      targetMinor: payload.targetMinor,
      currentMinor: payload.currentMinor,
      targetDate: payload.targetDate,
      status: payload.status,
      updatedById: userId,
    })
    .where(and(eq(schema.financeGoals.id, id), eq(schema.financeGoals.accountId, accountId)))
    .returning();
  return updated ?? null;
}

export async function countAccountTransactions(accountId: string): Promise<number> {
  const [row] = await db.select({ total: count() }).from(schema.financeTransactions).where(eq(schema.financeTransactions.accountId, accountId));
  return Number(row?.total ?? 0);
}

export async function getCurrentBalance(accountId: string) {
  const [[latestTxnDate], account, [txnBalance], [transactionCountRow]] = await Promise.all([
    db
      .select({ occurredOn: schema.financeTransactions.occurredOn })
      .from(schema.financeTransactions)
      .where(eq(schema.financeTransactions.accountId, accountId))
      .orderBy(desc(schema.financeTransactions.occurredOn), desc(schema.financeTransactions.sortOrder), desc(schema.financeTransactions.createdAt))
      .limit(1),
    db.query.financeAccounts.findFirst({
      where: eq(schema.financeAccounts.id, accountId),
      columns: { balanceMinor: true, balanceAsOf: true },
    }),
    db
      .select({
        balanceMinor: schema.financeTransactions.balanceMinor,
        occurredOn: schema.financeTransactions.occurredOn,
        sortOrder: schema.financeTransactions.sortOrder,
      })
      .from(schema.financeTransactions)
      .where(and(eq(schema.financeTransactions.accountId, accountId), isNotNull(schema.financeTransactions.balanceMinor)))
      .orderBy(desc(schema.financeTransactions.occurredOn), desc(schema.financeTransactions.sortOrder), desc(schema.financeTransactions.createdAt))
      .limit(1),
    db.select({ total: count() }).from(schema.financeTransactions).where(eq(schema.financeTransactions.accountId, accountId)),
  ]);

  const transactionCount = Number(transactionCountRow?.total ?? 0);

  const candidates = [];
  if (account?.balanceMinor != null && account.balanceAsOf) {
    candidates.push({
      balanceMinor: account.balanceMinor,
      asOf: account.balanceAsOf,
      sortOrder: 0,
    });
  }
  if (txnBalance?.balanceMinor != null) {
    candidates.push({
      balanceMinor: txnBalance.balanceMinor,
      asOf: txnBalance.occurredOn,
      sortOrder: txnBalance.sortOrder,
    });
  }

  if (!candidates.length) return null;

  const latest = candidates.reduce((best, candidate) => (isBalanceSnapshotNewer(candidate, best) ? candidate : best));

  const latestActivityOn = latestTxnDate?.occurredOn ?? latest.asOf;

  return {
    balanceMinor: latest.balanceMinor,
    asOf: latest.asOf,
    latestTransactionOn: latestActivityOn,
    isStale: latestActivityOn > latest.asOf,
    transactionCount,
  };
}

export async function listTransactionPeriods(accountId: string) {
  const monthsResult = await db.execute(sql`
    select distinct to_char(date_trunc('month', t.occurred_on), 'YYYY-MM') as month_key
    from chhanchhan.finance_transactions t
    where t.account_id = ${accountId}
    order by month_key desc
  `);

  const yearsResult = await db.execute(sql`
    select distinct extract(year from t.occurred_on)::int as year
    from chhanchhan.finance_transactions t
    where t.account_id = ${accountId}
    order by year desc
  `);

  return {
    months: monthsResult.rows.map((row) => String((row as { month_key: string }).month_key)),
    years: yearsResult.rows.map((row) => readRowYear(row as Record<string, unknown>)).filter((year): year is number => year != null),
  };
}

export async function getTransactionSummary(accountId: string, selection: SummarySelection) {
  const filters = summaryTransactionFilters(selection);

  const result = await db.execute(sql`
    select
      coalesce(sum(case when t.type = 'income' then t.amount_minor else 0 end), 0)::bigint as income_minor,
      coalesce(sum(case when t.type = 'expense' then t.amount_minor else 0 end), 0)::bigint as expense_minor
    from chhanchhan.finance_transactions t
    where t.account_id = ${accountId}
      and ${filters.dateFilter}
      and ${filters.spaceFilter}
      and ${filters.searchFilter}
      and ${filters.tagFilter}
  `);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  const incomeMinor = parseSqlMinor(row?.income_minor ?? row?.incomeMinor);
  const expenseMinor = parseSqlMinor(row?.expense_minor ?? row?.expenseMinor);

  return {
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
  };
}

export async function getTagSpend(accountId: string, selection: SummarySelection) {
  const filters = summaryTransactionFilters(selection);

  const result = await db.execute(sql`
    select
      tg.name as tag_name,
      tg.color_hex,
      coalesce(sum(t.amount_minor), 0)::bigint as amount_minor
    from chhanchhan.finance_transactions t
    inner join chhanchhan.finance_transaction_tags ftt on ftt.transaction_id = t.id
    inner join chhanchhan.finance_tags tg on tg.id = ftt.tag_id
    where t.account_id = ${accountId}
      and t.type = 'expense'
      and ${filters.dateFilter}
      and ${filters.spaceFilter}
      and ${filters.searchFilter}
      and ${filters.tagFilter}
    group by tg.id, tg.name, tg.color_hex
    order by amount_minor desc
    limit 8
  `);

  return result.rows as Array<{ tag_name: string; color_hex: string | null; amount_minor: number }>;
}

export async function getMerchantSpend(accountId: string, selection: SummarySelection, limit = 10) {
  const filters = summaryTransactionFilters(selection);

  const result = await db.execute(sql`
    select
      coalesce(nullif(trim(t.merchant), ''), 'Unknown') as merchant_name,
      coalesce(sum(t.amount_minor), 0)::bigint as amount_minor
    from chhanchhan.finance_transactions t
    where t.account_id = ${accountId}
      and t.type = 'expense'
      and ${filters.dateFilter}
      and ${filters.spaceFilter}
      and ${filters.searchFilter}
      and ${filters.tagFilter}
    group by merchant_name
    order by amount_minor desc
    limit ${limit}
  `);

  return result.rows as Array<{ merchant_name: string; amount_minor: number }>;
}

export async function getSpaceSpend(accountId: string, selection: SummarySelection) {
  const filters = summaryTransactionFilters(selection);

  const result = await db.execute(sql`
    select
      s.name as space_name,
      s.color_hex,
      coalesce(sum(t.amount_minor), 0)::bigint as amount_minor
    from chhanchhan.finance_transactions t
    inner join chhanchhan.finance_space_transactions fst
      on fst.transaction_id = t.id
    inner join chhanchhan.finance_spaces s on s.id = fst.space_id
    where t.account_id = ${accountId}
      and t.type = 'expense'
      and ${filters.dateFilter}
      and ${filters.spaceFilter}
      and ${filters.searchFilter}
      and ${filters.tagFilter}
    group by s.id, s.name, s.color_hex
    order by amount_minor desc
    limit 8
  `);

  return result.rows as Array<{ space_name: string; color_hex: string | null; amount_minor: number }>;
}

/** Bill tags are matched by name (see `billTagSqlFilter`); each bill tag on a transaction yields its own row. */
function billTagNameSqlFilter() {
  return sql`tg.name ~* '\\mbill\\M'`;
}

export async function getTagMerchantBills(accountId: string, selection: SummarySelection) {
  const filters = summaryTransactionFilters(selection);

  const result = await db.execute(sql`
    select
      tg.id as tag_id,
      tg.name as tag_name,
      tg.color_hex as tag_color,
      coalesce(nullif(trim(t.merchant), ''), 'Unknown') as merchant_name,
      to_char(date_trunc('month', t.occurred_on), 'YYYY-MM') as month_key,
      coalesce(sum(t.amount_minor), 0)::bigint as amount_minor,
      count(*)::int as txn_count
    from chhanchhan.finance_transactions t
    inner join chhanchhan.finance_transaction_tags ftt on ftt.transaction_id = t.id
    inner join chhanchhan.finance_tags tg on tg.id = ftt.tag_id
    where t.account_id = ${accountId}
      and t.type = 'expense'
      and ${billTagSqlFilter()}
      and ${billTagNameSqlFilter()}
      and ${filters.dateFilter}
      and ${filters.spaceFilter}
      and ${filters.searchFilter}
      and ${filters.tagFilter}
    group by tg.id, tg.name, tg.color_hex, merchant_name, month_key
    order by tag_name asc, merchant_name asc, month_key asc
  `);

  return result.rows as Array<{
    tag_id: string;
    tag_name: string;
    tag_color: string | null;
    merchant_name: string;
    month_key: string;
    amount_minor: number;
    txn_count: number;
  }>;
}

export async function getTagMerchantBillsForYear(accountId: string, year: number) {
  const result = await db.execute(sql`
    select
      tg.id as tag_id,
      tg.name as tag_name,
      tg.color_hex as tag_color,
      coalesce(nullif(trim(t.merchant), ''), 'Unknown') as merchant_name,
      to_char(date_trunc('month', t.occurred_on), 'YYYY-MM') as month_key,
      coalesce(sum(t.amount_minor), 0)::bigint as amount_minor,
      count(*)::int as txn_count
    from chhanchhan.finance_transactions t
    inner join chhanchhan.finance_transaction_tags ftt on ftt.transaction_id = t.id
    inner join chhanchhan.finance_tags tg on tg.id = ftt.tag_id
    where t.account_id = ${accountId}
      and t.type = 'expense'
      and ${billTagSqlFilter()}
      and ${billTagNameSqlFilter()}
      and extract(year from t.occurred_on) = ${year}
    group by tg.id, tg.name, tg.color_hex, merchant_name, month_key
    order by tag_name asc, merchant_name asc, month_key asc
  `);

  return result.rows as Array<{
    tag_id: string;
    tag_name: string;
    tag_color: string | null;
    merchant_name: string;
    month_key: string;
    amount_minor: number;
    txn_count: number;
  }>;
}

export async function getMonthlyTrend(accountId: string, monthCount = 12) {
  const safeCount = Math.min(24, Math.max(3, monthCount));
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (safeCount - 1));
  const dateFrom = start.toISOString().slice(0, 10);

  const result = await db.execute(sql`
    select
      to_char(date_trunc('month', t.occurred_on), 'YYYY-MM') as month_key,
      coalesce(sum(case when t.type = 'income' then t.amount_minor else 0 end), 0)::bigint as income_minor,
      coalesce(sum(case when t.type = 'expense' then t.amount_minor else 0 end), 0)::bigint as expense_minor
    from chhanchhan.finance_transactions t
    where t.account_id = ${accountId}
      and t.occurred_on >= ${dateFrom}::date
    group by month_key
    order by month_key asc
  `);

  return result.rows.map((row) => {
    const typed = row as { month_key: string; income_minor: number; expense_minor: number };
    const incomeMinor = Number(typed.income_minor);
    const expenseMinor = Number(typed.expense_minor);
    return {
      monthKey: String(typed.month_key),
      incomeMinor,
      expenseMinor,
      netMinor: incomeMinor - expenseMinor,
    };
  });
}

export async function getTagTrend(accountId: string, monthCount = 12) {
  const safeCount = Math.min(24, Math.max(3, monthCount));
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (safeCount - 1));
  const dateFrom = start.toISOString().slice(0, 10);

  const result = await db.execute(sql`
    select
      to_char(date_trunc('month', t.occurred_on), 'YYYY-MM') as month_key,
      coalesce(tg.name, 'Untagged') as tag_name,
      tg.color_hex,
      coalesce(sum(t.amount_minor), 0)::bigint as amount_minor
    from chhanchhan.finance_transactions t
    left join chhanchhan.finance_transaction_tags ftt on ftt.transaction_id = t.id
    left join chhanchhan.finance_tags tg on tg.id = ftt.tag_id
    where t.account_id = ${accountId}
      and t.type = 'expense'
      and t.occurred_on >= ${dateFrom}::date
    group by month_key, tag_name, tg.color_hex
    order by month_key asc, amount_minor desc
  `);

  return result.rows as Array<{
    month_key: string;
    tag_name: string;
    color_hex: string | null;
    amount_minor: number;
  }>;
}

function summarySearchFilter(search?: string) {
  return buildSummarySearchFilterSql(search);
}

function summaryTagFilter(tagIds?: string[]) {
  if (!tagIds?.length) return sql`true`;
  return tagFilterCondition(tagIds, sql`t.id`, sql`chhanchhan.finance_transaction_tags ftt`, {
    transactionId: sql`ftt.transaction_id`,
    tagId: sql`ftt.tag_id`,
  });
}

/** Matches transactions carrying any listed tag; the special id "untagged" matches transactions with no tags. */
function tagFilterCondition(tagIds: string[], transactionIdExpr: SQL, linkTable: SQL, columns: { transactionId: SQL; tagId: SQL }): SQL {
  const wantsUntagged = tagIds.includes("untagged");
  const realIds = tagIds.filter((tagId) => tagId !== "untagged");
  const parts: SQL[] = [];

  if (realIds.length) {
    parts.push(sql`exists (
      select 1 from ${linkTable}
      where ${columns.transactionId} = ${transactionIdExpr}
        and ${columns.tagId} in (${sql.join(
          realIds.map((tagId) => sql`${tagId}`),
          sql`, `
        )})
    )`);
  }

  if (wantsUntagged) {
    parts.push(sql`not exists (
      select 1 from ${linkTable}
      where ${columns.transactionId} = ${transactionIdExpr}
    )`);
  }

  return sql`(${sql.join(parts, sql` or `)})`;
}

function summaryTransactionFilters(selection: SummarySelection) {
  return {
    dateFilter: summaryDateFilter(selection),
    spaceFilter: summarySpaceFilter(selection.spaceId),
    searchFilter: summarySearchFilter(selection.search),
    tagFilter: summaryTagFilter(selection.tagIds),
  };
}

function summarySpaceFilter(spaceId?: string) {
  if (!spaceId) return sql`true`;

  return sql`exists (
    select 1 from chhanchhan.finance_space_transactions fst
    where fst.transaction_id = t.id
      and fst.space_id = ${spaceId}
  )`;
}

function summaryDateFilter(selection: SummarySelection) {
  if (selection.period === "month" && selection.month) {
    return sql`to_char(date_trunc('month', t.occurred_on), 'YYYY-MM') = ${selection.month}`;
  }

  if (selection.period === "year" && selection.year != null) {
    return sql`extract(year from t.occurred_on) = ${selection.year}`;
  }

  return sql`true`;
}

export async function getAnalytics(accountId: string) {
  const tagSpend = await getTagSpend(accountId, { period: "month", month: currentMonthKey() });

  const budgetUsage = await db.execute(sql`
    select
      b.id,
      b.name,
      b.limit_minor,
      coalesce(sum(case when t.type = 'expense' then t.amount_minor else 0 end), 0)::bigint as spent_minor
    from chhanchhan.finance_budgets b
    left join chhanchhan.finance_transactions t
      on t.account_id = b.account_id
      and (
        b.tag_id is null
        or exists (
          select 1 from chhanchhan.finance_transaction_tags ftt
          where ftt.transaction_id = t.id
            and ftt.tag_id = b.tag_id
        )
      )
      and t.occurred_on between b.start_date and coalesce(b.end_date, now()::date)
    where b.account_id = ${accountId}
      and b.is_active = true
    group by b.id, b.name, b.limit_minor
    order by b.created_at desc
    limit 8
  `);

  const goals = await db.execute(sql`
    select id, name, target_minor, current_minor, status
    from chhanchhan.finance_goals
    where account_id = ${accountId}
    order by created_at desc
    limit 8
  `);

  const monthly = await getTransactionSummary(accountId, { period: "month", month: currentMonthKey() });
  const allTime = await getTransactionSummary(accountId, { period: "all" });

  return {
    monthly,
    allTime,
    tagSpend,
    budgetUsage: budgetUsage.rows as Array<{ id: string; name: string; limit_minor: number; spent_minor: number }>,
    goals: goals.rows as Array<{ id: string; name: string; target_minor: number; current_minor: number; status: string }>,
  };
}
