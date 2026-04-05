<script lang="ts">
  import { onMount } from "svelte";

  type ThemePalette = {
    label: string;
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    border: string;
    ring: string;
    success: string;
    danger: string;
    meterNeeds: string;
    meterWants: string;
    meterSavings: string;
  };

  const STORAGE_THEME_KEY = "chhan-chhan:selected-theme";
  const STORAGE_IMPORTED_THEME_KEY = "chhan-chhan:imported-theme";
  const IMPORTED_THEME_KEY = "imported-custom";

  // Popular dark terminal/editor palettes (internet-inspired), including current Mayukai style.
  const baseThemes: Record<string, ThemePalette> = {
    mayukai: {
      label: "Mayukai Dark",
      background: "#060b0f",
      foreground: "#dadbc0",
      card: "#0d1016",
      cardForeground: "#dadbc0",
      primary: "#e6b450",
      primaryForeground: "#0a0e14",
      secondary: "#121922",
      secondaryForeground: "#b3b1ad",
      muted: "#191e25",
      mutedForeground: "#8b93a1",
      accent: "#d4bfff",
      accentForeground: "#0a0e14",
      border: "#2e323c",
      ring: "#ffa759",
      success: "#91b362",
      danger: "#f07178",
      meterNeeds: "#e6b450",
      meterWants: "#d4bfff",
      meterSavings: "#91b362",
    },
    ayu: {
      label: "Ayu Dark Bordered",
      background: "#0d1017",
      foreground: "#bfbdb6",
      card: "#141821",
      cardForeground: "#bfbdb6",
      primary: "#e6b450",
      primaryForeground: "#765b24",
      secondary: "#10141c",
      secondaryForeground: "#bfbdb6",
      muted: "#161a24",
      mutedForeground: "#5a6378",
      accent: "#d0a1ff",
      accentForeground: "#141821",
      border: "#1b1f29",
      ring: "#ffb454",
      success: "#70bf56",
      danger: "#f26d78",
      meterNeeds: "#e6b450",
      meterWants: "#d0a1ff",
      meterSavings: "#70bf56",
    },
    dracula: {
      label: "Dracula",
      background: "#0b0b12",
      foreground: "#f8f8f2",
      card: "#141520",
      cardForeground: "#f8f8f2",
      primary: "#ffb86c",
      primaryForeground: "#141520",
      secondary: "#1b1d2b",
      secondaryForeground: "#f8f8f2",
      muted: "#222435",
      mutedForeground: "#bdc0cc",
      accent: "#c5a3ff",
      accentForeground: "#141520",
      border: "#35384a",
      ring: "#8be9fd",
      success: "#50fa7b",
      danger: "#ff5555",
      meterNeeds: "#ffb86c",
      meterWants: "#bd93f9",
      meterSavings: "#50fa7b",
    },
    gruvbox: {
      label: "Gruvbox Dark",
      background: "#0f0d0a",
      foreground: "#ebdbb2",
      card: "#181512",
      cardForeground: "#ebdbb2",
      primary: "#fabd2f",
      primaryForeground: "#181512",
      secondary: "#211d19",
      secondaryForeground: "#ebdbb2",
      muted: "#2b251f",
      mutedForeground: "#bdae93",
      accent: "#d98ca1",
      accentForeground: "#181512",
      border: "#453c34",
      ring: "#83a598",
      success: "#b8bb26",
      danger: "#fb4934",
      meterNeeds: "#fabd2f",
      meterWants: "#d3869b",
      meterSavings: "#b8bb26",
    },
    catppuccin: {
      label: "Catppuccin Mocha",
      background: "#0c0c14",
      foreground: "#cdd6f4",
      card: "#141422",
      cardForeground: "#cdd6f4",
      primary: "#f9e2af",
      primaryForeground: "#141422",
      secondary: "#1c1d2f",
      secondaryForeground: "#cdd6f4",
      muted: "#26283a",
      mutedForeground: "#a6adc8",
      accent: "#d2b2ff",
      accentForeground: "#141422",
      border: "#3d4056",
      ring: "#89b4fa",
      success: "#a6e3a1",
      danger: "#f38ba8",
      meterNeeds: "#f9e2af",
      meterWants: "#cba6f7",
      meterSavings: "#a6e3a1",
    },
    onedark: {
      label: "One Dark Pro",
      background: "#0f1115",
      foreground: "#abb2bf",
      card: "#171b22",
      cardForeground: "#abb2bf",
      primary: "#e5c07b",
      primaryForeground: "#171b22",
      secondary: "#202632",
      secondaryForeground: "#abb2bf",
      muted: "#272d37",
      mutedForeground: "#8d96a5",
      accent: "#d08aea",
      accentForeground: "#171b22",
      border: "#343b47",
      ring: "#61afef",
      success: "#98c379",
      danger: "#e06c75",
      meterNeeds: "#e5c07b",
      meterWants: "#c678dd",
      meterSavings: "#98c379",
    },
    nord: {
      label: "Nord",
      background: "#0f1318",
      foreground: "#d8dee9",
      card: "#171d26",
      cardForeground: "#e5e9f0",
      primary: "#ebcb8b",
      primaryForeground: "#171d26",
      secondary: "#202938",
      secondaryForeground: "#e5e9f0",
      muted: "#2a3446",
      mutedForeground: "#c0c8d8",
      accent: "#b48ead",
      accentForeground: "#171d26",
      border: "#354158",
      ring: "#88c0d0",
      success: "#a3be8c",
      danger: "#bf616a",
      meterNeeds: "#ebcb8b",
      meterWants: "#b48ead",
      meterSavings: "#a3be8c",
    },
    tokyonight: {
      label: "Tokyo Night",
      background: "#0b0d14",
      foreground: "#c0caf5",
      card: "#141927",
      cardForeground: "#c0caf5",
      primary: "#e0af68",
      primaryForeground: "#141927",
      secondary: "#1d2335",
      secondaryForeground: "#c0caf5",
      muted: "#262d44",
      mutedForeground: "#9aa5ce",
      accent: "#bb9af7",
      accentForeground: "#141927",
      border: "#353d5e",
      ring: "#7aa2f7",
      success: "#9ece6a",
      danger: "#f7768e",
      meterNeeds: "#e0af68",
      meterWants: "#bb9af7",
      meterSavings: "#9ece6a",
    },
  };

  let importedTheme = $state<ThemePalette | null>(null);
  let selectedTheme = $state("mayukai");

  const allThemes = $derived.by(() => {
    if (!importedTheme) return baseThemes;
    return {
      ...baseThemes,
      [IMPORTED_THEME_KEY]: importedTheme,
    };
  });
  const currentTheme = $derived(allThemes[selectedTheme] ?? baseThemes.mayukai);
  const themeKeys = $derived(Object.keys(allThemes));
  const themeStyle = $derived(
    `--background: ${currentTheme.background};
--foreground: ${currentTheme.foreground};
--card: ${currentTheme.card};
--card-foreground: ${currentTheme.cardForeground};
--primary: ${currentTheme.primary};
--primary-foreground: ${currentTheme.primaryForeground};
--secondary: ${currentTheme.secondary};
--secondary-foreground: ${currentTheme.secondaryForeground};
--muted: ${currentTheme.muted};
--muted-foreground: ${currentTheme.mutedForeground};
--accent: ${currentTheme.accent};
--accent-foreground: ${currentTheme.accentForeground};
--border: ${currentTheme.border};
--ring: ${currentTheme.ring};
--success: ${currentTheme.success};
--danger: ${currentTheme.danger};
--meter-needs: ${currentTheme.meterNeeds};
--meter-wants: ${currentTheme.meterWants};
--meter-savings: ${currentTheme.meterSavings};`
  );

  let importInput = $state<HTMLInputElement | null>(null);

  function isValidPalette(value: unknown): value is ThemePalette {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    const keys: Array<keyof ThemePalette> = [
      "label",
      "background",
      "foreground",
      "card",
      "cardForeground",
      "primary",
      "primaryForeground",
      "secondary",
      "secondaryForeground",
      "muted",
      "mutedForeground",
      "accent",
      "accentForeground",
      "border",
      "ring",
      "success",
      "danger",
      "meterNeeds",
      "meterWants",
      "meterSavings",
    ];
    return keys.every((key) => typeof v[key] === "string");
  }

  onMount(() => {
    try {
      const rawImported = localStorage.getItem(STORAGE_IMPORTED_THEME_KEY);
      if (rawImported) {
        const parsed = JSON.parse(rawImported) as unknown;
        if (isValidPalette(parsed)) {
          importedTheme = parsed;
        }
      }

      const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
      if (!savedTheme) return;
      if (savedTheme in baseThemes) {
        selectedTheme = savedTheme;
        return;
      }
      if (savedTheme === IMPORTED_THEME_KEY && importedTheme) {
        selectedTheme = savedTheme;
      }
    } catch {
      // Ignore invalid localStorage payloads and use defaults.
    }
  });

  $effect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_THEME_KEY, selectedTheme);
  });

  $effect(() => {
    if (typeof window === "undefined") return;
    if (importedTheme) {
      localStorage.setItem(STORAGE_IMPORTED_THEME_KEY, JSON.stringify(importedTheme));
    } else {
      localStorage.removeItem(STORAGE_IMPORTED_THEME_KEY);
    }
  });

  function exportTheme() {
    if (typeof window === "undefined") return;
    const payload = {
      name: currentTheme.label,
      themeKey: selectedTheme,
      palette: currentTheme,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentTheme.label.toLowerCase().replaceAll(" ", "-")}-theme.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openImportPicker() {
    importInput?.click();
  }

  async function handleImportTheme(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const candidate = (parsed as { palette?: unknown }).palette ?? parsed;
      if (!isValidPalette(candidate)) {
        throw new Error("Invalid theme format.");
      }

      importedTheme = {
        ...candidate,
        label: `${candidate.label} (Imported)`,
      };
      selectedTheme = IMPORTED_THEME_KEY;
    } catch {
      // Ignore malformed import payloads.
    } finally {
      input.value = "";
    }
  }
</script>

<main style={themeStyle} class="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 bg-background px-4 py-6 text-foreground sm:px-8">
  <header class="rounded-md border border-border bg-card p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.18em] text-accent">Sample Reference</p>
        <h1 class="mt-1 text-2xl font-semibold sm:text-3xl">Chhan Chhan Console</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Single terminal-first layout with switchable popular dark themes (including Mayukai), no gradients.
        </p>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <label for="theme-select" class="sr-only">Theme select</label>
        <select
          id="theme-select"
          bind:value={selectedTheme}
          class="rounded border border-border bg-secondary px-2 py-1 text-secondary-foreground outline-none focus:border-primary"
        >
          {#each themeKeys as key}
            <option value={key}>{allThemes[key].label}</option>
          {/each}
        </select>
        <button
          type="button"
          class="rounded border border-border bg-secondary px-2 py-1 text-secondary-foreground hover:bg-muted"
          onclick={exportTheme}>Export Theme</button
        >
        <button
          type="button"
          class="rounded border border-border bg-secondary px-2 py-1 text-secondary-foreground hover:bg-muted"
          onclick={openImportPicker}>Import Theme</button
        >
        <input bind:this={importInput} type="file" accept="application/json" class="hidden" onchange={handleImportTheme} />
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
