<main class="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 bg-background px-4 py-6 text-foreground sm:px-8">
  <header class="rounded-md border border-border bg-card p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.18em] text-accent">Sample Reference</p>
        <h1 class="mt-1 text-2xl font-semibold sm:text-3xl">Chhan Chhan Console</h1>
        <p class="mt-1 text-sm text-muted-foreground">Single terminal-first layout with the Mayukacula palette, no gradients.</p>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <span class="rounded border border-border bg-secondary px-2 py-1 text-secondary-foreground">ENV: LOCAL</span>
        <span class="rounded border border-border bg-secondary px-2 py-1 text-secondary-foreground">SYNC: OK</span>
        <span class="rounded border border-border bg-secondary px-2 py-1 text-secondary-foreground">BUILD: STABLE</span>
      </div>
    </div>
  </header>

  <section class="grid gap-4 xl:grid-cols-[260px_1fr]">
    <aside class="rounded-md border border-border bg-card p-4">
      <h2 class="text-sm uppercase tracking-widest text-muted-foreground">Navigator</h2>
      <nav class="mt-3 space-y-2 text-sm">
        <a href="/sample" class="block rounded border border-border px-3 py-2 hover:bg-secondary">Overview</a>
        <a href="/sample" class="block rounded border border-border px-3 py-2 hover:bg-secondary">Transactions</a>
        <a href="/sample" class="block rounded border border-border px-3 py-2 hover:bg-secondary">Budgets</a>
        <a href="/sample" class="block rounded border border-border px-3 py-2 hover:bg-secondary">Categories</a>
        <a href="/sample" class="block rounded border border-border px-3 py-2 hover:bg-secondary">Automation</a>
      </nav>

      <div class="mt-5 rounded border border-border bg-background p-3 text-xs">
        <p class="text-muted-foreground">Active Tags</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <span class="rounded border border-border px-2 py-1">#monthly</span>
          <span class="rounded border border-border px-2 py-1">#family</span>
          <span class="rounded border border-border px-2 py-1">#saving</span>
        </div>
      </div>
    </aside>

    <div class="space-y-4">
      <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article class="rounded-md border border-border bg-card p-3">
          <p class="text-xs uppercase tracking-wider text-muted-foreground">Income</p>
          <p class="mt-1 text-2xl font-semibold">$ 2,450</p>
        </article>
        <article class="rounded-md border border-border bg-card p-3">
          <p class="text-xs uppercase tracking-wider text-muted-foreground">Expenses</p>
          <p class="mt-1 text-2xl font-semibold">$ 1,420</p>
        </article>
        <article class="rounded-md border border-border bg-card p-3">
          <p class="text-xs uppercase tracking-wider text-muted-foreground">Remaining</p>
          <p class="mt-1 text-2xl font-semibold">$ 1,030</p>
        </article>
        <article class="rounded-md border border-border bg-card p-3">
          <p class="text-xs uppercase tracking-wider text-muted-foreground">Rules Triggered</p>
          <p class="mt-1 text-2xl font-semibold">6</p>
        </article>
      </section>

      <section class="grid gap-4 lg:grid-cols-3">
        <article class="rounded-md border border-border bg-card p-4 lg:col-span-2">
          <h2 class="text-sm uppercase tracking-widest text-muted-foreground">Recent Transactions</h2>
          <div class="mt-3 overflow-x-auto">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="border-b border-border text-muted-foreground">
                  <th class="px-2 py-2 text-left font-medium">Date</th>
                  <th class="px-2 py-2 text-left font-medium">Description</th>
                  <th class="px-2 py-2 text-left font-medium">Category</th>
                  <th class="px-2 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-b border-border/70">
                  <td class="px-2 py-2">2026-03-04</td>
                  <td class="px-2 py-2">Groceries</td>
                  <td class="px-2 py-2">Needs</td>
                  <td class="px-2 py-2 text-right text-(--danger)">- $118</td>
                </tr>
                <tr class="border-b border-border/70">
                  <td class="px-2 py-2">2026-03-04</td>
                  <td class="px-2 py-2">Salary Credit</td>
                  <td class="px-2 py-2">Income</td>
                  <td class="px-2 py-2 text-right text-(--success)">+ $900</td>
                </tr>
                <tr class="border-b border-border/70">
                  <td class="px-2 py-2">2026-03-03</td>
                  <td class="px-2 py-2">Internet Bill</td>
                  <td class="px-2 py-2">Utilities</td>
                  <td class="px-2 py-2 text-right text-(--danger)">- $35</td>
                </tr>
                <tr>
                  <td class="px-2 py-2">2026-03-03</td>
                  <td class="px-2 py-2">Transfer to Savings</td>
                  <td class="px-2 py-2">Savings</td>
                  <td class="px-2 py-2 text-right text-(--success)">+ $200</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="rounded-md border border-border bg-card p-4">
          <h2 class="text-sm uppercase tracking-widest text-muted-foreground">Budget Usage</h2>
          <div class="mt-3 space-y-3 text-sm">
            <div>
              <div class="mb-1 flex justify-between"><span>Needs</span><span>68%</span></div>
              <div class="h-2 rounded bg-secondary"><div class="h-2 w-[68%] rounded bg-(--meter-needs)"></div></div>
            </div>
            <div>
              <div class="mb-1 flex justify-between"><span>Wants</span><span>42%</span></div>
              <div class="h-2 rounded bg-secondary"><div class="h-2 w-[42%] rounded bg-(--meter-wants)"></div></div>
            </div>
            <div>
              <div class="mb-1 flex justify-between"><span>Savings</span><span>31%</span></div>
              <div class="h-2 rounded bg-secondary"><div class="h-2 w-[31%] rounded bg-(--meter-savings)"></div></div>
            </div>
          </div>
        </article>
      </section>

      <section class="grid gap-4 lg:grid-cols-2">
        <article class="rounded-md border border-border bg-card p-4">
          <h2 class="text-sm uppercase tracking-widest text-muted-foreground">Console Log</h2>
          <pre class="mt-3 rounded border border-border bg-background p-3 text-xs leading-6 text-foreground">[INFO] 09:20 - Imported 8 transactions
[WARN] 10:05 - Dining category exceeded weekly threshold
[INFO] 12:11 - Rule "auto-save" executed successfully
[INFO] 18:30 - Budget snapshot generated</pre>
        </article>

        <article class="rounded-md border border-border bg-card p-4">
          <h2 class="text-sm uppercase tracking-widest text-muted-foreground">Quick Add (UI Only)</h2>
          <form class="mt-3 space-y-3">
            <div>
              <label for="quick-description" class="mb-1 block text-xs text-muted-foreground">Description</label>
              <input
                id="quick-description"
                type="text"
                placeholder="Coffee"
                class="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none ring-0 focus:border-primary"
              />
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label for="quick-amount" class="mb-1 block text-xs text-muted-foreground">Amount</label>
                <input
                  id="quick-amount"
                  type="text"
                  placeholder="$ 0.00"
                  class="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label for="quick-category" class="mb-1 block text-xs text-muted-foreground">Category</label>
                <select
                  id="quick-category"
                  class="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option>Needs</option>
                  <option>Wants</option>
                  <option>Savings</option>
                </select>
              </div>
            </div>
            <button type="button" class="rounded border border-border bg-secondary px-3 py-2 text-sm hover:bg-muted">Add Entry</button>
          </form>
        </article>
      </section>
    </div>
  </section>
</main>
