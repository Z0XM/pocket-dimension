import {
  createAccount,
  createCategory,
  getAnalytics,
  listAccountsForUser,
  listBudgets,
  listCategories,
  listGoals,
  listTransactions,
} from "$lib/server/finance";
import type { PageServerLoad } from "./$types";

async function ensureSeedData(userId: string) {
  const existing = await listAccountsForUser(userId);
  if (existing.length > 0) return existing;

  const account = await createAccount(userId, {
    name: "My Household",
    currencyCode: "USD",
    timezone: "UTC",
  });

  const defaults = [
    { name: "Groceries", kind: "expense" as const },
    { name: "Utilities", kind: "expense" as const },
    { name: "Income", kind: "income" as const },
    { name: "Savings", kind: "transfer" as const },
  ];
  for (const category of defaults) {
    await createCategory(userId, account.id, category);
  }

  return listAccountsForUser(userId);
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user?.id) {
    return {
      authenticated: false,
      accounts: [],
      selectedAccountId: null,
      categories: [],
      transactions: [],
      hasMore: false,
      budgets: [],
      goals: [],
      analytics: null,
    };
  }

  const userId = locals.user.id;
  const accounts = await ensureSeedData(userId);
  const selectedAccount = accounts[0];

  const [categories, txPage, budgets, goals, analytics] = await Promise.all([
    listCategories(selectedAccount.id),
    listTransactions(selectedAccount.id, {
      pageIndex: 0,
      pageSize: 50,
      sortBy: "occurredOn",
      sortDirection: "desc",
    }),
    listBudgets(selectedAccount.id),
    listGoals(selectedAccount.id),
    getAnalytics(selectedAccount.id),
  ]);

  return {
    authenticated: true,
    accounts,
    selectedAccountId: selectedAccount.id,
    categories,
    transactions: txPage.rows,
    hasMore: txPage.hasMore,
    budgets,
    goals,
    analytics,
  };
};
