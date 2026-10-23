<script lang="ts" module>
  export type AddMusicTab = "url" | "file" | "youtube";

  export type AddMusicConfig = {
    storageReady: boolean;
    ingestReady: boolean;
    ytDlpReady: boolean;
    youtubeOauthConfigured: boolean;
    youtubeLinked: boolean;
    youtubeLinkedAt: string | null;
  };

  export function parseAddMusicTab(value: string | null): AddMusicTab {
    return value === "file" || value === "youtube" ? value : "url";
  }
</script>

<script lang="ts">
  import { goto } from "$app/navigation";
  import XIcon from "@lucide/svelte/icons/x";
  import BusyStatus from "$lib/components/BusyStatus.svelte";
  import CustomTagInput from "$lib/components/CustomTagInput.svelte";
  import SongProgressList, { type SongProgressView } from "$lib/components/SongProgressList.svelte";
  import TagMultiSelect from "$lib/components/TagMultiSelect.svelte";
  import ZapSelect from "$lib/components/ZapSelect.svelte";
  import { withDraft } from "$lib/custom-tags";
  import { xhrFormNdjson } from "$lib/ingest-client";
  import { PLAYLIST_IMPORT_SORT_OPTIONS, type PlaylistImportSort } from "$lib/youtube-playlist-sort";

  type TagOption = { id: string; name: string; kind: string };
  type YtPhase = "idle" | "linking" | "loading" | "importing" | "disconnecting";

  let {
    open = $bindable(false),
    tab = $bindable<AddMusicTab>("url"),
    config,
    availableTags,
    onadded,
  }: {
    open?: boolean;
    tab?: AddMusicTab;
    config: AddMusicConfig;
    availableTags: TagOption[];
    /** Fired after a successful ingest, just before the dialog closes. */
    onadded?: (message: string) => void;
  } = $props();

  const youtubeConnectHref = `/api/auth/youtube/start?returnTo=${encodeURIComponent("/catalogue?add=youtube")}`;
  const tabs: { id: AddMusicTab; label: string }[] = [
    { id: "url", label: "Link" },
    { id: "file", label: "File" },
    { id: "youtube", label: "YouTube" },
  ];

  let dialog = $state<HTMLDialogElement | null>(null);

  let ingestUrl = $state("");
  let ingestTagIds = $state<string[]>([]);
  let ingestCustomTags = $state<string[]>([]);
  let ingestCustomDraft = $state("");
  let ingestBusy = $state(false);
  let ingestError = $state<string | null>(null);
  let urlSongProgress = $state<SongProgressView[]>([]);

  let uploadTitle = $state("");
  let uploadFileInput = $state<HTMLInputElement | null>(null);
  let uploadTagIds = $state<string[]>([]);
  let uploadCustomTags = $state<string[]>([]);
  let uploadCustomDraft = $state("");
  let uploadBusy = $state(false);
  let uploadError = $state<string | null>(null);
  let uploadSongProgress = $state<SongProgressView[]>([]);

  let ytLinked = $state(false);
  let ytPlaylists = $state<{ id: string; title: string; itemCount: number | null }[]>([]);
  let ytSelected = $state<string[]>([]);
  let ytPhase = $state<YtPhase>("idle");
  let ytError = $state<string | null>(null);
  let ytImportTagIds = $state<string[]>([]);
  let ytImportCustomTags = $state<string[]>([]);
  let ytImportCustomDraft = $state("");
  let ytImportSort = $state<PlaylistImportSort>("playlist");
  let ytImportProgress = $state<{
    total: number;
    done: number;
    remaining: number;
    imported: number;
    unavailable: number;
    skipped: number;
    failed: number;
    songs?: SongProgressView[];
  } | null>(null);

  const ytBusy = $derived(ytPhase !== "idle");
  const addBusy = $derived(uploadBusy || ingestBusy || ytBusy);

  $effect(() => {
    ytLinked = config.youtubeLinked;
  });

  $effect(() => {
    const el = dialog;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  });

  function close() {
    if (addBusy) return;
    open = false;
  }

  function finish(message: string) {
    onadded?.(message);
    open = false;
  }

  /** Only a press that starts and ends on the backdrop closes — not a text-selection drag released outside. */
  let pressedBackdrop = false;

  function onBackdropClick(e: MouseEvent) {
    if (pressedBackdrop && e.target === dialog) close();
    pressedBackdrop = false;
  }

  async function importUrlSubmit(event: Event) {
    event.preventDefault();
    if (!ingestUrl.trim() || addBusy || !config.ingestReady) return;
    ingestBusy = true;
    ingestError = null;
    urlSongProgress = [];
    try {
      const res = await fetch("/api/ingest/url", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: ingestUrl.trim(),
          tagIds: ingestTagIds,
          customTags: withDraft(ingestCustomTags, ingestCustomDraft),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 202) throw new Error(body?.message ?? `Import failed (${res.status})`);
      ingestUrl = "";
      ingestTagIds = [];
      ingestCustomTags = [];
      ingestCustomDraft = "";
      finish("Import started — track progress under Running Jobs.");
      void goto("/jobs");
    } catch (err) {
      ingestError = err instanceof Error ? err.message : "Import failed";
    } finally {
      ingestBusy = false;
      urlSongProgress = [];
    }
  }

  async function uploadFileSubmit(event: Event) {
    event.preventDefault();
    if (addBusy || !config.storageReady) return;
    const file = uploadFileInput?.files?.[0];
    if (!file) {
      uploadError = "Choose an audio file.";
      return;
    }
    const displayTitle = uploadTitle || file.name;
    uploadBusy = true;
    uploadError = null;
    uploadSongProgress = [{ identityKey: "upload:local", title: displayTitle, phase: "downloading", percent: 0 }];
    try {
      const formData = new FormData();
      formData.set("file", file);
      if (uploadTitle.trim()) formData.set("title", uploadTitle.trim());
      for (const id of uploadTagIds) formData.append("tagIds", id);
      for (const name of withDraft(uploadCustomTags, uploadCustomDraft)) formData.append("customTags", name);

      let addedTitle: string | null = null;
      await xhrFormNdjson(
        "/api/ingest/upload",
        formData,
        (percent) => {
          uploadSongProgress = [{ identityKey: "upload:local", title: displayTitle, phase: "downloading", percent }];
        },
        (ev) => {
          if (ev.type === "song") {
            uploadSongProgress = [
              {
                identityKey: typeof ev.identityKey === "string" ? ev.identityKey : "upload",
                title: typeof ev.title === "string" ? ev.title : file.name,
                phase: String(ev.phase ?? "uploading"),
                percent: Number(ev.percent ?? 0),
              },
            ];
          } else if (ev.type === "done") {
            addedTitle = typeof ev.title === "string" ? ev.title : displayTitle;
          } else if (ev.type === "error") {
            throw new Error(typeof ev.message === "string" ? ev.message : "Upload failed");
          }
        }
      );
      if (!addedTitle) throw new Error("Upload ended without a result");
      uploadTagIds = [];
      uploadCustomTags = [];
      uploadCustomDraft = "";
      uploadTitle = "";
      if (uploadFileInput) uploadFileInput.value = "";
      finish(`Added “${addedTitle}” to the catalogue.`);
    } catch (err) {
      uploadError = err instanceof Error ? err.message : "Upload failed";
    } finally {
      uploadBusy = false;
      uploadSongProgress = [];
    }
  }

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
    if (ytSelected.length === 0 || addBusy || !config.ingestReady) return;
    ytPhase = "importing";
    ytError = null;
    ytImportProgress = null;
    try {
      const res = await fetch("/api/youtube/import", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistIds: ytSelected,
          tagIds: ytImportTagIds,
          customTags: withDraft(ytImportCustomTags, ytImportCustomDraft),
          sort: ytImportSort,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 202) throw new Error(body?.message ?? `Import failed (${res.status})`);
      ytSelected = [];
      ytImportTagIds = [];
      ytImportCustomTags = [];
      ytImportCustomDraft = "";
      finish("YouTube import started — track progress under Running Jobs.");
      void goto("/jobs");
    } catch (err) {
      ytError = err instanceof Error ? err.message : "Import failed";
    } finally {
      ytPhase = "idle";
      ytImportProgress = null;
    }
  }
</script>

<!-- Backdrop click closes; Escape is handled natively by <dialog>. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialog}
  class="zap-dialog m-auto max-h-[min(calc(100dvh-2rem),46rem)] w-[min(calc(100%-2rem),34rem)] overflow-hidden rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-background/80 open:flex open:flex-col"
  aria-labelledby="add-music-title"
  onpointerdown={(e) => (pressedBackdrop = e.target === dialog)}
  onclick={onBackdropClick}
  onclose={() => {
    open = false;
  }}
  oncancel={(e) => {
    if (addBusy) e.preventDefault();
  }}
>
  <div class="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-5 pt-4 pb-3">
    <div class="min-w-0">
      <h2 id="add-music-title" class="text-lg font-semibold tracking-tight">Add music</h2>
      <p class="mt-0.5 font-mono text-[11px] text-muted-foreground">
        Shared catalogue · max 10 min per track
        {#if config.storageReady}
          · R2 ready · {config.ytDlpReady ? "yt-dlp ready" : "yt-dlp missing"}
        {/if}
      </p>
    </div>
    <button
      type="button"
      class="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
      aria-label="Close"
      disabled={addBusy}
      onclick={close}
    >
      <XIcon class="size-4" />
    </button>
  </div>

  <div class="flex shrink-0 gap-1 border-b border-border/60 px-5 py-2" role="tablist" aria-label="Add source">
    {#each tabs as t (t.id)}
      <button
        type="button"
        role="tab"
        id={`add-tab-${t.id}`}
        aria-selected={tab === t.id}
        aria-controls={`add-panel-${t.id}`}
        class={`rounded px-3 py-1.5 font-mono text-xs ${tab === t.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-signal"}`}
        onclick={() => (tab = t.id)}
      >
        {t.label}
      </button>
    {/each}
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
    {#if !config.storageReady}
      <p class="mb-3 rounded border border-border/60 bg-background/30 p-3 text-sm text-muted-foreground">
        Configure R2 env to enable uploads/URL ingest. Use account endpoint
        <span class="font-mono text-signal">https://&lt;ACCOUNT_ID&gt;.r2.cloudflarestorage.com</span>,
        <span class="font-mono">S3_ACCESS_KEY</span> / <span class="font-mono">S3_SECRET_KEY</span>,
        <span class="font-mono">S3_BUCKET</span>, <span class="font-mono">S3_REGION=auto</span>.
      </p>
    {/if}

    <div id="add-panel-url" role="tabpanel" aria-labelledby="add-tab-url" hidden={tab !== "url"}>
      <form class="space-y-3" onsubmit={(e) => void importUrlSubmit(e)}>
        <input
          class="auth-field"
          type="url"
          name="url"
          placeholder="https://www.youtube.com/watch?v=… or playlist URL"
          bind:value={ingestUrl}
          required
          disabled={!config.ingestReady || addBusy}
        />
        <div class="space-y-2 {!config.ingestReady || addBusy ? 'pointer-events-none opacity-60' : ''}">
          <p class="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Tags (many allowed)</p>
          <TagMultiSelect options={availableTags} bind:selected={ingestTagIds} name="ingestTagIds" placeholder="Select tags…" />
          <CustomTagInput bind:tags={ingestCustomTags} bind:draft={ingestCustomDraft} name="ingestCustomTags" />
        </div>
        {#if ingestError}
          <p class="auth-error mb-0">{ingestError}</p>
        {/if}
        <button type="submit" class="auth-btn" disabled={!config.ingestReady || addBusy}>
          {ingestBusy ? "Importing…" : "Import link"}
        </button>
        {#if ingestBusy}
          <BusyStatus label="Importing link…" detail="Download then upload to R2" />
          <SongProgressList songs={urlSongProgress} />
        {/if}
        {#if !config.ingestReady}
          <p class="text-sm text-muted-foreground">
            Needs R2 (<span class="font-mono text-signal">S3_*</span>) and
            <span class="font-mono text-signal">yt-dlp</span> on the Zap host
            {#if config.storageReady && !config.ytDlpReady}
              — yt-dlp missing
            {:else if !config.storageReady}
              — storage not configured
            {/if}.
          </p>
        {/if}
      </form>
    </div>
    <div id="add-panel-file" role="tabpanel" aria-labelledby="add-tab-file" hidden={tab !== "file"}>
      <form class="space-y-3" enctype="multipart/form-data" onsubmit={(e) => void uploadFileSubmit(e)}>
        <input
          class="auth-field file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:font-mono file:text-xs file:text-secondary-foreground"
          type="file"
          name="file"
          accept="audio/*"
          required
          bind:this={uploadFileInput}
          disabled={!config.storageReady || addBusy}
        />
        <input class="auth-field" type="text" name="title" placeholder="Title (optional)" bind:value={uploadTitle} disabled={addBusy} />
        <div class="space-y-2 {addBusy ? 'pointer-events-none opacity-60' : ''}">
          <p class="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Tags (many allowed)</p>
          <TagMultiSelect options={availableTags} bind:selected={uploadTagIds} name="tagIds" placeholder="Select tags…" />
          <CustomTagInput bind:tags={uploadCustomTags} bind:draft={uploadCustomDraft} />
        </div>
        {#if uploadError}
          <p class="auth-error mb-0">{uploadError}</p>
        {/if}
        <button type="submit" class="auth-btn" disabled={!config.storageReady || addBusy}>
          {uploadBusy ? "Uploading…" : "Upload to Zap"}
        </button>
        {#if uploadBusy}
          <BusyStatus label="Uploading to Zap…" detail="Sending file, then storing on R2" />
          <SongProgressList songs={uploadSongProgress} sendingLabel="Sending" />
        {/if}
      </form>
    </div>
    <div id="add-panel-youtube" role="tabpanel" aria-labelledby="add-tab-youtube" class="space-y-3" hidden={tab !== "youtube"}>
      {#if !config.youtubeOauthConfigured}
        <div class="space-y-2 rounded border border-border/60 bg-background/30 p-3">
          <button type="button" class="auth-btn opacity-50" disabled title="Google OAuth not configured">Connect YouTube</button>
          <p class="text-sm text-muted-foreground">
            Set <span class="font-mono text-signal">GOOGLE_CLIENT_ID</span> /
            <span class="font-mono text-signal">GOOGLE_CLIENT_SECRET</span> (redirect
            <span class="font-mono">/api/auth/youtube/callback</span>) to enable. Optional:
            <span class="font-mono">YOUTUBE_TOKEN_SECRET</span> (else <span class="font-mono">BETTER_AUTH_SECRET</span>).
          </p>
        </div>
      {:else if !ytLinked}
        <p class="text-sm text-muted-foreground">Link your Google account to import private playlists and Liked videos.</p>
        <a
          class="auth-btn inline-flex w-fit {ytPhase === 'linking' ? 'pointer-events-none opacity-70' : ''}"
          href={youtubeConnectHref}
          aria-busy={ytPhase === "linking"}
          onclick={startYoutubeLink}
        >
          {ytPhase === "linking" ? "Redirecting to Google…" : "Connect YouTube"}
        </a>
        {#if ytPhase === "linking"}
          <BusyStatus label="Opening Google OAuth…" detail="Complete consent, then you’ll return to the catalogue." />
        {/if}
      {:else}
        <div class="flex flex-wrap items-center gap-2">
          <p class="font-mono text-[11px] text-signal">
            Connected{#if config.youtubeLinkedAt}
              · {new Date(config.youtubeLinkedAt).toLocaleDateString()}{/if}
          </p>
          <button
            type="button"
            class="rounded border border-border px-2 py-1 font-mono text-[10px] disabled:opacity-40"
            disabled={addBusy}
            onclick={() => void loadYtPlaylists()}
          >
            {ytPhase === "loading" ? "Loading…" : ytPlaylists.length ? "Refresh playlists" : "Load playlists"}
          </button>
          <button
            type="button"
            class="rounded border border-border px-2 py-1 font-mono text-[10px] text-destructive disabled:opacity-40"
            disabled={addBusy}
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
            detail={ytImportProgress && ytImportProgress.total > 0
              ? `${ytImportProgress.done}/${ytImportProgress.total} done · ${ytImportProgress.imported} ok · ${ytImportProgress.unavailable} not available · ${ytImportProgress.skipped} skipped · ${ytImportProgress.failed} failed · ${ytImportProgress.remaining} left`
              : `${ytSelected.length} playlist${ytSelected.length === 1 ? "" : "s"} · expanding & downloading in parallel…`}
          />
          <SongProgressList songs={ytImportProgress?.songs ?? []} />
        {:else if ytPhase === "disconnecting"}
          <BusyStatus label="Disconnecting YouTube…" />
        {/if}
        {#if ytError}
          <p class="auth-error mb-0">{ytError}</p>
        {/if}
        {#if ytPlaylists.length > 0}
          <ul class="max-h-48 space-y-1 overflow-y-auto rounded border border-border/60 p-2 {ytBusy ? 'pointer-events-none opacity-60' : ''}">
            {#each ytPlaylists as pl (pl.id)}
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
          {#if ytSelected.length > 0}
            <div class="space-y-2 rounded border border-border/60 bg-background/30 p-3 {ytBusy ? 'pointer-events-none opacity-60' : ''}">
              <p class="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Import options</p>
              <ZapSelect
                options={PLAYLIST_IMPORT_SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                bind:value={ytImportSort}
                disabled={ytBusy}
                placeholder="Sort order"
              />
              <TagMultiSelect options={availableTags} bind:selected={ytImportTagIds} name="ytImportTagIds" placeholder="Tags for every track…" />
              <CustomTagInput bind:tags={ytImportCustomTags} bind:draft={ytImportCustomDraft} name="ytImportCustomTags" disabled={ytBusy} />
            </div>
          {/if}
          <button
            type="button"
            class="auth-btn"
            disabled={addBusy || ytSelected.length === 0 || !config.ingestReady}
            onclick={() => void importSelectedPlaylists()}
          >
            {ytPhase === "importing" ? "Importing…" : `Import selected (${ytSelected.length})`}
          </button>
        {/if}
      {/if}
    </div>
  </div>
</dialog>
