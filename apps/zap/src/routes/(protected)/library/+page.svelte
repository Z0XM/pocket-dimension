<script lang="ts">
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import TagMultiSelect from "$lib/components/TagMultiSelect.svelte";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let scope = $state<"all" | "yours">("all");
  let q = $state("");
  let selected = $state<string[]>([]);
  let uploadTagIds = $state<string[]>([]);
  let editingAssetId = $state<string | null>(null);
  let editTagIds = $state<string[]>([]);

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

  function startEditTags(asset: PageData["assets"][number]) {
    editingAssetId = asset.id;
    editTagIds = asset.tags.map((t: { id: string }) => t.id);
  }
</script>

<section class="space-y-8">
  <div>
    <h1 class="text-3xl font-semibold tracking-tight">Library</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Full Zap catalogue. Use <span class="font-mono text-signal">Your library</span> for tracks you’ve tagged. Filter chips use
      <span class="font-mono text-signal">AND</span>.
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

  <div class="relative z-10 overflow-visible rounded-lg border border-border/70 bg-card/40 p-4">
    <h2 class="font-mono text-xs tracking-wider text-muted-foreground uppercase">Upload</h2>
    {#if !data.storageReady}
      <p class="mt-2 text-sm text-muted-foreground">
        Configure R2 env to enable uploads. Use account endpoint
        <span class="font-mono text-signal">https://&lt;ACCOUNT_ID&gt;.r2.cloudflarestorage.com</span>,
        <span class="font-mono">S3_ACCESS_KEY</span> / <span class="font-mono">S3_SECRET_KEY</span> (R2 S3 API token),
        <span class="font-mono">S3_BUCKET</span>, <span class="font-mono">S3_REGION=auto</span>.
      </p>
    {:else if data.storageInfo.configured}
      <p class="mt-2 font-mono text-[11px] text-muted-foreground">
        R2 ready · {data.storageInfo.bucket} · {data.storageInfo.endpoint} · vhs={String(data.storageInfo.virtualHostedStyle)}
      </p>
    {/if}
    {#if form?.uploadError}
      <p class="auth-error mt-3">{form.uploadError}</p>
    {/if}
    {#if form?.uploadOk}
      <p class="mt-3 text-sm text-signal">Added to catalogue.</p>
    {/if}
    <form
      method="POST"
      action="?/upload"
      enctype="multipart/form-data"
      class="mt-3 space-y-3"
      use:enhance={() => {
        return async ({ update }) => {
          await update();
          uploadTagIds = [];
        };
      }}
    >
      <input class="auth-field" type="text" name="title" placeholder="Title (optional)" />
      <input class="auth-field" type="file" name="file" accept="audio/*" required />
      <div>
        <p class="mb-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Tags (many allowed)</p>
        <TagMultiSelect options={data.availableTags} bind:selected={uploadTagIds} name="tagIds" placeholder="Select tags…" />
      </div>
      <input class="auth-field" type="text" name="customTag" placeholder="New custom tag (optional)" />
      <button type="submit" class="auth-btn" disabled={!data.storageReady}>Upload to Zap</button>
    </form>
  </div>

  {#if form?.tagError}
    <p class="auth-error">{form.tagError}</p>
  {/if}
  {#if form?.tagOk}
    <p class="text-sm text-signal">Tags updated.</p>
  {/if}

  <ul class="divide-y divide-border/50 rounded-lg border border-border/70 bg-card/30">
    {#if data.assets.length === 0}
      <li class="px-4 py-10 text-center text-sm text-muted-foreground">No tracks match. Ingest or clear filters.</li>
    {:else}
      {#each data.assets as asset}
        <li class="flex flex-col gap-3 px-4 py-3">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p class="font-medium text-foreground">{asset.title}</p>
              <p class="font-mono text-xs text-muted-foreground">
                {asset.artists ?? "Unknown"} · {formatDuration(asset.durationMs)} · {asset.sourceType}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-1">
              {#each asset.tags as tag}
                <span class="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{tag.name}</span>
              {/each}
              <button
                type="button"
                class="rounded border border-border px-2 py-0.5 font-mono text-[10px] text-signal hover:bg-signal/10"
                onclick={() => (editingAssetId === asset.id ? (editingAssetId = null) : startEditTags(asset))}
              >
                {editingAssetId === asset.id ? "Cancel" : "Edit tags"}
              </button>
            </div>
          </div>

          {#if editingAssetId === asset.id}
            <form
              method="POST"
              action="?/setTags"
              class="space-y-2 rounded border border-border/60 bg-background/40 p-3"
              use:enhance={() => {
                return async ({ result, update }) => {
                  await update();
                  if (result.type === "success") editingAssetId = null;
                };
              }}
            >
              <input type="hidden" name="mediaAssetId" value={asset.id} />
              <TagMultiSelect options={data.availableTags} bind:selected={editTagIds} name="tagIds" placeholder="Select tags…" />
              <input class="auth-field" type="text" name="customTag" placeholder="New custom tag (optional)" />
              <button type="submit" class="auth-btn w-fit">Save tags</button>
            </form>
          {/if}
        </li>
      {/each}
    {/if}
  </ul>
</section>
