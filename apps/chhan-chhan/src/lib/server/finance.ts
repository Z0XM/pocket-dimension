import { db, schema } from "@pocket-dimension/db";
import { and, asc, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import type { z } from "zod";
import type {
  budgetUpsertSchema,
  createCategorySchema,
  goalUpsertSchema,
  transactionUpsertSchema,
  transactionsQuerySchema,
} from "$lib/validation/finance";

type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;
type TxPayload = z.infer<typeof transactionUpsertSchema>;
type BudgetPayload = z.infer<typeof budgetUpsertSchema>;
type GoalPayload = z.infer<typeof goalUpsertSchema>;
type CategoryPayload = z.infer<typeof createCategorySchema>;

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
  return {
    rows,
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
  const [updated] = await db
    .update(schema.financeTransactions)
    .set({
      occurredOn: payload.occurredOn,
      amountMinor: payload.amountMinor,
      type: payload.type,
      merchant: payload.merchant,
      notes: payload.notes,
      externalRef: payload.externalRef,
      categoryId: payload.categoryId,
      sortOrder: payload.sortOrder,
      updatedById: userId,
    })
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

export async function getAnalytics(accountId: string) {
  const monthlyResult = await db.execute(sql`
    select
      coalesce(sum(case when t.type = 'income' then t.amount_minor else 0 end), 0)::bigint as income_minor,
      coalesce(sum(case when t.type = 'expense' then t.amount_minor else 0 end), 0)::bigint as expense_minor
    from chhanchhan.finance_transactions t
    where t.account_id = ${accountId}
      and date_trunc('month', t.occurred_on) = date_trunc('month', now())
  `);
  const monthly = monthlyResult.rows[0] as { income_minor: number | string; expense_minor: number | string } | undefined;

  const categorySpend = await db.execute(sql`
    select
      coalesce(c.name, 'Uncategorized') as category_name,
      coalesce(sum(t.amount_minor), 0)::bigint as amount_minor
    from chhanchhan.finance_transactions t
    left join chhanchhan.finance_categories c on c.id = t.category_id
    where t.account_id = ${accountId}
      and t.type = 'expense'
      and date_trunc('month', t.occurred_on) = date_trunc('month', now())
    group by c.name
    order by amount_minor desc
    limit 8
  `);

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

  return {
    monthly: {
      incomeMinor: Number(monthly?.income_minor ?? 0),
      expenseMinor: Number(monthly?.expense_minor ?? 0),
      netMinor: Number(monthly?.income_minor ?? 0) - Number(monthly?.expense_minor ?? 0),
    },
    categorySpend: categorySpend.rows as Array<{ category_name: string; amount_minor: number }>,
    budgetUsage: budgetUsage.rows as Array<{ id: string; name: string; limit_minor: number; spent_minor: number }>,
    goals: goals.rows as Array<{ id: string; name: string; target_minor: number; current_minor: number; status: string }>,
  };
}
