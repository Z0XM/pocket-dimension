import { parseSqlMinor } from "$lib/finance/money";
import { currentMonthKey, readRowYear, type SummarySelection } from "$lib/finance/summary";
import { isBalanceSnapshotNewer } from "$lib/server/balance";
import { db, schema } from "@pocket-dimension/db";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
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

export async function listTransactions(accountId: string, query: TransactionsQuery) {
  const conditions = [eq(schema.financeTransactions.accountId, accountId)];

  if (query.search) {
    conditions.push(
      or(ilike(schema.financeTransactions.merchant, `%${query.search}%`), ilike(schema.financeTransactions.notes, `%${query.search}%`))!
    );
  }
  if (query.categoryId) {
    conditions.push(eq(schema.financeTransactions.categoryId, query.categoryId));
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

  return {
    rows: rows.map((row) => ({
      ...row,
      tags: tagsByTransaction.get(row.id) ?? [],
      groups: groupsByTransaction.get(row.id) ?? [],
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
  const [latestTxnDate] = await db
    .select({ occurredOn: schema.financeTransactions.occurredOn })
    .from(schema.financeTransactions)
    .where(eq(schema.financeTransactions.accountId, accountId))
    .orderBy(desc(schema.financeTransactions.occurredOn), desc(schema.financeTransactions.sortOrder), desc(schema.financeTransactions.createdAt))
    .limit(1);

  const account = await db.query.financeAccounts.findFirst({
    where: eq(schema.financeAccounts.id, accountId),
    columns: { balanceMinor: true, balanceAsOf: true },
  });

  const [txnBalance] = await db
    .select({
      balanceMinor: schema.financeTransactions.balanceMinor,
      occurredOn: schema.financeTransactions.occurredOn,
      sortOrder: schema.financeTransactions.sortOrder,
    })
    .from(schema.financeTransactions)
    .where(and(eq(schema.financeTransactions.accountId, accountId), isNotNull(schema.financeTransactions.balanceMinor)))
    .orderBy(desc(schema.financeTransactions.occurredOn), desc(schema.financeTransactions.sortOrder), desc(schema.financeTransactions.createdAt))
    .limit(1);

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
  const dateFilter = summaryDateFilter(selection);

  const result = await db.execute(sql`
    select
      coalesce(sum(case when t.type = 'income' then t.amount_minor else 0 end), 0)::bigint as income_minor,
      coalesce(sum(case when t.type = 'expense' then t.amount_minor else 0 end), 0)::bigint as expense_minor
    from chhanchhan.finance_transactions t
    where t.account_id = ${accountId}
      and ${dateFilter}
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
  const dateFilter = summaryDateFilter(selection);

  const categorySpend = await db.execute(sql`
    select
      coalesce(c.name, 'Uncategorized') as category_name,
      coalesce(sum(t.amount_minor), 0)::bigint as amount_minor
    from chhanchhan.finance_transactions t
    left join chhanchhan.finance_categories c on c.id = t.category_id
    where t.account_id = ${accountId}
      and t.type = 'expense'
      and ${dateFilter}
    group by c.name
    order by amount_minor desc
    limit 8
  `);

  return categorySpend.rows as Array<{ category_name: string; amount_minor: number }>;
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
