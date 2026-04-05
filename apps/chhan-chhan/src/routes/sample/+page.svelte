<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";

  const TERMINAL_BORDERS_KEY = "chhan-chhan-sample-terminal-borders";

  let terminalBorders = $state(true);

  onMount(() => {
    const raw = localStorage.getItem(TERMINAL_BORDERS_KEY);
    if (raw !== null) terminalBorders = raw === "1";
  });

  function onTerminalBordersChange(checked: boolean) {
    terminalBorders = checked;
    if (browser) localStorage.setItem(TERMINAL_BORDERS_KEY, checked ? "1" : "0");
  }
</script>

<main
  class="sample-console relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 bg-background px-4 py-6 text-foreground sm:px-8"
  data-terminal-borders={terminalBorders ? "on" : "off"}
>
  <header class="rounded-md border border-border/90 bg-card/95 p-4 shadow-[inset_0_1px_0_rgba(139,233,253,0.07)] backdrop-blur-[2px]">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.18em] text-accent">Sample Reference</p>
        <h1 class="mt-1 text-2xl font-semibold sm:text-3xl">Chhan Chhan Console</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Single terminal-first layout with the Mayukacula palette; cards stay flat, the canvas gets a faint grain and rim light.
        </p>
      </div>
      <div class="flex flex-col items-stretch gap-3 sm:items-end">
        <label
          class="flex cursor-pointer items-center gap-2 rounded border border-border/70 bg-background/50 px-2.5 py-1.5 text-xs text-muted-foreground shadow-[inset_0_1px_0_rgba(139,233,253,0.05)] select-none hover:border-border hover:text-foreground"
        >
          <input
            type="checkbox"
            class="size-3.5 shrink-0 rounded border border-border bg-background accent-primary"
            checked={terminalBorders}
            onchange={(e) => onTerminalBordersChange(e.currentTarget.checked)}
          />
          <span>Rotating card borders</span>
        </label>
        <div class="flex flex-wrap items-center justify-end gap-2 text-xs">
          <span
            class="rounded border border-border/80 bg-secondary/90 px-2 py-1 text-secondary-foreground shadow-[0_1px_0_rgba(0,0,0,0.35)] transition-colors hover:border-border"
            >ENV: LOCAL</span
          >
          <span
            class="rounded border border-border/80 bg-secondary/90 px-2 py-1 text-secondary-foreground shadow-[0_1px_0_rgba(0,0,0,0.35)] transition-colors hover:border-border"
            >SYNC: OK</span
          >
          <span
            class="rounded border border-border/80 bg-secondary/90 px-2 py-1 text-secondary-foreground shadow-[0_1px_0_rgba(0,0,0,0.35)] transition-colors hover:border-border"
            >BUILD: STABLE</span
          >
        </div>
      </div>
    </div>
  </header>

  <section class="grid gap-4 xl:grid-cols-[260px_1fr]">
    <aside class="rounded-md border border-border/90 bg-card/95 p-4 shadow-[inset_0_1px_0_rgba(197,163,255,0.05)]">
      <h2 class="text-sm uppercase tracking-widest text-muted-foreground">Navigator</h2>
      <nav class="mt-3 space-y-2 text-sm">
        <a
          href="/sample"
          class="block rounded border border-border/80 px-3 py-2 transition-colors duration-150 hover:border-border hover:bg-secondary/80">Overview</a
        >
        <a
          href="/sample"
          class="block rounded border border-border/80 px-3 py-2 transition-colors duration-150 hover:border-border hover:bg-secondary/80"
          >Transactions</a
        >
        <a
          href="/sample"
          class="block rounded border border-border/80 px-3 py-2 transition-colors duration-150 hover:border-border hover:bg-secondary/80">Budgets</a
        >
        <a
          href="/sample"
          class="block rounded border border-border/80 px-3 py-2 transition-colors duration-150 hover:border-border hover:bg-secondary/80"
          >Categories</a
        >
        <a
          href="/sample"
          class="block rounded border border-border/80 px-3 py-2 transition-colors duration-150 hover:border-border hover:bg-secondary/80"
          >Automation</a
        >
      </nav>

      <div class="mt-5 rounded border border-dashed border-border/80 bg-background/80 p-3 text-xs shadow-[inset_0_0_0_1px_rgba(46,50,60,0.4)]">
        <p class="text-muted-foreground">Active Tags</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <span class="rounded border border-border/80 px-2 py-1 transition-colors duration-150 hover:border-ring/50">#monthly</span>
          <span class="rounded border border-border/80 px-2 py-1 transition-colors duration-150 hover:border-ring/50">#family</span>
          <span class="rounded border border-border/80 px-2 py-1 transition-colors duration-150 hover:border-ring/50">#saving</span>
        </div>
      </div>
    </aside>

    <div class="space-y-4">
      <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="terminal-card-shell">
          <article
            class="p-3 shadow-[0_1px_0_rgba(139,233,253,0.04)_inset] transition-shadow duration-200 hover:shadow-[0_0_0_1px_rgba(139,233,253,0.12)]"
          >
            <p class="text-xs uppercase tracking-wider text-muted-foreground">Income</p>
            <p class="mt-1 text-2xl font-semibold tabular-nums tracking-tight">$ 2,450</p>
          </article>
        </div>
        <div class="terminal-card-shell">
          <article
            class="p-3 shadow-[0_1px_0_rgba(139,233,253,0.04)_inset] transition-shadow duration-200 hover:shadow-[0_0_0_1px_rgba(139,233,253,0.12)]"
          >
            <p class="text-xs uppercase tracking-wider text-muted-foreground">Expenses</p>
            <p class="mt-1 text-2xl font-semibold tabular-nums tracking-tight">$ 1,420</p>
          </article>
        </div>
        <div class="terminal-card-shell">
          <article
            class="p-3 shadow-[0_1px_0_rgba(255,184,108,0.06)_inset] transition-shadow duration-200 hover:shadow-[0_0_0_1px_rgba(255,184,108,0.22)]"
          >
            <p class="text-xs uppercase tracking-wider text-muted-foreground">Remaining</p>
            <p class="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-primary">$ 1,030</p>
          </article>
        </div>
        <div class="terminal-card-shell">
          <article
            class="p-3 shadow-[0_1px_0_rgba(139,233,253,0.04)_inset] transition-shadow duration-200 hover:shadow-[0_0_0_1px_rgba(139,233,253,0.12)]"
          >
            <p class="text-xs uppercase tracking-wider text-muted-foreground">Rules Triggered</p>
            <p class="mt-1 text-2xl font-semibold tabular-nums tracking-tight">6</p>
          </article>
        </div>
      </section>

      <section class="grid gap-4 lg:grid-cols-3">
        <div class="terminal-card-shell min-h-0 lg:col-span-2">
          <article class="min-h-0 p-4 shadow-[inset_0_1px_0_rgba(139,233,253,0.05)]">
            <h2 class="text-sm uppercase tracking-widest text-muted-foreground">Recent Transactions</h2>
            <div class="mt-3 overflow-x-auto rounded-md border border-border/60 bg-background/50">
              <table class="w-full border-collapse text-sm">
                <thead>
                  <tr class="border-b border-border/80 bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th class="px-2 py-2 font-medium">Date</th>
                    <th class="px-2 py-2 font-medium">Description</th>
                    <th class="px-2 py-2 font-medium">Category</th>
                    <th class="px-2 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody class="tabular-nums">
                  <tr class="border-b border-border/50 transition-colors duration-150 hover:bg-muted/30">
                    <td class="px-2 py-2 text-muted-foreground">2026-03-04</td>
                    <td class="px-2 py-2">Groceries</td>
                    <td class="px-2 py-2">Needs</td>
                    <td class="px-2 py-2 text-right font-medium text-(--danger)">- $118</td>
                  </tr>
                  <tr class="border-b border-border/50 transition-colors duration-150 hover:bg-muted/30">
                    <td class="px-2 py-2 text-muted-foreground">2026-03-04</td>
                    <td class="px-2 py-2">Salary Credit</td>
                    <td class="px-2 py-2">Income</td>
                    <td class="px-2 py-2 text-right font-medium text-(--success)">+ $900</td>
                  </tr>
                  <tr class="border-b border-border/50 transition-colors duration-150 hover:bg-muted/30">
                    <td class="px-2 py-2 text-muted-foreground">2026-03-03</td>
                    <td class="px-2 py-2">Internet Bill</td>
                    <td class="px-2 py-2">Utilities</td>
                    <td class="px-2 py-2 text-right font-medium text-(--danger)">- $35</td>
                  </tr>
                  <tr class="transition-colors duration-150 hover:bg-muted/30">
                    <td class="px-2 py-2 text-muted-foreground">2026-03-03</td>
                    <td class="px-2 py-2">Transfer to Savings</td>
                    <td class="px-2 py-2">Savings</td>
                    <td class="px-2 py-2 text-right font-medium text-(--success)">+ $200</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <div class="terminal-card-shell min-h-0">
          <article class="p-4 shadow-[inset_0_1px_0_rgba(197,163,255,0.05)]">
            <h2 class="text-sm uppercase tracking-widest text-muted-foreground">Budget Usage</h2>
            <div class="mt-3 space-y-3 text-sm">
              <div>
                <div class="mb-1 flex justify-between tabular-nums"><span>Needs</span><span>68%</span></div>
                <div class="h-2 overflow-hidden rounded-full bg-secondary ring-1 ring-border/40">
                  <div
                    class="h-full w-[68%] rounded-full bg-(--meter-needs) shadow-[0_0_10px_rgba(255,184,108,0.35)] transition-[width] duration-500 ease-out"
                  ></div>
                </div>
              </div>
              <div>
                <div class="mb-1 flex justify-between tabular-nums"><span>Wants</span><span>42%</span></div>
                <div class="h-2 overflow-hidden rounded-full bg-secondary ring-1 ring-border/40">
                  <div
                    class="h-full w-[42%] rounded-full bg-(--meter-wants) shadow-[0_0_10px_rgba(189,147,249,0.35)] transition-[width] duration-500 ease-out"
                  ></div>
                </div>
              </div>
              <div>
                <div class="mb-1 flex justify-between tabular-nums"><span>Savings</span><span>31%</span></div>
                <div class="h-2 overflow-hidden rounded-full bg-secondary ring-1 ring-border/40">
                  <div
                    class="h-full w-[31%] rounded-full bg-(--meter-savings) shadow-[0_0_10px_rgba(80,250,123,0.28)] transition-[width] duration-500 ease-out"
                  ></div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="grid gap-4 lg:grid-cols-2">
        <div class="terminal-card-shell min-h-0">
          <article class="p-4 shadow-[inset_0_1px_0_rgba(139,233,253,0.04)]">
            <h2 class="text-sm uppercase tracking-widest text-muted-foreground">Console Log</h2>
            <pre
              class="mt-3 rounded border border-border/80 bg-[#080c10] p-3 text-xs leading-6 text-foreground shadow-[inset_0_1px_0_rgba(139,233,253,0.06)]"><code
                class="block whitespace-pre"
                ><span class="text-ring">[INFO]</span> 09:20 - Imported 8 transactions
<span class="text-primary">[WARN]</span> 10:05 - Dining category exceeded weekly threshold
<span class="text-ring">[INFO]</span> 12:11 - Rule "auto-save" executed successfully
<span class="text-ring">[INFO]</span> 18:30 - Budget snapshot generated</code
              ></pre>
          </article>
        </div>

        <div class="terminal-card-shell min-h-0">
          <article class="p-4 shadow-[inset_0_1px_0_rgba(197,163,255,0.04)]">
            <h2 class="text-sm uppercase tracking-widest text-muted-foreground">Quick Add (UI Only)</h2>
            <form class="mt-3 space-y-3">
              <div>
                <label for="quick-description" class="mb-1 block text-xs text-muted-foreground">Description</label>
                <input
                  id="quick-description"
                  type="text"
                  placeholder="Coffee"
                  class="w-full rounded border border-border/80 bg-background/90 px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-150 ring-0 placeholder:text-muted-foreground/70 focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                <div>
                  <label for="quick-amount" class="mb-1 block text-xs text-muted-foreground">Amount</label>
                  <input
                    id="quick-amount"
                    type="text"
                    placeholder="$ 0.00"
                    class="w-full rounded border border-border/80 bg-background/90 px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
                  />
                </div>
                <div>
                  <label for="quick-category" class="mb-1 block text-xs text-muted-foreground">Category</label>
                  <select
                    id="quick-category"
                    class="w-full rounded border border-border/80 bg-background/90 px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
                  >
                    <option>Needs</option>
                    <option>Wants</option>
                    <option>Savings</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                class="rounded border border-primary/35 bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-[0_0_20px_rgba(255,184,108,0.12)] transition-[filter,transform] duration-150 hover:brightness-110 active:translate-y-px"
              >
                Add Entry
              </button>
            </form>
          </article>
        </div>
      </section>
    </div>
  </section>
</main>
