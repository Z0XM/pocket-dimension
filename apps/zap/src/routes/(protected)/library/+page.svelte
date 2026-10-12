<script lang="ts">
  import { enhance } from "$app/forms";
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import BusyStatus from "$lib/components/BusyStatus.svelte";
  import StartSessionButton from "$lib/components/StartSessionButton.svelte";
  import TagMultiSelect from "$lib/components/TagMultiSelect.svelte";
  import TrackRow, { type TrackItem } from "$lib/components/TrackRow.svelte";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  type LibraryTab = "browse" | "upload";
  type YtPhase = "idle" | "linking" | "loading" | "importing" | "disconnecting";

  let tab = $state<LibraryTab>(page.url.searchParams.get("tab") === "upload" ? "upload" : "browse");
  let scope = $state<"all" | "yours">("all");
  let q = $state("");
  let selected = $state<string[]>([]);
  let uploadTagIds = $state<string[]>([]);
  let ingestUrl = $state("");
  let ingestBusy = $state(false);
  let uploadBusy = $state(false);
  let ytLinked = $state(false);
  let ytPlaylists = $state<{ id: string; title: string; itemCount: number | null }[]>([]);
  let ytSelected = $state<string[]>([]);
  let ytPhase = $state<YtPhase>("idle");
  let ytError = $state<string | null>(null);
  const ytBusy = $derived(ytPhase !== "idle");
  const addBusy = $derived(uploadBusy || ingestBusy || ytBusy);
  let ytImportSummary = $state<{
    imported: number;
    skipped: number;
    failed: number;
    errorMessage?: string | null;
    failures?: { title?: string | null; reason: string }[];
  } | null>(null);

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
    ytLinked = data.youtubeLinked;
  });

  function startYoutubeLink(event: MouseEvent) {
    if (addBusy) {
      event.preventDefault();
      return;
    }
    ytPhase = "linking";
    ytError = null;
  }

  async function loadYtPlaylists() {
    ytError = null;
    ytPhase = "loading";
    try {
      const res = await fetch("/api/youtube/playlists", { credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Failed (${res.status})`);
      ytPlaylists = body.playlists ?? [];
    } catch (err) {
      ytError = err instanceof Error ? err.message : "Could not load playlists";
    } finally {
      ytPhase = "idle";
    }
  }

  async function disconnectYoutube() {
    ytPhase = "disconnecting";
    ytError = null;
    try {
      const res = await fetch("/api/me/youtube-link", { method: "DELETE", credentials: "same-origin" });
      if (!res.ok) throw new Error("Disconnect failed");
      ytLinked = false;
      ytPlaylists = [];
      ytSelected = [];
    } catch (err) {
      ytError = err instanceof Error ? err.message : "Disconnect failed";
    } finally {
      ytPhase = "idle";
    }
  }

  function toggleYtPlaylist(id: string) {
    if (ytBusy) return;
    ytSelected = ytSelected.includes(id) ? ytSelected.filter((x) => x !== id) : [...ytSelected, id];
  }

  async function importSelectedPlaylists() {
    if (ytSelected.length === 0 || ytBusy) return;
    ytPhase = "importing";
    ytError = null;
    ytImportSummary = null;
    try {
      const res = await fetch("/api/youtube/import", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ playlistIds: ytSelected }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Import failed (${res.status})`);
      ytImportSummary = {
        imported: body.imported ?? 0,
        skipped: body.skipped ?? 0,
        failed: body.failed ?? 0,
        errorMessage: body.errorMessage ?? null,
        failures: body.failures ?? [],
      };
      if ((body.failed ?? 0) > 0 && (body.errorMessage || body.message)) {
        ytError = body.errorMessage ?? body.message;
      }
      tab = "browse";
      void fetchPage({ reset: true });
    } catch (err) {
      ytError = err instanceof Error ? err.message : "Import failed";
    } finally {
      ytPhase = "idle";
    }
  }

  // After a successful upload action, land on Browse with refreshed list
  $effect(() => {
    if (form?.uploadOk) {
      tab = "browse";
    }
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
    if (tab === "upload") params.set("tab", "upload");
    if (scope === "yours") params.set("scope", "yours");
    if (q.trim()) params.set("q", q.trim());
    for (const id of selected) params.append("tag", id);
    const qs = params.toString();
    const href = qs ? `${page.url.pathname}?${qs}` : page.url.pathname;
    replaceState(href, {});
  }

  function setTab(next: LibraryTab) {
    if (tab === next) return;
    tab = next;
    updateUrl();
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
    if (tab !== "browse" || !sentinel) return;
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

<audio bind:this={audioEl} preload="auto" class="hidden"></audio>

<section class="space-y-6">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="text-3xl font-semibold tracking-tight">Library</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Browse the catalogue, or open <span class="font-mono text-signal">Add</span> for upload / URL / YouTube. Tag filters use
        <span class="font-mono text-signal">AND</span>.
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <StartSessionButton />
      <a href="/join" class="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/60">Join</a>
      <button
        type="button"
        class="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/60"
        onclick={() => setTab("upload")}
      >
        Add music
      </button>
    </div>
  </div>

  <div class="flex gap-1 rounded-lg border border-border/70 bg-card/40 p-1" role="tablist" aria-label="Library sections">
    <button
      type="button"
      role="tab"
      id="tab-browse"
      aria-controls="panel-browse"
      aria-selected={tab === "browse"}
      class={`flex-1 rounded-md px-4 py-2.5 font-mono text-xs tracking-[0.18em] uppercase transition ${
        tab === "browse"
          ? "bg-primary text-primary-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--signal)_35%,transparent)]"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      }`}
      onclick={() => setTab("browse")}
    >
      Browse
    </button>
    <button
      type="button"
      role="tab"
      id="tab-upload"
      aria-controls="panel-upload"
      aria-selected={tab === "upload"}
      class={`flex-1 rounded-md px-4 py-2.5 font-mono text-xs tracking-[0.18em] uppercase transition ${
        tab === "upload"
          ? "bg-primary text-primary-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--signal)_35%,transparent)]"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      }`}
      onclick={() => setTab("upload")}
    >
      Add
    </button>
  </div>

  {#if tab === "browse"}
    <div class="space-y-4" role="tabpanel" id="panel-browse" aria-labelledby="tab-browse">
      <p class="text-sm text-muted-foreground">
        Search and tag chips apply as you go. Scroll for more. Sessions play from this catalogue — Discord attaches inside a session.
      </p>

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
          <li class="px-4 py-10 text-center text-sm text-muted-foreground">No tracks match. Open Add or clear filters.</li>
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
    </div>
  {:else}
    <div class="relative z-10 space-y-4 overflow-visible" role="tabpanel" id="panel-upload" aria-labelledby="tab-upload">
      <p class="text-sm text-muted-foreground">
        Add to the shared Zap catalogue (max 10 minutes per track). Connect YouTube for your playlists, paste a public URL, or upload a file.
      </p>

      <div class="overflow-visible rounded-lg border border-border/70 bg-card/40 p-4">
        {#if !data.storageReady}
          <p class="text-sm text-muted-foreground">
            Configure R2 env to enable uploads/URL ingest. Use account endpoint
            <span class="font-mono text-signal">https://&lt;ACCOUNT_ID&gt;.r2.cloudflarestorage.com</span>,
            <span class="font-mono">S3_ACCESS_KEY</span> / <span class="font-mono">S3_SECRET_KEY</span>,
            <span class="font-mono">S3_BUCKET</span>, <span class="font-mono">S3_REGION=auto</span>.
          </p>
        {:else if data.storageInfo.configured}
          <p class="font-mono text-[11px] text-muted-foreground">
            R2 ready · {data.storageInfo.bucket} · {data.storageInfo.endpoint}
            {#if data.ytDlpReady}
              · yt-dlp ready
            {:else}
              · yt-dlp missing (URL ingest disabled)
            {/if}
          </p>
        {/if}

        <h2 class="mt-4 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Connect YouTube</h2>
        {#if !data.youtubeOauthConfigured}
          <div class="mt-2 space-y-2 rounded border border-border/60 bg-background/30 p-3">
            <button type="button" class="auth-btn opacity-50" disabled title="Google OAuth not configured">Connect YouTube</button>
            <p class="text-sm text-muted-foreground">
              Set <span class="font-mono text-signal">GOOGLE_CLIENT_ID</span> /
              <span class="font-mono text-signal">GOOGLE_CLIENT_SECRET</span> (redirect
              <span class="font-mono">/api/auth/youtube/callback</span>) to enable. Optional:
              <span class="font-mono">YOUTUBE_TOKEN_SECRET</span> (else <span class="font-mono">BETTER_AUTH_SECRET</span>).
            </p>
          </div>
        {:else if !ytLinked}
          <p class="mt-2 text-sm text-muted-foreground">Link your Google account to import private playlists and Liked videos.</p>
          <a
            class="auth-btn mt-2 inline-flex w-fit {ytPhase === 'linking' ? 'pointer-events-none opacity-70' : ''}"
            href="/api/auth/youtube/start?returnTo=/library?tab=upload"
            aria-busy={ytPhase === "linking"}
            onclick={startYoutubeLink}
          >
            {ytPhase === "linking" ? "Redirecting to Google…" : "Connect YouTube"}
          </a>
          {#if ytPhase === "linking"}
            <BusyStatus label="Opening Google OAuth…" detail="Complete consent, then you’ll return here." />
          {/if}
        {:else}
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <p class="font-mono text-[11px] text-signal">
              Connected{#if data.youtubeLinkedAt}
                · {new Date(data.youtubeLinkedAt).toLocaleDateString()}{/if}
            </p>
            <button
              type="button"
              class="rounded border border-border px-2 py-1 font-mono text-[10px]"
              disabled={ytBusy || uploadBusy || ingestBusy}
              onclick={() => void loadYtPlaylists()}
            >
              {ytPhase === "loading" ? "Loading…" : ytPlaylists.length ? "Refresh playlists" : "Load playlists"}
            </button>
            <button
              type="button"
              class="rounded border border-border px-2 py-1 font-mono text-[10px] text-destructive"
              disabled={ytBusy || uploadBusy || ingestBusy}
              onclick={() => void disconnectYoutube()}
            >
              {ytPhase === "disconnecting" ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
          {#if ytPhase === "loading"}
            <BusyStatus label="Loading playlists…" detail="Fetching from your connected Google account." />
          {:else if ytPhase === "importing"}
            <BusyStatus
              label="Importing from YouTube…"
              detail={`${ytSelected.length} playlist${ytSelected.length === 1 ? "" : "s"} · yt-dlp + R2 (can take a minute)`}
            />
          {:else if ytPhase === "disconnecting"}
            <BusyStatus label="Disconnecting YouTube…" />
          {/if}
          {#if ytError}
            <p class="auth-error mt-2">{ytError}</p>
          {/if}
          {#if ytImportSummary}
            <p class="mt-2 text-sm text-signal">
              Import done — imported {ytImportSummary.imported}, skipped {ytImportSummary.skipped}, failed {ytImportSummary.failed}.
            </p>
            {#if ytImportSummary.errorMessage}
              <p class="auth-error mt-2">{ytImportSummary.errorMessage}</p>
            {/if}
            {#if ytImportSummary.failures && ytImportSummary.failures.length > 0}
              <ul class="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
                {#each ytImportSummary.failures.slice(0, 5) as f}
                  <li>
                    {#if f.title}<span class="text-foreground">{f.title}</span> —
                    {/if}{f.reason}
                  </li>
                {/each}
              </ul>
            {/if}
          {/if}
          {#if ytPlaylists.length > 0}
            <ul class="mt-3 max-h-56 space-y-1 overflow-y-auto rounded border border-border/60 p-2 {ytBusy ? 'pointer-events-none opacity-60' : ''}">
              {#each ytPlaylists as pl}
                <li>
                  <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-secondary/40">
                    <input
                      class="zap-checkbox"
                      type="checkbox"
                      checked={ytSelected.includes(pl.id)}
                      disabled={ytBusy}
                      onchange={() => toggleYtPlaylist(pl.id)}
                    />
                    <span class="min-w-0 flex-1 truncate text-sm">{pl.title}</span>
                    {#if pl.itemCount != null}
                      <span class="font-mono text-[10px] text-muted-foreground">{pl.itemCount}</span>
                    {/if}
                  </label>
                </li>
              {/each}
            </ul>
            <button
              type="button"
              class="auth-btn mt-2"
              disabled={ytBusy || uploadBusy || ingestBusy || ytSelected.length === 0 || !data.ingestReady}
              onclick={() => void importSelectedPlaylists()}
            >
              {ytPhase === "importing" ? "Importing…" : `Import selected (${ytSelected.length})`}
            </button>
          {/if}
        {/if}

        <h2 class="mt-6 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Public URL</h2>
        {#if form?.ingestError}
          <p class="auth-error mt-2">{form.ingestError}</p>
        {/if}
        {#if form?.ingestOk && form.ingestSummary}
          <p class="mt-2 text-sm text-signal">
            Sync done — imported {form.ingestSummary.imported}, skipped {form.ingestSummary.skipped}, failed {form.ingestSummary.failed}.
          </p>
          {#if form.ingestSummary.errorMessage}
            <p class="auth-error mt-2">{form.ingestSummary.errorMessage}</p>
          {/if}
          {#if form.ingestSummary.failures?.length}
            <ul class="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
              {#each form.ingestSummary.failures as f}
                <li>
                  {#if f.title}<span class="text-foreground">{f.title}</span> —
                  {/if}{f.reason}
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
        <form
          method="POST"
          action="?/ingestUrl"
          class="mt-2 space-y-3"
          use:enhance={({ cancel }) => {
            if (uploadBusy || ytBusy || ingestBusy) {
              cancel();
              return;
            }
            ingestBusy = true;
            return async ({ result, update }) => {
              try {
                await update();
                if (result.type === "success") {
                  ingestUrl = "";
                  tab = "browse";
                  void fetchPage({ reset: true });
                }
              } finally {
                ingestBusy = false;
              }
            };
          }}
        >
          <input
            class="auth-field"
            type="url"
            name="url"
            placeholder="https://www.youtube.com/watch?v=… or playlist URL"
            bind:value={ingestUrl}
            required
            disabled={!data.ingestReady || ingestBusy || uploadBusy || ytBusy}
          />
          <button type="submit" class="auth-btn" disabled={!data.ingestReady || ingestBusy || uploadBusy || ytBusy}>
            {ingestBusy ? "Importing…" : "Import URL"}
          </button>
          {#if ingestBusy}
            <BusyStatus label="Importing URL…" detail="yt-dlp probe + download · R2 upload" />
          {/if}
          {#if !data.ingestReady}
            <p class="text-sm text-muted-foreground">
              Needs R2 (<span class="font-mono text-signal">S3_*</span>) and
              <span class="font-mono text-signal">yt-dlp</span> on the Zap host
              {#if data.storageReady && !data.ytDlpReady}
                — yt-dlp missing
              {:else if !data.storageReady}
                — storage not configured
              {/if}.
            </p>
          {/if}
        </form>

        <h2 class="mt-6 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">File upload</h2>
        {#if form?.uploadError}
          <p class="auth-error mt-2">{form.uploadError}</p>
        {/if}
        {#if form?.uploadOk}
          <p class="mt-2 text-sm text-signal">Added to catalogue.</p>
        {/if}
        <form
          method="POST"
          action="?/upload"
          enctype="multipart/form-data"
          class="mt-2 space-y-3"
          use:enhance={({ cancel }) => {
            if (uploadBusy || ingestBusy || ytBusy) {
              cancel();
              return;
            }
            uploadBusy = true;
            return async ({ result, update }) => {
              try {
                await update();
                uploadTagIds = [];
                if (result.type === "success") {
                  tab = "browse";
                  void fetchPage({ reset: true });
                }
              } finally {
                uploadBusy = false;
              }
            };
          }}
        >
          <input class="auth-field" type="text" name="title" placeholder="Title (optional)" disabled={uploadBusy || ingestBusy || ytBusy} />
          <input
            class="auth-field"
            type="file"
            name="file"
            accept="audio/*"
            required
            disabled={!data.storageReady || uploadBusy || ingestBusy || ytBusy}
          />
          <div class={uploadBusy || ingestBusy || ytBusy ? "pointer-events-none opacity-60" : ""}>
            <p class="mb-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Tags (many allowed)</p>
            <TagMultiSelect options={data.availableTags} bind:selected={uploadTagIds} name="tagIds" placeholder="Select tags…" />
          </div>
          <input
            class="auth-field"
            type="text"
            name="customTag"
            placeholder="New custom tag (optional)"
            disabled={uploadBusy || ingestBusy || ytBusy}
          />
          <button type="submit" class="auth-btn" disabled={!data.storageReady || uploadBusy || ingestBusy || ytBusy}>
            {uploadBusy ? "Uploading…" : "Upload to Zap"}
          </button>
          {#if uploadBusy}
            <BusyStatus label="Uploading to Zap…" detail="Hashing file · writing to R2 · updating catalogue" />
          {/if}
        </form>
      </div>
    </div>
  {/if}
</section>
