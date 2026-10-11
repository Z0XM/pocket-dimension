<script lang="ts">
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let scope = $state<"all" | "yours">("all");
  let q = $state("");
  let selected = $state<string[]>([]);

  $effect(() => {
    scope = data.scope === "yours" ? "yours" : "all";
    q = data.q;
    selected = [...data.selectedTagIds];
  });

  function toggleTag(id: string) {
    selected = selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id];
  }

  function applyFilters() {
    const params = new URLSearchParams();
    if (scope === "yours") params.set("scope", "yours");
    if (q.trim()) params.set("q", q.trim());
    for (const id of selected) params.append("tag", id);
    const qs = params.toString();
    goto(qs ? `/library?${qs}` : "/library");
  }

  function formatDuration(ms: number | null) {
    if (ms == null) return "—";
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }
</script>

<section class="space-y-8">
  <div>
    <h1 class="text-3xl font-semibold tracking-tight">Library</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Full Zap catalogue. Use <span class="font-mono text-signal">Your library</span> for tracks you’ve tagged.
    </p>
  </div>

  <form
    class="flex flex-col gap-4 rounded-lg border border-border/70 bg-card/50 p-4"
    onsubmit={(e) => {
      e.preventDefault();
      applyFilters();
    }}
  >
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class={`rounded px-3 py-1.5 font-mono text-xs ${scope === "all" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
        onclick={() => (scope = "all")}
      >
        All
      </button>
      <button
        type="button"
        class={`rounded px-3 py-1.5 font-mono text-xs ${scope === "yours" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
        onclick={() => (scope = "yours")}
      >
        Your library
      </button>
    </div>

    <input class="auth-field" type="search" placeholder="Search title or artists…" bind:value={q} />

    <div class="flex flex-wrap gap-2">
      {#each data.availableTags as tag}
        <button
          type="button"
          class={`rounded-full border px-3 py-1 font-mono text-xs ${selected.includes(tag.id) ? "border-signal bg-signal/15 text-signal" : "border-border text-muted-foreground"}`}
          onclick={() => toggleTag(tag.id)}
        >
          {tag.name}
        </button>
      {/each}
    </div>

    <button type="submit" class="auth-btn w-fit">Apply filters</button>
  </form>

  <div class="rounded-lg border border-border/70 bg-card/40 p-4">
    <h2 class="font-mono text-xs tracking-wider text-muted-foreground uppercase">Upload</h2>
    {#if !data.storageReady}
      <p class="mt-2 text-sm text-muted-foreground">Configure R2 env (`S3_*`) to enable uploads. Catalogue browse works without it.</p>
    {/if}
    {#if form?.uploadError}
      <p class="auth-error mt-3">{form.uploadError}</p>
    {/if}
    {#if form?.uploadOk}
      <p class="mt-3 text-sm text-signal">Added to catalogue.</p>
    {/if}
    <form method="POST" action="?/upload" enctype="multipart/form-data" class="mt-3 space-y-3" use:enhance>
      <input class="auth-field" type="text" name="title" placeholder="Title (optional)" />
      <input class="auth-field" type="file" name="file" accept="audio/*" required />
      <select class="auth-field" name="tagId">
        <option value="">Tag (optional)</option>
        {#each data.availableTags.filter((t) => t.kind === "system") as tag}
          <option value={tag.id}>{tag.name}</option>
        {/each}
      </select>
      <button type="submit" class="auth-btn" disabled={!data.storageReady}>Upload to Zap</button>
    </form>
  </div>

  <ul class="divide-y divide-border/50 rounded-lg border border-border/70 bg-card/30">
    {#if data.assets.length === 0}
      <li class="px-4 py-10 text-center text-sm text-muted-foreground">No tracks match. Ingest or clear filters.</li>
    {:else}
      {#each data.assets as asset}
        <li class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="font-medium text-foreground">{asset.title}</p>
            <p class="font-mono text-xs text-muted-foreground">
              {asset.artists ?? "Unknown"} · {formatDuration(asset.durationMs)} · {asset.sourceType}
            </p>
          </div>
          <div class="flex flex-wrap gap-1">
            {#each asset.tags as tag}
              <span class="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{tag.name}</span>
            {/each}
          </div>
        </li>
      {/each}
    {/if}
  </ul>
</section>
