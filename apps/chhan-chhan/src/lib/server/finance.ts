import { normalizeMerchant, rankFuzzyMerchants } from "$lib/finance/merchant-match";
import { billCategorySqlFilter } from "$lib/finance/bill-categories";
import { parseSqlMinor } from "$lib/finance/money";
import { isRefundCategoryName } from "$lib/finance/refunds";
import { buildSummarySearchFilterSql, buildTransactionSearchCondition } from "$lib/finance/transaction-search";
import {
  computeRefundLinkWarnings,
  type RefundLinkRow,
  type RefundWarningTransaction,
  type TransactionWarning,
} from "$lib/finance/transaction-warnings";
import { currentMonthKey, readRowYear, type SummarySelection } from "$lib/finance/summary";
import { isBalanceSnapshotNewer } from "$lib/server/balance";
import { db, schema } from "@pocket-dimension/db";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { z } from "zod";
import type {
  budgetUpsertSchema,
  createCategorySchema,
  createTagSchema,
  goalUpsertSchema,
  transactionUpsertSchema,
  transactionsQuerySchema,
} from "$lib/validation/finance";

type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;
type TxPayload = z.infer<typeof transactionUpsertSchema>;
type BudgetPayload = z.infer<typeof budgetUpsertSchema>;
type GoalPayload = z.infer<typeof goalUpsertSchema>;
type CategoryPayload = z.infer<typeof createCategorySchema>;
type UpdateCategoryPayload = z.infer<typeof import("$lib/validation/finance").updateCategorySchema>;
type TagPayload = z.infer<typeof createTagSchema>;
type UpdateTagPayload = z.infer<typeof import("$lib/validation/finance").updateTagSchema>;
type GroupPayload = z.infer<typeof import("$lib/validation/finance").createGroupSchema>;
type UpdateGroupPayload = z.infer<typeof import("$lib/validation/finance").updateGroupSchema>;

type TransactionTag = {
  id: string;
  name: string;
  colorHex: string | null;
};

type TransactionGroup = {
  id: string;
  name: string;
  colorHex: string | null;
};

type RefundLinkPeer = {
  id: string;
  occurredOn: string;
  merchant: string | null;
  amountMinor: number;
  type: string;
  categoryName: string | null;
  role: "credit" | "expense";
};

export type { TransactionWarning };

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

async function loadGroupsForTransactions(transactionIds: string[]) {
  if (!transactionIds.length) return new Map<string, TransactionGroup[]>();

  const groupRows = await db
    .select({
      transactionId: schema.financeTransactionGroups.transactionId,
      id: schema.financeGroups.id,
      name: schema.financeGroups.name,
      colorHex: schema.financeGroups.colorHex,
    })
    .from(schema.financeTransactionGroups)
    .innerJoin(schema.financeGroups, eq(schema.financeGroups.id, schema.financeTransactionGroups.groupId))
    .where(inArray(schema.financeTransactionGroups.transactionId, transactionIds))
    .orderBy(asc(schema.financeGroups.name));

  const groupsByTransaction = new Map<string, TransactionGroup[]>();
  for (const row of groupRows) {
    const groups = groupsByTransaction.get(row.transactionId) ?? [];
    groups.push({ id: row.id, name: row.name, colorHex: row.colorHex });
    groupsByTransaction.set(row.transactionId, groups);
  }

  return groupsByTransaction;
}

async function loadGroupHiddenForTransactions(transactionIds: string[], groupId: string) {
  if (!transactionIds.length) return new Map<string, boolean>();

  const hiddenRows = await db
    .select({
      transactionId: schema.financeTransactionGroups.transactionId,
      isHidden: schema.financeTransactionGroups.isHidden,
    })
    .from(schema.financeTransactionGroups)
    .where(and(eq(schema.financeTransactionGroups.groupId, groupId), inArray(schema.financeTransactionGroups.transactionId, transactionIds)));

  const hiddenByTransaction = new Map<string, boolean>();
  for (const row of hiddenRows) {
    hiddenByTransaction.set(row.transactionId, row.isHidden);
  }

  return hiddenByTransaction;
}

async function loadRefundLinksForTransactions(transactionIds: string[]) {
  if (!transactionIds.length) return new Map<string, RefundLinkPeer[]>();

  const rawLinks = await db
    .select({
      creditTransactionId: schema.financeTransactionRefundLinks.creditTransactionId,
      expenseTransactionId: schema.financeTransactionRefundLinks.expenseTransactionId,
    })
    .from(schema.financeTransactionRefundLinks)
    .where(
      or(
        inArray(schema.financeTransactionRefundLinks.creditTransactionId, transactionIds),
        inArray(schema.financeTransactionRefundLinks.expenseTransactionId, transactionIds)
      )
    );

  if (!rawLinks.length) return new Map<string, RefundLinkPeer[]>();

  const peerIds = new Set<string>();
  for (const link of rawLinks) {
    if (transactionIds.includes(link.creditTransactionId)) peerIds.add(link.expenseTransactionId);
    if (transactionIds.includes(link.expenseTransactionId)) peerIds.add(link.creditTransactionId);
  }

  const peerRows = await db
    .select({
      id: schema.financeTransactions.id,
      occurredOn: schema.financeTransactions.occurredOn,
      merchant: schema.financeTransactions.merchant,
      amountMinor: schema.financeTransactions.amountMinor,
      type: schema.financeTransactions.type,
      categoryName: schema.financeCategories.name,
    })
    .from(schema.financeTransactions)
    .leftJoin(schema.financeCategories, eq(schema.financeCategories.id, schema.financeTransactions.categoryId))
    .where(inArray(schema.financeTransactions.id, [...peerIds]));

  const peersById = new Map(peerRows.map((row) => [row.id, row]));
  const linksByTransaction = new Map<string, RefundLinkPeer[]>();

  for (const link of rawLinks) {
    if (transactionIds.includes(link.creditTransactionId)) {
      const peer = peersById.get(link.expenseTransactionId);
      if (!peer) continue;
      const peers = linksByTransaction.get(link.creditTransactionId) ?? [];
      peers.push({ ...peer, role: "expense" });
      linksByTransaction.set(link.creditTransactionId, peers);
    }
    if (transactionIds.includes(link.expenseTransactionId)) {
      const peer = peersById.get(link.creditTransactionId);
      if (!peer) continue;
      const peers = linksByTransaction.get(link.expenseTransactionId) ?? [];
      peers.push({ ...peer, role: "credit" });
      linksByTransaction.set(link.expenseTransactionId, peers);
    }
  }

  return linksByTransaction;
}

async function loadRefundLinkRowsForTransactions(transactionIds: string[]) {
  if (!transactionIds.length) return [] as RefundLinkRow[];

  const knownIds = new Set(transactionIds);
  const collected = new Map<string, RefundLinkRow>();
  let frontier = [...knownIds];

  while (frontier.length) {
    const batch = await db
      .select({
        creditTransactionId: schema.financeTransactionRefundLinks.creditTransactionId,
        expenseTransactionId: schema.financeTransactionRefundLinks.expenseTransactionId,
      })
      .from(schema.financeTransactionRefundLinks)
      .where(
        or(
          inArray(schema.financeTransactionRefundLinks.creditTransactionId, frontier),
          inArray(schema.financeTransactionRefundLinks.expenseTransactionId, frontier)
        )
      );

    const nextFrontier: string[] = [];
    for (const row of batch) {
      const key = `${row.creditTransactionId}:${row.expenseTransactionId}`;
      collected.set(key, row);
      if (!knownIds.has(row.creditTransactionId)) {
        knownIds.add(row.creditTransactionId);
        nextFrontier.push(row.creditTransactionId);
      }
      if (!knownIds.has(row.expenseTransactionId)) {
        knownIds.add(row.expenseTransactionId);
        nextFrontier.push(row.expenseTransactionId);
      }
    }

    frontier = nextFrontier;
  }

  return [...collected.values()];
}

async function loadRefundWarningTransactions(linkRows: RefundLinkRow[]) {
  const transactionIds = [...new Set(linkRows.flatMap((row) => [row.creditTransactionId, row.expenseTransactionId]))];
  if (!transactionIds.length) return new Map<string, RefundWarningTransaction>();

  const rows = await db
    .select({
      id: schema.financeTransactions.id,
      amountMinor: schema.financeTransactions.amountMinor,
      categoryName: schema.financeCategories.name,
    })
    .from(schema.financeTransactions)
    .leftJoin(schema.financeCategories, eq(schema.financeCategories.id, schema.financeTransactions.categoryId))
    .where(inArray(schema.financeTransactions.id, transactionIds));

  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        amountMinor: row.amountMinor,
        categoryName: row.categoryName,
      },
    ])
  );
}

function formatDifferenceMinor(differenceMinor: number) {
  const major = Math.abs(differenceMinor) / 100;
  return major.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function buildRefundWarningsForTransactions(transactionIds: string[]) {
  const linkRows = await loadRefundLinkRowsForTransactions(transactionIds);
  if (!linkRows.length) return new Map<string, TransactionWarning[]>();

  const transactions = await loadRefundWarningTransactions(linkRows);
  return computeRefundLinkWarnings(linkRows, transactions, formatDifferenceMinor);
}

export async function getRefundLinkClusterIds(accountId: string, seedTransactionId: string) {
  const [seed] = await db
    .select({ id: schema.financeTransactions.id })
    .from(schema.financeTransactions)
    .where(and(eq(schema.financeTransactions.id, seedTransactionId), eq(schema.financeTransactions.accountId, accountId)))
    .limit(1);
  if (!seed) return null;

  const linkRows = await loadRefundLinkRowsForTransactions([seedTransactionId]);
  if (!linkRows.length) return null;

  const ids = new Set<string>();
  for (const row of linkRows) {
    ids.add(row.creditTransactionId);
    ids.add(row.expenseTransactionId);
  }

  const clusterIds = [...ids];
  const accountRows = await db
    .select({ id: schema.financeTransactions.id })
    .from(schema.financeTransactions)
    .where(and(inArray(schema.financeTransactions.id, clusterIds), eq(schema.financeTransactions.accountId, accountId)));

  return accountRows.length === clusterIds.length ? clusterIds : null;
}

export async function attachRefundLink(accountId: string, creditTransactionId: string, expenseTransactionId: string) {
  const [credit] = await db
    .select({
      id: schema.financeTransactions.id,
      type: schema.financeTransactions.type,
      categoryName: schema.financeCategories.name,
    })
    .from(schema.financeTransactions)
    .leftJoin(schema.financeCategories, eq(schema.financeCategories.id, schema.financeTransactions.categoryId))
    .where(and(eq(schema.financeTransactions.id, creditTransactionId), eq(schema.financeTransactions.accountId, accountId)))
    .limit(1);
  if (!credit || !isRefundCategoryName(credit.categoryName)) return null;

  const [expense] = await db
    .select({
      id: schema.financeTransactions.id,
      type: schema.financeTransactions.type,
    })
    .from(schema.financeTransactions)
    .where(
      and(
        eq(schema.financeTransactions.id, expenseTransactionId),
        eq(schema.financeTransactions.accountId, accountId),
        eq(schema.financeTransactions.type, "expense")
      )
    )
    .limit(1);
  if (!expense) return null;

  await db.insert(schema.financeTransactionRefundLinks).values({ creditTransactionId, expenseTransactionId }).onConflictDoNothing();

  const [peer] = await db
    .select({
      id: schema.financeTransactions.id,
      occurredOn: schema.financeTransactions.occurredOn,
      merchant: schema.financeTransactions.merchant,
      amountMinor: schema.financeTransactions.amountMinor,
      type: schema.financeTransactions.type,
      categoryName: schema.financeCategories.name,
    })
    .from(schema.financeTransactions)
    .leftJoin(schema.financeCategories, eq(schema.financeCategories.id, schema.financeTransactions.categoryId))
    .where(eq(schema.financeTransactions.id, expenseTransactionId))
    .limit(1);

  if (!peer) return null;

  return {
    id: peer.id,
    occurredOn: peer.occurredOn,
    merchant: peer.merchant,
    amountMinor: peer.amountMinor,
    type: peer.type,
    categoryName: peer.categoryName,
    role: "expense" as const,
  };
}

export async function detachRefundLink(accountId: string, creditTransactionId: string, expenseTransactionId: string) {
  const [credit] = await db
    .select({ id: schema.financeTransactions.id })
    .from(schema.financeTransactions)
    .where(and(eq(schema.financeTransactions.id, creditTransactionId), eq(schema.financeTransactions.accountId, accountId)))
    .limit(1);
  if (!credit) return false;

  const [removed] = await db
    .delete(schema.financeTransactionRefundLinks)
    .where(
      and(
        eq(schema.financeTransactionRefundLinks.creditTransactionId, creditTransactionId),
        eq(schema.financeTransactionRefundLinks.expenseTransactionId, expenseTransactionId)
      )
    )
    .returning({ creditTransactionId: schema.financeTransactionRefundLinks.creditTransactionId });

  return Boolean(removed);
}

const sortMap = {
  occurredOn: schema.financeTransactions.occurredOn,
  amountMinor: schema.financeTransactions.amountMinor,
  merchant: schema.financeTransactions.merchant,
  type: schema.financeTransactions.type,
  createdAt: schema.financeTransactions.createdAt,
} as const;

export async function listAccountsForUser(userId: string) {
  return db
    .select({
      id: schema.financeAccounts.id,
      name: schema.financeAccounts.name,
      currencyCode: schema.financeAccounts.currencyCode,
      timezone: schema.financeAccounts.timezone,
      role: schema.financeAccountMembers.role,
    })
    .from(schema.financeAccountMembers)
    .innerJoin(schema.financeAccounts, eq(schema.financeAccounts.id, schema.financeAccountMembers.accountId))
    .where(eq(schema.financeAccountMembers.userId, userId))
    .orderBy(asc(schema.financeAccounts.name));
}

export async function createAccount(userId: string, payload: z.infer<typeof import("$lib/validation/finance").createAccountSchema>) {
  return db.transaction(async (tx) => {
    const [account] = await tx
      .insert(schema.financeAccounts)
      .values({
        name: payload.name,
        currencyCode: payload.currencyCode.toUpperCase(),
        timezone: payload.timezone,
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

    return account;
  });
}

export async function getOrCreateDefaultAccount(userId: string) {
  const accounts = await listAccountsForUser(userId);
  if (accounts.length > 0) return accounts[0];

  const account = await createAccount(userId, {
    name: "Personal",
    currencyCode: "INR",
    timezone: "Asia/Kolkata",
  });

  return {
    id: account.id,
    name: account.name,
    currencyCode: account.currencyCode,
    timezone: account.timezone,
    role: "owner" as const,
  };
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

export async function listCategories(accountId: string) {
  return db.query.financeCategories.findMany({
    where: eq(schema.financeCategories.accountId, accountId),
    orderBy: [asc(schema.financeCategories.name)],
  });
}

export async function createCategory(userId: string, accountId: string, payload: CategoryPayload) {
  const [category] = await db
    .insert(schema.financeCategories)
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
  return category ?? null;
}

export async function updateCategory(userId: string, accountId: string, payload: UpdateCategoryPayload) {
  const [updated] = await db
    .update(schema.financeCategories)
    .set({
      name: payload.name,
      kind: payload.kind,
      colorHex: payload.colorHex,
      updatedById: userId,
    })
    .where(and(eq(schema.financeCategories.id, payload.id), eq(schema.financeCategories.accountId, accountId)))
    .returning();
  return updated ?? null;
}

export async function deleteCategory(accountId: string, categoryId: string) {
  const [removed] = await db
    .delete(schema.financeCategories)
    .where(and(eq(schema.financeCategories.id, categoryId), eq(schema.financeCategories.accountId, accountId)))
    .returning({ id: schema.financeCategories.id });
  return Boolean(removed);
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

export async function listGroups(accountId: string) {
  return db.select().from(schema.financeGroups).where(eq(schema.financeGroups.accountId, accountId)).orderBy(asc(schema.financeGroups.name));
}

export async function createGroup(userId: string, accountId: string, payload: GroupPayload) {
  const [group] = await db
    .insert(schema.financeGroups)
    .values({
      accountId,
      name: payload.name,
      createdById: userId,
      updatedById: userId,
    })
    .onConflictDoNothing()
    .returning();
  return group ?? null;
}

export async function updateGroup(userId: string, accountId: string, payload: UpdateGroupPayload) {
  const [updated] = await db
    .update(schema.financeGroups)
    .set({
      name: payload.name,
      updatedById: userId,
    })
    .where(and(eq(schema.financeGroups.id, payload.id), eq(schema.financeGroups.accountId, accountId)))
    .returning();
  return updated ?? null;
}

export async function deleteGroup(accountId: string, groupId: string) {
  const [removed] = await db
    .delete(schema.financeGroups)
    .where(and(eq(schema.financeGroups.id, groupId), eq(schema.financeGroups.accountId, accountId)))
    .returning({ id: schema.financeGroups.id });
  return Boolean(removed);
}

export async function attachTransactionGroup(accountId: string, transactionId: string, groupId: string) {
  const [transaction] = await db
    .select({ id: schema.financeTransactions.id })
    .from(schema.financeTransactions)
    .where(and(eq(schema.financeTransactions.id, transactionId), eq(schema.financeTransactions.accountId, accountId)))
    .limit(1);
  if (!transaction) return null;

  const [group] = await db
    .select({
      id: schema.financeGroups.id,
      name: schema.financeGroups.name,
      colorHex: schema.financeGroups.colorHex,
    })
    .from(schema.financeGroups)
    .where(and(eq(schema.financeGroups.id, groupId), eq(schema.financeGroups.accountId, accountId)))
    .limit(1);
  if (!group) return null;

  await db.insert(schema.financeTransactionGroups).values({ transactionId, groupId }).onConflictDoNothing();

  return group;
}

export async function detachTransactionGroup(accountId: string, transactionId: string, groupId: string) {
  const [transaction] = await db
    .select({ id: schema.financeTransactions.id })
    .from(schema.financeTransactions)
    .where(and(eq(schema.financeTransactions.id, transactionId), eq(schema.financeTransactions.accountId, accountId)))
    .limit(1);
  if (!transaction) return false;

  const [removed] = await db
    .delete(schema.financeTransactionGroups)
    .where(and(eq(schema.financeTransactionGroups.transactionId, transactionId), eq(schema.financeTransactionGroups.groupId, groupId)))
    .returning({ groupId: schema.financeTransactionGroups.groupId });

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

export async function setTransactionGroupHidden(accountId: string, transactionId: string, groupId: string, hidden: boolean) {
  const [transaction] = await db
    .select({ id: schema.financeTransactions.id })
    .from(schema.financeTransactions)
    .where(and(eq(schema.financeTransactions.id, transactionId), eq(schema.financeTransactions.accountId, accountId)))
    .limit(1);
  if (!transaction) return null;

  const [group] = await db
    .select({ id: schema.financeGroups.id })
    .from(schema.financeGroups)
    .where(and(eq(schema.financeGroups.id, groupId), eq(schema.financeGroups.accountId, accountId)))
    .limit(1);
  if (!group) return null;

  const [updated] = await db
    .update(schema.financeTransactionGroups)
    .set({ isHidden: hidden })
    .where(and(eq(schema.financeTransactionGroups.transactionId, transactionId), eq(schema.financeTransactionGroups.groupId, groupId)))
    .returning({ isHidden: schema.financeTransactionGroups.isHidden });

  return updated ?? null;
}

export async function listTransactions(accountId: string, query: TransactionsQuery) {
  const conditions = [eq(schema.financeTransactions.accountId, accountId)];
  let linkClusterIds: string[] | null = null;

  if (query.linkTransactionId) {
    linkClusterIds = await getRefundLinkClusterIds(accountId, query.linkTransactionId);
    if (linkClusterIds?.length) {
      conditions.push(inArray(schema.financeTransactions.id, linkClusterIds));
    }
  }

  if (query.search) {
    conditions.push(
      buildTransactionSearchCondition(query.search, {
        merchant: schema.financeTransactions.merchant,
        notes: schema.financeTransactions.notes,
        amountMinor: schema.financeTransactions.amountMinor,
      })
    );
  }
  if (query.categoryIds?.length) {
    const hasUncategorized = query.categoryIds.includes("uncategorized");
    const categoryIds = query.categoryIds.filter((id): id is string => id !== "uncategorized");

    if (hasUncategorized && categoryIds.length) {
      conditions.push(or(isNull(schema.financeTransactions.categoryId), inArray(schema.financeTransactions.categoryId, categoryIds))!);
    } else if (hasUncategorized) {
      conditions.push(isNull(schema.financeTransactions.categoryId));
    } else if (categoryIds.length) {
      conditions.push(inArray(schema.financeTransactions.categoryId, categoryIds));
    }
  }
  if (query.tagIds?.length) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${schema.financeTransactionTags}
        WHERE ${schema.financeTransactionTags.transactionId} = ${schema.financeTransactions.id}
        AND ${schema.financeTransactionTags.tagId} IN (${sql.join(
          query.tagIds.map((tagId) => sql`${tagId}`),
          sql`, `
        )})
      )`
    );
  }
  if (query.type) {
    conditions.push(eq(schema.financeTransactions.type, query.type));
  }
  if (!linkClusterIds?.length) {
    if (query.dateFrom) {
      conditions.push(gte(schema.financeTransactions.occurredOn, query.dateFrom));
    }
    if (query.dateTo) {
      conditions.push(lte(schema.financeTransactions.occurredOn, query.dateTo));
    }
  }
  if (query.groupId) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${schema.financeTransactionGroups}
        WHERE ${schema.financeTransactionGroups.transactionId} = ${schema.financeTransactions.id}
        AND ${schema.financeTransactionGroups.groupId} = ${query.groupId}
      )`
    );
  }

  const whereExpr = and(...conditions);
  const sortColumn = sortMap[query.sortBy];
  const direction = query.sortDirection === "asc" ? asc(sortColumn) : desc(sortColumn);
  const offset = query.pageIndex * query.pageSize;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: schema.financeTransactions.id,
        occurredOn: schema.financeTransactions.occurredOn,
        amountMinor: schema.financeTransactions.amountMinor,
        type: schema.financeTransactions.type,
        merchant: schema.financeTransactions.merchant,
        notes: schema.financeTransactions.notes,
        categoryId: schema.financeTransactions.categoryId,
        categoryName: schema.financeCategories.name,
        categoryColor: schema.financeCategories.colorHex,
        createdAt: schema.financeTransactions.createdAt,
      })
      .from(schema.financeTransactions)
      .leftJoin(schema.financeCategories, eq(schema.financeCategories.id, schema.financeTransactions.categoryId))
      .where(whereExpr)
      .orderBy(direction, desc(schema.financeTransactions.id))
      .limit(query.pageSize)
      .offset(offset),
    db.select({ total: count() }).from(schema.financeTransactions).where(whereExpr),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);
  const loaded = offset + rows.length;
  const tagsByTransaction = await loadTagsForTransactions(rows.map((row) => row.id));
  const groupsByTransaction = await loadGroupsForTransactions(rows.map((row) => row.id));
  const refundLinksByTransaction = await loadRefundLinksForTransactions(rows.map((row) => row.id));
  const warningsByTransaction = await buildRefundWarningsForTransactions(rows.map((row) => row.id));
  const hiddenByTransaction = query.groupId
    ? await loadGroupHiddenForTransactions(
        rows.map((row) => row.id),
        query.groupId
      )
    : null;

  return {
    rows: rows.map((row) => ({
      ...row,
      tags: tagsByTransaction.get(row.id) ?? [],
      groups: groupsByTransaction.get(row.id) ?? [],
      refundLinks: refundLinksByTransaction.get(row.id) ?? [],
      warnings: warningsByTransaction.get(row.id) ?? [],
      ...(query.groupId ? { groupHidden: hiddenByTransaction?.get(row.id) ?? false } : {}),
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
      categoryId: payload.categoryId,
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
  if ("categoryId" in payload) patch.categoryId = payload.categoryId ?? null;
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

export type SmartCategoryBreakdown = {
  categoryId: string | null;
  categoryName: string;
  count: number;
};

export type SmartCategoryMerchantGroup = {
  merchant: string;
  categories: SmartCategoryBreakdown[];
};

export type SmartCategorizationPreview = {
  merchant: string;
  newCategoryId: string | null;
  newCategoryName: string;
  exact: SmartCategoryMerchantGroup | null;
  fuzzy: SmartCategoryMerchantGroup[];
};

type SmartCategoryQuery = {
  merchant: string;
  newCategoryId: string | null;
  sourceTransactionId: string;
  type: "expense" | "income" | "transfer";
};

type SmartCategoryMigration = {
  merchant: string;
  fromCategoryId: string | null;
  enabled: boolean;
};

async function listDistinctMerchantsForType(accountId: string, type: SmartCategoryQuery["type"]) {
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

async function getMerchantCategoryBreakdown(
  accountId: string,
  merchant: string,
  type: SmartCategoryQuery["type"],
  excludeTransactionId?: string
): Promise<SmartCategoryBreakdown[]> {
  const excludeFilter = excludeTransactionId ? sql`and t.id != ${excludeTransactionId}` : sql``;

  const result = await db.execute(sql`
    select
      t.category_id,
      coalesce(c.name, 'Uncategorized') as category_name,
      count(*)::int as row_count
    from chhanchhan.finance_transactions t
    left join chhanchhan.finance_categories c on c.id = t.category_id
    where t.account_id = ${accountId}
      and t.type = ${type}
      and lower(trim(t.merchant)) = lower(${merchant})
      ${excludeFilter}
    group by t.category_id, c.name
    order by row_count desc, category_name asc
  `);

  return result.rows.map((row) => {
    const typed = row as { category_id: string | null; category_name: string; row_count: number };
    return {
      categoryId: typed.category_id ?? null,
      categoryName: String(typed.category_name),
      count: Number(typed.row_count),
    };
  });
}

function categoriesNeedingMigration(categories: SmartCategoryBreakdown[], newCategoryId: string | null): SmartCategoryBreakdown[] {
  return categories.filter((category) => {
    if (newCategoryId == null) return category.categoryId != null;
    return category.categoryId !== newCategoryId;
  });
}

export async function previewSmartCategorization(accountId: string, query: SmartCategoryQuery): Promise<SmartCategorizationPreview | null> {
  const merchant = query.merchant.trim();
  if (!merchant) return null;

  const [newCategoryNameRow] = query.newCategoryId
    ? await db
        .select({ name: schema.financeCategories.name })
        .from(schema.financeCategories)
        .where(and(eq(schema.financeCategories.id, query.newCategoryId), eq(schema.financeCategories.accountId, accountId)))
        .limit(1)
    : [{ name: "Uncategorized" }];

  const exactCategories = await getMerchantCategoryBreakdown(accountId, merchant, query.type, query.sourceTransactionId);
  const exactMigratable = categoriesNeedingMigration(exactCategories, query.newCategoryId);
  const exact =
    exactMigratable.length > 0
      ? {
          merchant,
          categories: exactMigratable,
        }
      : null;

  const distinctMerchants = await listDistinctMerchantsForType(accountId, query.type);
  const fuzzyMerchants = rankFuzzyMerchants(merchant, distinctMerchants).filter(
    (candidate) => normalizeMerchant(candidate) !== normalizeMerchant(merchant)
  );

  const fuzzy: SmartCategoryMerchantGroup[] = [];
  for (const fuzzyMerchant of fuzzyMerchants) {
    const categories = categoriesNeedingMigration(await getMerchantCategoryBreakdown(accountId, fuzzyMerchant, query.type), query.newCategoryId);
    if (categories.length) {
      fuzzy.push({ merchant: fuzzyMerchant, categories });
    }
  }

  if (!exact && !fuzzy.length) return null;

  return {
    merchant,
    newCategoryId: query.newCategoryId,
    newCategoryName: newCategoryNameRow?.name ?? "Uncategorized",
    exact,
    fuzzy,
  };
}

function categoryMatchFilter(fromCategoryId: string | null) {
  return fromCategoryId ? eq(schema.financeTransactions.categoryId, fromCategoryId) : isNull(schema.financeTransactions.categoryId);
}

export async function applySmartCategorization(
  userId: string,
  accountId: string,
  payload: {
    sourceTransactionId: string;
    newCategoryId: string | null;
    type: SmartCategoryQuery["type"];
    migrations: SmartCategoryMigration[];
  }
) {
  await updateTransaction(userId, accountId, payload.sourceTransactionId, {
    categoryId: payload.newCategoryId,
  });

  let updatedCount = 0;
  const seen = new Set<string>();

  for (const migration of payload.migrations) {
    if (!migration.enabled) continue;

    const merchant = migration.merchant.trim();
    if (!merchant) continue;

    const key = `${merchant}::${migration.fromCategoryId ?? "null"}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const updated = await db
      .update(schema.financeTransactions)
      .set({
        categoryId: payload.newCategoryId,
        updatedById: userId,
      })
      .where(
        and(
          eq(schema.financeTransactions.accountId, accountId),
          eq(schema.financeTransactions.type, payload.type),
          sql`lower(trim(${schema.financeTransactions.merchant})) = lower(${merchant})`,
          categoryMatchFilter(migration.fromCategoryId),
          ne(schema.financeTransactions.id, payload.sourceTransactionId)
        )
      )
      .returning({ id: schema.financeTransactions.id });

    updatedCount += updated.length;
  }

  return { updatedCount };
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
      categoryId: schema.financeBudgets.categoryId,
      categoryName: schema.financeCategories.name,
      isActive: schema.financeBudgets.isActive,
    })
    .from(schema.financeBudgets)
    .leftJoin(schema.financeCategories, eq(schema.financeCategories.id, schema.financeBudgets.categoryId))
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
        categoryId: payload.categoryId,
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
      categoryId: payload.categoryId,
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
      and ${filters.groupFilter}
      and ${filters.searchFilter}
      and ${filters.categoryFilter}
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

export async function getCategorySpend(accountId: string, selection: SummarySelection) {
  const filters = summaryTransactionFilters(selection);

  const categorySpend = await db.execute(sql`
    select
      coalesce(c.name, 'Uncategorized') as category_name,
      coalesce(sum(t.amount_minor), 0)::bigint as amount_minor
    from chhanchhan.finance_transactions t
    left join chhanchhan.finance_categories c on c.id = t.category_id
    where t.account_id = ${accountId}
      and t.type = 'expense'
      and ${filters.dateFilter}
      and ${filters.groupFilter}
      and ${filters.searchFilter}
      and ${filters.categoryFilter}
      and ${filters.tagFilter}
    group by c.name
    order by amount_minor desc
    limit 8
  `);

  return categorySpend.rows as Array<{ category_name: string; amount_minor: number }>;
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
      and ${filters.groupFilter}
      and ${filters.searchFilter}
      and ${filters.categoryFilter}
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
      and ${filters.groupFilter}
      and ${filters.searchFilter}
      and ${filters.categoryFilter}
      and ${filters.tagFilter}
    group by merchant_name
    order by amount_minor desc
    limit ${limit}
  `);

  return result.rows as Array<{ merchant_name: string; amount_minor: number }>;
}

export async function getGroupSpend(accountId: string, selection: SummarySelection) {
  const filters = summaryTransactionFilters(selection);

  const result = await db.execute(sql`
    select
      g.name as group_name,
      g.color_hex,
      coalesce(sum(t.amount_minor), 0)::bigint as amount_minor
    from chhanchhan.finance_transactions t
    inner join chhanchhan.finance_transaction_groups ftg
      on ftg.transaction_id = t.id
      and ftg.is_hidden = false
    inner join chhanchhan.finance_groups g on g.id = ftg.group_id
    where t.account_id = ${accountId}
      and t.type = 'expense'
      and ${filters.dateFilter}
      and ${filters.groupFilter}
      and ${filters.searchFilter}
      and ${filters.categoryFilter}
      and ${filters.tagFilter}
    group by g.id, g.name, g.color_hex
    order by amount_minor desc
    limit 8
  `);

  return result.rows as Array<{ group_name: string; color_hex: string | null; amount_minor: number }>;
}

export async function getCategoryMerchantBills(accountId: string, selection: SummarySelection) {
  const filters = summaryTransactionFilters(selection);

  const result = await db.execute(sql`
    select
      t.category_id,
      c.name as category_name,
      c.color_hex as category_color,
      coalesce(nullif(trim(t.merchant), ''), 'Unknown') as merchant_name,
      to_char(date_trunc('month', t.occurred_on), 'YYYY-MM') as month_key,
      coalesce(sum(t.amount_minor), 0)::bigint as amount_minor,
      count(*)::int as txn_count
    from chhanchhan.finance_transactions t
    inner join chhanchhan.finance_categories c on c.id = t.category_id
    left join chhanchhan.finance_categories parent on parent.id = c.parent_category_id
    where t.account_id = ${accountId}
      and t.type = 'expense'
      and ${billCategorySqlFilter()}
      and ${filters.dateFilter}
      and ${filters.groupFilter}
      and ${filters.searchFilter}
      and ${filters.categoryFilter}
      and ${filters.tagFilter}
    group by t.category_id, c.name, c.color_hex, merchant_name, month_key
    order by category_name asc, merchant_name asc, month_key asc
  `);

  return result.rows as Array<{
    category_id: string | null;
    category_name: string;
    category_color: string | null;
    merchant_name: string;
    month_key: string;
    amount_minor: number;
    txn_count: number;
  }>;
}

export async function getCategoryMerchantBillsForYear(accountId: string, year: number) {
  const result = await db.execute(sql`
    select
      t.category_id,
      c.name as category_name,
      c.color_hex as category_color,
      coalesce(nullif(trim(t.merchant), ''), 'Unknown') as merchant_name,
      to_char(date_trunc('month', t.occurred_on), 'YYYY-MM') as month_key,
      coalesce(sum(t.amount_minor), 0)::bigint as amount_minor,
      count(*)::int as txn_count
    from chhanchhan.finance_transactions t
    inner join chhanchhan.finance_categories c on c.id = t.category_id
    left join chhanchhan.finance_categories parent on parent.id = c.parent_category_id
    where t.account_id = ${accountId}
      and t.type = 'expense'
      and ${billCategorySqlFilter()}
      and extract(year from t.occurred_on) = ${year}
    group by t.category_id, c.name, c.color_hex, merchant_name, month_key
    order by category_name asc, merchant_name asc, month_key asc
  `);

  return result.rows as Array<{
    category_id: string | null;
    category_name: string;
    category_color: string | null;
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

export async function getCategoryTrend(accountId: string, monthCount = 12) {
  const safeCount = Math.min(24, Math.max(3, monthCount));
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (safeCount - 1));
  const dateFrom = start.toISOString().slice(0, 10);

  const result = await db.execute(sql`
    select
      to_char(date_trunc('month', t.occurred_on), 'YYYY-MM') as month_key,
      coalesce(c.name, 'Uncategorized') as category_name,
      c.color_hex,
      coalesce(sum(t.amount_minor), 0)::bigint as amount_minor
    from chhanchhan.finance_transactions t
    left join chhanchhan.finance_categories c on c.id = t.category_id
    where t.account_id = ${accountId}
      and t.type = 'expense'
      and t.occurred_on >= ${dateFrom}::date
    group by month_key, category_name, c.color_hex
    order by month_key asc, amount_minor desc
  `);

  return result.rows as Array<{
    month_key: string;
    category_name: string;
    color_hex: string | null;
    amount_minor: number;
  }>;
}

function summarySearchFilter(search?: string) {
  return buildSummarySearchFilterSql(search);
}

function summaryCategoryFilter(categoryFilters?: string[]) {
  if (!categoryFilters?.length) return sql`true`;

  const hasUncategorized = categoryFilters.includes("uncategorized");
  const categoryIds = categoryFilters.filter((value) => value !== "uncategorized");

  if (hasUncategorized && categoryIds.length) {
    return sql`(t.category_id is null or t.category_id in (${sql.join(
      categoryIds.map((categoryId) => sql`${categoryId}`),
      sql`, `
    )}))`;
  }
  if (hasUncategorized) return sql`t.category_id is null`;
  if (categoryIds.length === 1) return sql`t.category_id = ${categoryIds[0]}`;
  return sql`t.category_id in (${sql.join(
    categoryIds.map((categoryId) => sql`${categoryId}`),
    sql`, `
  )})`;
}

function summaryTagFilter(tagIds?: string[]) {
  if (!tagIds?.length) return sql`true`;
  if (tagIds.length === 1) {
    return sql`exists (
      select 1 from chhanchhan.finance_transaction_tags ftt
      where ftt.transaction_id = t.id
        and ftt.tag_id = ${tagIds[0]}
    )`;
  }

  return sql`exists (
    select 1 from chhanchhan.finance_transaction_tags ftt
    where ftt.transaction_id = t.id
      and ftt.tag_id in (${sql.join(
        tagIds.map((tagId) => sql`${tagId}`),
        sql`, `
      )})
  )`;
}

function summaryTransactionFilters(selection: SummarySelection) {
  return {
    dateFilter: summaryDateFilter(selection),
    groupFilter: summaryGroupVisibleFilter(selection.groupId),
    searchFilter: summarySearchFilter(selection.search),
    categoryFilter: summaryCategoryFilter(selection.categoryFilters),
    tagFilter: summaryTagFilter(selection.tagIds),
  };
}

function summaryGroupVisibleFilter(groupId?: string) {
  if (!groupId) return sql`true`;

  return sql`exists (
    select 1 from chhanchhan.finance_transaction_groups ftg
    where ftg.transaction_id = t.id
      and ftg.group_id = ${groupId}
      and ftg.is_hidden = false
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
  const categorySpend = await getCategorySpend(accountId, { period: "month", month: currentMonthKey() });

  const budgetUsage = await db.execute(sql`
    select
      b.id,
      b.name,
      b.limit_minor,
      coalesce(sum(case when t.type = 'expense' then t.amount_minor else 0 end), 0)::bigint as spent_minor
    from chhanchhan.finance_budgets b
    left join chhanchhan.finance_transactions t
      on t.account_id = b.account_id
      and (b.category_id is null or t.category_id = b.category_id)
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
    categorySpend,
    budgetUsage: budgetUsage.rows as Array<{ id: string; name: string; limit_minor: number; spent_minor: number }>,
    goals: goals.rows as Array<{ id: string; name: string; target_minor: number; current_minor: number; status: string }>,
  };
}
