<script lang="ts">
  import { PUBLIC_BASE_AUTH_URL } from "$env/static/public";
  import { onMount } from "svelte";

  const { data } = $props();

  type Account = {
    id: string;
    name: string;
    currencyCode: string;
    timezone: string;
    role: "owner" | "editor" | "viewer";
  };
  type Category = { id: string; name: string; kind: "expense" | "income" | "transfer" };
  type Transaction = {
    id: string;
    occurredOn: string;
    amountMinor: number;
    type: "expense" | "income" | "transfer";
    merchant: string | null;
    notes: string | null;
    categoryId: string | null;
    categoryName: string | null;
    createdAt: Date;
  };
  type Budget = {
    id: string;
    name: string;
    period: string;
    startDate: string;
    endDate: string | null;
    limitMinor: number;
    categoryId: string | null;
    categoryName: string | null;
    isActive: boolean;
  };
  type Goal = {
    id: string;
    name: string;
    targetMinor: number;
    currentMinor: number;
    targetDate: string | null;
    status: string;
  };

  let authenticated = $state<boolean>(data.authenticated);
  let accounts = $state<Account[]>(data.accounts ?? []);
  let selectedAccountId = $state<string | null>(data.selectedAccountId ?? null);
  let categories = $state<Category[]>(data.categories ?? []);
  let transactions = $state<Transaction[]>(data.transactions ?? []);
  let budgets = $state<Budget[]>(data.budgets ?? []);
  let goals = $state<Goal[]>(data.goals ?? []);
  let analytics = $state(data.analytics);
  let hasMore = $state<boolean>(data.hasMore ?? false);
  let loadingMore = $state(false);

  let pageIndex = $state(0);
  let pageSize = $state(50);
  let search = $state("");
  let filterType = $state<"" | "expense" | "income" | "transfer">("");
  let dateFrom = $state("");
  let dateTo = $state("");
  let sortBy = $state<"occurredOn" | "amountMinor" | "merchant" | "type" | "createdAt">("occurredOn");
  let sortDirection = $state<"asc" | "desc">("desc");

  let newMerchant = $state("");
  let newAmountMinor = $state(0);
  let newType = $state<"expense" | "income" | "transfer">("expense");
  let newOccurredOn = $state(new Date().toISOString().slice(0, 10));
  let newCategoryId = $state("");
  let newNotes = $state("");

  let newBudgetName = $state("");
  let newBudgetLimit = $state(0);
  let newGoalName = $state("");
  let newGoalTarget = $state(0);

  const COLUMN_PREFS_KEY = "chhan-chhan:columns";
  const VIEW_PREFS_KEY = "chhan-chhan:views";
  const defaultColumns = [
    { key: "occurredOn", label: "Date", visible: true },
    { key: "merchant", label: "Merchant", visible: true },
    { key: "categoryName", label: "Category", visible: true },
    { key: "type", label: "Type", visible: true },
    { key: "amountMinor", label: "Amount", visible: true },
    { key: "notes", label: "Notes", visible: false },
  ];
  let columns = $state<{ key: string; label: string; visible: boolean }[]>(defaultColumns);
  let savedViews = $state<Array<{ name: string; search: string; filterType: string; sortBy: string; sortDirection: string }>>([]);
  let viewName = $state("");

  let intersectionRef = $state<HTMLElement | null>(null);

  const accountRole = $derived(accounts.find((a) => a.id === selectedAccountId)?.role ?? "viewer");
  const canEdit = $derived(accountRole === "owner" || accountRole === "editor");
  const visibleColumns = $derived(columns.filter((column) => column.visible));

  const categoryChartRows = $derived.by(() => {
    const rows = analytics?.categorySpend ?? [];
    return rows.map((row: { category_name: string; amount_minor: number }) => ({
      name: row.category_name,
      amountMinor: Number(row.amount_minor ?? 0),
    }));
  });

  function fmtMoney(amountMinor: number) {
    const sign = amountMinor < 0 ? "-" : "";
    return `${sign}$${(Math.abs(amountMinor) / 100).toFixed(2)}`;
  }

  async function fetchAccountData() {
    if (!selectedAccountId) return;
    const accountId = selectedAccountId;
    pageIndex = 0;
    const query = new URLSearchParams({
      pageIndex: String(pageIndex),
      pageSize: String(pageSize),
      sortBy,
      sortDirection,
    });
    if (search) query.set("search", search);
    if (filterType) query.set("type", filterType);
    if (dateFrom) query.set("dateFrom", dateFrom);
    if (dateTo) query.set("dateTo", dateTo);

    const [txRes, catRes, budgetRes, goalRes, analyticsRes] = await Promise.all([
      fetch(`/api/accounts/${accountId}/transactions?${query.toString()}`),
      fetch(`/api/accounts/${accountId}/categories`),
      fetch(`/api/accounts/${accountId}/budgets`),
      fetch(`/api/accounts/${accountId}/goals`),
      fetch(`/api/accounts/${accountId}/analytics`),
    ]);

    if (txRes.ok) {
      const txData = await txRes.json();
      transactions = txData.rows;
      hasMore = txData.hasMore;
    }
    if (catRes.ok) {
      const catData = await catRes.json();
      categories = catData.categories;
    }
    if (budgetRes.ok) {
      const budgetData = await budgetRes.json();
      budgets = budgetData.budgets;
    }
    if (goalRes.ok) {
      const goalData = await goalRes.json();
      goals = goalData.goals;
    }
    if (analyticsRes.ok) {
      analytics = await analyticsRes.json();
    }
  }

  async function loadMore() {
    if (!selectedAccountId || !hasMore || loadingMore) return;
    loadingMore = true;
    pageIndex += 1;
    const query = new URLSearchParams({
      pageIndex: String(pageIndex),
      pageSize: String(pageSize),
      sortBy,
      sortDirection,
    });
    if (search) query.set("search", search);
    if (filterType) query.set("type", filterType);
    if (dateFrom) query.set("dateFrom", dateFrom);
    if (dateTo) query.set("dateTo", dateTo);

    const res = await fetch(`/api/accounts/${selectedAccountId}/transactions?${query.toString()}`);
    if (res.ok) {
      const next = await res.json();
      transactions = [...transactions, ...next.rows];
      hasMore = next.hasMore;
    }
    loadingMore = false;
  }

  async function createTransaction() {
    if (!selectedAccountId) return;
    const res = await fetch(`/api/accounts/${selectedAccountId}/transactions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        occurredOn: newOccurredOn,
        amountMinor: newAmountMinor,
        type: newType,
        merchant: newMerchant,
        notes: newNotes,
        categoryId: newCategoryId || undefined,
      }),
    });
    if (res.ok) {
      newMerchant = "";
      newAmountMinor = 0;
      newNotes = "";
      await fetchAccountData();
    }
  }

  async function createBudget() {
    if (!selectedAccountId) return;
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    const res = await fetch(`/api/accounts/${selectedAccountId}/budgets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: newBudgetName,
        period: "monthly",
        startDate: today,
        endDate: end.toISOString().slice(0, 10),
        limitMinor: newBudgetLimit,
        isActive: true,
      }),
    });
    if (res.ok) {
      newBudgetName = "";
      newBudgetLimit = 0;
      await fetchAccountData();
    }
  }

  async function createGoal() {
    if (!selectedAccountId) return;
    const res = await fetch(`/api/accounts/${selectedAccountId}/goals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: newGoalName,
        targetMinor: newGoalTarget,
        currentMinor: 0,
        status: "active",
      }),
    });
    if (res.ok) {
      newGoalName = "";
      newGoalTarget = 0;
      await fetchAccountData();
    }
  }

  async function exportCsv() {
    if (!selectedAccountId) return;
    window.open(`/api/accounts/${selectedAccountId}/transactions/export`, "_blank");
  }

  async function importCsv(event: Event) {
    if (!selectedAccountId) return;
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("file", file);
    formData.set("autoCreateCategories", "true");
    await fetch(`/api/accounts/${selectedAccountId}/transactions/import`, {
      method: "POST",
      body: formData,
    });
    input.value = "";
    await fetchAccountData();
  }

  function toggleColumnVisibility(key: string) {
    columns = columns.map((column) => (column.key === key ? { ...column, visible: !column.visible } : column));
  }

  function moveColumn(key: string, direction: -1 | 1) {
    const index = columns.findIndex((column) => column.key === key);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= columns.length) return;
    const copy = [...columns];
    const [item] = copy.splice(index, 1);
    copy.splice(nextIndex, 0, item);
    columns = copy;
  }

  function saveCurrentView() {
    if (!viewName.trim()) return;
    const nextView = {
      name: viewName.trim(),
      search,
      filterType,
      sortBy,
      sortDirection,
    };
    savedViews = [...savedViews.filter((view) => view.name !== nextView.name), nextView];
    viewName = "";
  }

  function applyView(viewNameToApply: string) {
    const view = savedViews.find((item) => item.name === viewNameToApply);
    if (!view) return;
    search = view.search;
    filterType = view.filterType as "" | "expense" | "income" | "transfer";
    sortBy = view.sortBy as "occurredOn" | "amountMinor" | "merchant" | "type" | "createdAt";
    sortDirection = view.sortDirection as "asc" | "desc";
    void fetchAccountData();
  }

  async function createAccount() {
    const name = prompt("New account name");
    if (!name?.trim()) return;
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, currencyCode: "USD", timezone: "UTC" }),
    });
    if (res.ok) {
      const body = await res.json();
      selectedAccountId = body.account.id;
      const accountRes = await fetch("/api/accounts");
      if (accountRes.ok) {
        const { accounts: nextAccounts } = await accountRes.json();
        accounts = nextAccounts;
      }
      await fetchAccountData();
    }
  }

  $effect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(COLUMN_PREFS_KEY, JSON.stringify(columns));
  });

  $effect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify(savedViews));
  });

  onMount(() => {
    const rawColumns = localStorage.getItem(COLUMN_PREFS_KEY);
    if (rawColumns) {
      try {
        const parsed = JSON.parse(rawColumns);
        if (Array.isArray(parsed)) columns = parsed;
      } catch {
        // Ignore invalid local storage.
      }
    }
    const rawViews = localStorage.getItem(VIEW_PREFS_KEY);
    if (rawViews) {
      try {
        const parsed = JSON.parse(rawViews);
        if (Array.isArray(parsed)) savedViews = parsed;
      } catch {
        // Ignore invalid local storage.
      }
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        void loadMore();
      }
    });
    if (intersectionRef) observer.observe(intersectionRef);
    return () => observer.disconnect();
  });
</script>

{#if !authenticated}
  <main class="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-4 px-4 py-10 text-center sm:px-8">
    <h1 class="text-3xl font-semibold">Chhan Chhan</h1>
    <p class="max-w-lg text-sm text-muted-foreground">
      This app is account-based and server-backed. Sign in to start tracking transactions, budgets, and goals.
    </p>
    <a href={`${PUBLIC_BASE_AUTH_URL}/login`} class="rounded border border-border bg-secondary px-4 py-2 hover:bg-muted">Open Login</a>
    <a href="/sample" class="text-sm underline text-primary">View `/sample` design reference</a>
  </main>
{:else}
  <main class="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 bg-background px-4 py-6 text-foreground sm:px-8">
    <header class="rounded-md border border-border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-[0.18em] text-accent">Single-Page Finance Workspace</p>
          <h1 class="mt-1 text-2xl font-semibold sm:text-3xl">Chhan Chhan</h1>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <select bind:value={selectedAccountId} onchange={() => fetchAccountData()} class="rounded border border-border bg-secondary px-2 py-1">
            {#each accounts as account}
              <option value={account.id}>{account.name} ({account.role})</option>
            {/each}
          </select>
          <button class="rounded border border-border bg-secondary px-2 py-1 hover:bg-muted" onclick={createAccount}>New Account</button>
          <button class="rounded border border-border bg-secondary px-2 py-1 hover:bg-muted" onclick={exportCsv}>Export CSV</button>
          <label class="rounded border border-border bg-secondary px-2 py-1 hover:bg-muted">
            Import CSV
            <input type="file" accept=".csv,text/csv" class="hidden" onchange={importCsv} />
          </label>
          <a href="/sample" class="rounded border border-border bg-secondary px-2 py-1 hover:bg-muted">Sample</a>
        </div>
      </div>
    </header>

    <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <article class="rounded-md border border-border bg-card p-3">
        <p class="text-xs uppercase tracking-wider text-muted-foreground">Monthly Income</p>
        <p class="mt-1 text-2xl font-semibold text-(--success)">{fmtMoney(analytics?.monthly?.incomeMinor ?? 0)}</p>
      </article>
      <article class="rounded-md border border-border bg-card p-3">
        <p class="text-xs uppercase tracking-wider text-muted-foreground">Monthly Expense</p>
        <p class="mt-1 text-2xl font-semibold text-(--danger)">{fmtMoney(analytics?.monthly?.expenseMinor ?? 0)}</p>
      </article>
      <article class="rounded-md border border-border bg-card p-3">
        <p class="text-xs uppercase tracking-wider text-muted-foreground">Monthly Net</p>
        <p class="mt-1 text-2xl font-semibold">{fmtMoney(analytics?.monthly?.netMinor ?? 0)}</p>
      </article>
      <article class="rounded-md border border-border bg-card p-3">
        <p class="text-xs uppercase tracking-wider text-muted-foreground">Transactions Loaded</p>
        <p class="mt-1 text-2xl font-semibold">{transactions.length}</p>
      </article>
    </section>

    <section class="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <article class="rounded-md border border-border bg-card p-4">
        <div class="flex flex-wrap items-center gap-2">
          <input
            bind:value={search}
            type="text"
            placeholder="Search merchant/notes"
            class="min-w-[180px] rounded border border-border bg-background px-2 py-1 text-sm"
          />
          <select bind:value={filterType} class="rounded border border-border bg-background px-2 py-1 text-sm">
            <option value="">All types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </select>
          <input bind:value={dateFrom} type="date" class="rounded border border-border bg-background px-2 py-1 text-sm" />
          <input bind:value={dateTo} type="date" class="rounded border border-border bg-background px-2 py-1 text-sm" />
          <select bind:value={sortBy} class="rounded border border-border bg-background px-2 py-1 text-sm">
            <option value="occurredOn">Date</option>
            <option value="amountMinor">Amount</option>
            <option value="merchant">Merchant</option>
            <option value="type">Type</option>
            <option value="createdAt">Created</option>
          </select>
          <select bind:value={sortDirection} class="rounded border border-border bg-background px-2 py-1 text-sm">
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
          <button class="rounded border border-border bg-secondary px-2 py-1 text-sm hover:bg-muted" onclick={fetchAccountData}>Apply</button>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <input bind:value={viewName} placeholder="View name" class="rounded border border-border bg-background px-2 py-1" />
          <button class="rounded border border-border bg-secondary px-2 py-1 hover:bg-muted" onclick={saveCurrentView}>Save View</button>
          {#each savedViews as view}
            <button class="rounded border border-border bg-background px-2 py-1 hover:bg-muted" onclick={() => applyView(view.name)}
              >{view.name}</button
            >
          {/each}
        </div>

        <div class="mt-4 flex flex-wrap gap-2 text-xs">
          {#each columns as column}
            <span class="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1">
              <input type="checkbox" checked={column.visible} onchange={() => toggleColumnVisibility(column.key)} />
              {column.label}
              <button class="rounded border border-border px-1" onclick={() => moveColumn(column.key, -1)}>↑</button>
              <button class="rounded border border-border px-1" onclick={() => moveColumn(column.key, 1)}>↓</button>
            </span>
          {/each}
        </div>

        <div class="mt-3 overflow-x-auto">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="border-b border-border text-muted-foreground">
                {#each visibleColumns as column}
                  <th class="px-2 py-2 text-left font-medium">{column.label}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each transactions as row}
                <tr class="border-b border-border/70">
                  {#each visibleColumns as column}
                    <td class="px-2 py-2">
                      {#if column.key === "amountMinor"}
                        <span class={row.amountMinor < 0 ? "text-(--danger)" : "text-(--success)"}>{fmtMoney(row.amountMinor)}</span>
                      {:else if column.key === "occurredOn"}
                        {row.occurredOn}
                      {:else if column.key === "merchant"}
                        {row.merchant ?? "-"}
                      {:else if column.key === "categoryName"}
                        {row.categoryName ?? "-"}
                      {:else if column.key === "type"}
                        {row.type}
                      {:else}
                        {row.notes ?? "-"}
                      {/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div bind:this={intersectionRef} class="mt-3 text-center text-xs text-muted-foreground">
          {#if loadingMore}
            Loading more...
          {:else if hasMore}
            Scroll for more
          {:else}
            End of list
          {/if}
        </div>
      </article>

      <div class="space-y-4">
        <article class="rounded-md border border-border bg-card p-4">
          <h2 class="text-sm uppercase tracking-widest text-muted-foreground">Quick Add</h2>
          <div class="mt-3 space-y-2">
            <input
              bind:value={newMerchant}
              type="text"
              placeholder="Merchant"
              class="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              bind:value={newAmountMinor}
              type="number"
              placeholder="Amount minor units"
              class="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            />
            <input bind:value={newOccurredOn} type="date" class="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
            <select bind:value={newType} class="w-full rounded border border-border bg-background px-3 py-2 text-sm">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </select>
            <select bind:value={newCategoryId} class="w-full rounded border border-border bg-background px-3 py-2 text-sm">
              <option value="">No category</option>
              {#each categories as category}
                <option value={category.id}>{category.name}</option>
              {/each}
            </select>
            <textarea bind:value={newNotes} rows="2" placeholder="Notes" class="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            ></textarea>
            <button
              disabled={!canEdit}
              class="w-full rounded border border-border bg-secondary px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              onclick={createTransaction}>Add Transaction</button
            >
          </div>
        </article>

        <article class="rounded-md border border-border bg-card p-4">
          <h2 class="text-sm uppercase tracking-widest text-muted-foreground">Category Spend (Month)</h2>
          <div class="mt-3 space-y-2 text-sm">
            {#each categoryChartRows as row}
              <div>
                <div class="mb-1 flex items-center justify-between">
                  <span>{row.name}</span>
                  <span>{fmtMoney(row.amountMinor)}</span>
                </div>
                <div class="h-2 rounded bg-secondary">
                  <div
                    class="h-2 rounded bg-(--meter-needs)"
                    style={`width: ${Math.min(100, (row.amountMinor / Math.max(1, analytics?.monthly?.expenseMinor || 1)) * 100)}%`}
                  ></div>
                </div>
              </div>
            {/each}
          </div>
        </article>
      </div>
    </section>

    <section class="grid gap-4 lg:grid-cols-2">
      <article class="rounded-md border border-border bg-card p-4">
        <h2 class="text-sm uppercase tracking-widest text-muted-foreground">Budgets</h2>
        <div class="mt-3 flex gap-2">
          <input bind:value={newBudgetName} placeholder="Budget name" class="w-full rounded border border-border bg-background px-2 py-1 text-sm" />
          <input
            bind:value={newBudgetLimit}
            type="number"
            placeholder="Limit minor"
            class="w-[140px] rounded border border-border bg-background px-2 py-1 text-sm"
          />
          <button
            disabled={!canEdit}
            class="rounded border border-border bg-secondary px-2 py-1 text-sm hover:bg-muted disabled:opacity-40"
            onclick={createBudget}>Add</button
          >
        </div>
        <div class="mt-3 space-y-2 text-sm">
          {#each budgets as budget}
            <div class="rounded border border-border bg-background p-2">
              <div class="flex items-center justify-between">
                <span>{budget.name}</span>
                <span>{fmtMoney(budget.limitMinor)}</span>
              </div>
              <p class="text-xs text-muted-foreground">{budget.period} {budget.categoryName ? `- ${budget.categoryName}` : "- all categories"}</p>
            </div>
          {/each}
        </div>
      </article>

      <article class="rounded-md border border-border bg-card p-4">
        <h2 class="text-sm uppercase tracking-widest text-muted-foreground">Goals</h2>
        <div class="mt-3 flex gap-2">
          <input bind:value={newGoalName} placeholder="Goal name" class="w-full rounded border border-border bg-background px-2 py-1 text-sm" />
          <input
            bind:value={newGoalTarget}
            type="number"
            placeholder="Target minor"
            class="w-[140px] rounded border border-border bg-background px-2 py-1 text-sm"
          />
          <button
            disabled={!canEdit}
            class="rounded border border-border bg-secondary px-2 py-1 text-sm hover:bg-muted disabled:opacity-40"
            onclick={createGoal}>Add</button
          >
        </div>
        <div class="mt-3 space-y-2 text-sm">
          {#each goals as goal}
            <div class="rounded border border-border bg-background p-2">
              <div class="flex items-center justify-between">
                <span>{goal.name}</span>
                <span>{fmtMoney(goal.currentMinor)} / {fmtMoney(goal.targetMinor)}</span>
              </div>
              <div class="mt-1 h-2 rounded bg-secondary">
                <div
                  class="h-2 rounded bg-(--meter-savings)"
                  style={`width: ${Math.min(100, goal.targetMinor ? (goal.currentMinor / goal.targetMinor) * 100 : 0)}%`}
                ></div>
              </div>
            </div>
          {/each}
        </div>
      </article>
    </section>
  </main>
{/if}
