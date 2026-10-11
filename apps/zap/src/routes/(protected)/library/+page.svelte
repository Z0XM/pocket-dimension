<script lang="ts">
  import { enhance } from "$app/forms";
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import TagMultiSelect from "$lib/components/TagMultiSelect.svelte";
  import TrackRow, { type TrackItem } from "$lib/components/TrackRow.svelte";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let scope = $state<"all" | "yours">("all");
  let q = $state("");
  let selected = $state<string[]>([]);
  let uploadTagIds = $state<string[]>([]);

  let assets = $state<TrackItem[]>([]);
  let hasMore = $state(false);
  let nextOffset = $state(0);
  let loading = $state(false);
  let loadingMore = $state(false);
  let listError = $state<string | null>(null);

  let activeId = $state<string | null>(null);
  let audioEl = $state<HTMLAudioElement | null>(null);
  let sentinel = $state<HTMLDivElement | null>(null);

  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let fetchGen = 0;
  let hydratedKey = $state("");

  $effect(() => {
    const key = `${data.scope}|${data.q}|${data.selectedTagIds.join(",")}|${data.nextOffset}|${data.assets.map((a) => a.id).join(",")}`;
    if (key === hydratedKey) return;
    hydratedKey = key;
    scope = data.scope === "yours" ? "yours" : "all";
    q = data.q;
    selected = [...data.selectedTagIds];
    assets = data.assets.map((a) => ({ ...a, playable: Boolean(a.playable) }));
    hasMore = data.hasMore;
    nextOffset = data.nextOffset;
  });

  function buildParams(offset = 0) {
    const params = new URLSearchParams();
    if (scope === "yours") params.set("scope", "yours");
    if (q.trim()) params.set("q", q.trim());
    for (const id of selected) params.append("tag", id);
    if (offset > 0) params.set("offset", String(offset));
    params.set("limit", String(data.pageSize));
    return params;
  }

  function updateUrl() {
    const params = new URLSearchParams();
    if (scope === "yours") params.set("scope", "yours");
    if (q.trim()) params.set("q", q.trim());
    for (const id of selected) params.append("tag", id);
    const qs = params.toString();
    const href = qs ? `${page.url.pathname}?${qs}` : page.url.pathname;
    replaceState(href, {});
  }

  async function fetchPage(opts: { reset: boolean }) {
    const gen = ++fetchGen;
    if (opts.reset) {
      loading = true;
      listError = null;
    } else {
      loadingMore = true;
    }

    try {
      const offset = opts.reset ? 0 : nextOffset;
      const params = buildParams(offset);
      const res = await fetch(`/api/catalogue?${params.toString()}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Browse failed (${res.status})`);
      const body = (await res.json()) as {
        assets: TrackItem[];
        hasMore: boolean;
        nextOffset: number;
      };
      if (gen !== fetchGen) return;
      assets = opts.reset ? body.assets : [...assets, ...body.assets];
      hasMore = body.hasMore;
      nextOffset = body.nextOffset;
      if (opts.reset) updateUrl();
    } catch (err) {
      if (gen !== fetchGen) return;
      listError = err instanceof Error ? err.message : "Browse failed";
    } finally {
      if (gen === fetchGen) {
        loading = false;
        loadingMore = false;
      }
    }
  }

  function onSearchInput() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      void fetchPage({ reset: true });
    }, 280);
  }

  function onScope(next: "all" | "yours") {
    if (scope === next) return;
    scope = next;
    void fetchPage({ reset: true });
  }

  function toggleTag(id: string) {
    selected = selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id];
    void fetchPage({ reset: true });
  }

  $effect(() => {
    if (!sentinel) return;
    const el = sentinel;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasMore && !loading && !loadingMore) {
          void fetchPage({ reset: false });
        }
      },
      { rootMargin: "240px" }
    );
    io.observe(el);
    return () => io.disconnect();
  });
</script>

<audio bind:this={audioEl} preload="metadata" class="hidden"></audio>

<section class="space-y-10">
  <div>
    <h1 class="text-3xl font-semibold tracking-tight">Library</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Browse the Zap catalogue, or upload into it. Tag filters use <span class="font-mono text-signal">AND</span>.
    </p>
  </div>

  <!-- Browse -->
  <section class="space-y-4" aria-labelledby="browse-heading">
    <div class="flex items-end justify-between gap-3">
      <div>
        <h2 id="browse-heading" class="font-mono text-xs tracking-[0.2em] text-signal uppercase">Browse</h2>
        <p class="mt-1 text-sm text-muted-foreground">Search and tag chips apply as you go. Scroll for more.</p>
      </div>
    </div>

    <div class="flex flex-col gap-4 rounded-lg border border-border/70 bg-card/50 p-4">
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class={`rounded px-3 py-1.5 font-mono text-xs ${scope === "all" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
          onclick={() => onScope("all")}
        >
          All
        </button>
        <button
          type="button"
          class={`rounded px-3 py-1.5 font-mono text-xs ${scope === "yours" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
          onclick={() => onScope("yours")}
        >
          Your library
        </button>
      </div>

      <input class="auth-field" type="search" placeholder="Search title or artists…" bind:value={q} oninput={onSearchInput} autocomplete="off" />

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
    </div>

    {#if form?.tagError}
      <p class="auth-error">{form.tagError}</p>
    {/if}
    {#if form?.tagOk}
      <p class="text-sm text-signal">Tags updated.</p>
    {/if}
    {#if listError}
      <p class="auth-error">{listError}</p>
    {/if}

    <ul class="divide-y divide-border/50 rounded-lg border border-border/70 bg-card/30">
      {#if loading && assets.length === 0}
        <li class="px-4 py-10 text-center font-mono text-xs text-muted-foreground">Scanning catalogue…</li>
      {:else if assets.length === 0}
        <li class="px-4 py-10 text-center text-sm text-muted-foreground">No tracks match. Upload below or clear filters.</li>
      {:else}
        {#each assets as track (track.id)}
          <TrackRow {track} availableTags={data.availableTags} bind:activeId bind:audioEl />
        {/each}
      {/if}
    </ul>

    <div bind:this={sentinel} class="h-8" aria-hidden="true"></div>
    {#if loadingMore}
      <p class="text-center font-mono text-[11px] text-muted-foreground">Loading more…</p>
    {:else if !hasMore && assets.length > 0}
      <p class="text-center font-mono text-[11px] text-muted-foreground">End of catalogue</p>
    {/if}
  </section>

  <!-- Upload -->
  <section class="relative z-10 space-y-4 overflow-visible" aria-labelledby="upload-heading">
    <div>
      <h2 id="upload-heading" class="font-mono text-xs tracking-[0.2em] text-signal uppercase">Upload</h2>
      <p class="mt-1 text-sm text-muted-foreground">Add a track to the shared Zap catalogue (max 10 minutes).</p>
    </div>

    <div class="overflow-visible rounded-lg border border-border/70 bg-card/40 p-4">
      {#if !data.storageReady}
        <p class="text-sm text-muted-foreground">
          Configure R2 env to enable uploads. Use account endpoint
          <span class="font-mono text-signal">https://&lt;ACCOUNT_ID&gt;.r2.cloudflarestorage.com</span>,
          <span class="font-mono">S3_ACCESS_KEY</span> / <span class="font-mono">S3_SECRET_KEY</span>,
          <span class="font-mono">S3_BUCKET</span>, <span class="font-mono">S3_REGION=auto</span>.
        </p>
      {:else if data.storageInfo.configured}
        <p class="font-mono text-[11px] text-muted-foreground">
          R2 ready · {data.storageInfo.bucket} · {data.storageInfo.endpoint}
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
          return async ({ result, update }) => {
            await update();
            uploadTagIds = [];
            if (result.type === "success") {
              // Refresh browse list after upload
              void fetchPage({ reset: true });
            }
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
  </section>
</section>
