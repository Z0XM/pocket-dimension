<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import BusyStatus from "$lib/components/BusyStatus.svelte";
  import SongProgressList, { type SongProgressView } from "$lib/components/SongProgressList.svelte";
  import TagMultiSelect from "$lib/components/TagMultiSelect.svelte";
  import ZapSelect from "$lib/components/ZapSelect.svelte";
  import { PLAYLIST_IMPORT_SORT_OPTIONS, type PlaylistImportSort } from "$lib/youtube-playlist-sort";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  type YtPhase = "idle" | "linking" | "loading" | "importing" | "disconnecting";

  let uploadTagIds = $state<string[]>([]);
  let uploadCustomTag = $state("");
  let uploadTitle = $state("");
  let uploadFileInput = $state<HTMLInputElement | null>(null);
  let ingestUrl = $state("");
  let ingestBusy = $state(false);
  let uploadBusy = $state(false);
  let ytLinked = $state(false);
  let ytPlaylists = $state<{ id: string; title: string; itemCount: number | null }[]>([]);
  let ytSelected = $state<string[]>([]);
  let ytPhase = $state<YtPhase>("idle");
  let ytError = $state<string | null>(null);
  let ytTagPromptOpen = $state(false);
  let ytImportTagIds = $state<string[]>([]);
  let ytImportCustomTag = $state("");
  let ytImportSort = $state<PlaylistImportSort>("playlist");
  let ytTagDialog = $state<HTMLDialogElement | null>(null);
  const ytBusy = $derived(ytPhase !== "idle");
  const addBusy = $derived(uploadBusy || ingestBusy || ytBusy);
  let ytImportSummary = $state<{
    imported: number;
    skipped: number;
    failed: number;
    errorMessage?: string | null;
    failures?: { title?: string | null; reason: string }[];
  } | null>(null);
  let ytImportProgress = $state<{
    total: number;
    done: number;
    remaining: number;
    imported: number;
    skipped: number;
    failed: number;
    currentTitle?: string | null;
    songs?: SongProgressView[];
  } | null>(null);
  let urlSongProgress = $state<SongProgressView[]>([]);
  let uploadSongProgress = $state<SongProgressView[]>([]);
  let uploadError = $state<string | null>(null);
  let ingestError = $state<string | null>(null);

  $effect(() => {
    ytLinked = data.youtubeLinked;
  });

  async function readNdjsonStream(res: Response, onEvent: (ev: Record<string, unknown>) => void): Promise<void> {
    if (!res.body) throw new Error("Response stream missing");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        onEvent(JSON.parse(line) as Record<string, unknown>);
      }
    }
    if (buffer.trim()) onEvent(JSON.parse(buffer) as Record<string, unknown>);
  }

  function xhrFormNdjson(
    url: string,
    formData: FormData,
    onUploadPercent: (percent: number) => void,
    onEvent: (ev: Record<string, unknown>) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.withCredentials = true;
      let seen = 0;
      let lineBuf = "";
      const consume = (chunk: string) => {
        lineBuf += chunk;
        const lines = lineBuf.split("\n");
        lineBuf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          onEvent(JSON.parse(line) as Record<string, unknown>);
        }
      };
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable || e.total <= 0) return;
        onUploadPercent(Math.max(0, Math.min(100, Math.round((e.loaded / e.total) * 100))));
      };
      xhr.onprogress = () => {
        const text = xhr.responseText.slice(seen);
        seen = xhr.responseText.length;
        try {
          consume(text);
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Bad progress event"));
        }
      };
      xhr.onload = () => {
        try {
          consume(xhr.responseText.slice(seen));
          if (lineBuf.trim()) onEvent(JSON.parse(lineBuf) as Record<string, unknown>);
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Bad upload response"));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(formData);
    });
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

  function openYtTagPrompt() {
    if (ytSelected.length === 0 || ytBusy) return;
    ytTagPromptOpen = true;
  }

  function closeYtTagPrompt() {
    if (ytBusy) return;
    ytTagPromptOpen = false;
  }

  $effect(() => {
    const el = ytTagDialog;
    if (!el) return;
    if (ytTagPromptOpen) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  });

  async function importSelectedPlaylists() {
    if (ytSelected.length === 0 || ytBusy) return;
    ytTagPromptOpen = false;
    ytPhase = "importing";
    ytError = null;
    ytImportSummary = null;
    ytImportProgress = { total: 0, done: 0, remaining: 0, imported: 0, skipped: 0, failed: 0, songs: [] };
    try {
      const res = await fetch("/api/youtube/import", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({
          playlistIds: ytSelected,
          tagIds: ytImportTagIds,
          customTag: ytImportCustomTag.trim() || undefined,
          sort: ytImportSort,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `Import failed (${res.status})`);
      }

      let sawDone = false;
      await readNdjsonStream(res, (ev) => {
        if (ev.type === "progress") {
          ytImportProgress = {
            total: Number(ev.total ?? 0),
            done: Number(ev.done ?? 0),
            remaining: Number(ev.remaining ?? 0),
            imported: Number(ev.imported ?? 0),
            skipped: Number(ev.skipped ?? 0),
            failed: Number(ev.failed ?? 0),
            currentTitle: typeof ev.currentTitle === "string" ? ev.currentTitle : null,
            songs: Array.isArray(ev.songs) ? (ev.songs as SongProgressView[]) : [],
          };
        } else if (ev.type === "done") {
          sawDone = true;
          ytImportSummary = {
            imported: Number(ev.imported ?? 0),
            skipped: Number(ev.skipped ?? 0),
            failed: Number(ev.failed ?? 0),
            errorMessage: (ev.errorMessage as string | null) ?? null,
            failures: (ev.failures as { title?: string | null; reason: string }[]) ?? [],
          };
          if ((ytImportSummary.failed ?? 0) > 0 && ytImportSummary.errorMessage) {
            ytError = ytImportSummary.errorMessage;
          }
        } else if (ev.type === "error") {
          throw new Error(typeof ev.message === "string" ? ev.message : "Import failed");
        }
      });

      if (!sawDone) throw new Error("Import ended without a result");
      ytImportTagIds = [];
      ytImportCustomTag = "";
      await invalidateAll();
      window.location.href = "/catalogue";
    } catch (err) {
      ytError = err instanceof Error ? err.message : "Import failed";
    } finally {
      ytPhase = "idle";
      ytImportProgress = null;
    }
  }

  async function importUrlSubmit(event: Event) {
    event.preventDefault();
    if (!ingestUrl.trim() || addBusy || !data.ingestReady) return;
    ingestBusy = true;
    ingestError = null;
    urlSongProgress = [];
    try {
      const res = await fetch("/api/ingest/url", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({ url: ingestUrl.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `Import failed (${res.status})`);
      }
      let sawDone = false;
      await readNdjsonStream(res, (ev) => {
        if (ev.type === "song") {
          const song: SongProgressView = {
            identityKey: typeof ev.identityKey === "string" ? ev.identityKey : "url",
            title: typeof ev.title === "string" ? ev.title : ingestUrl,
            phase: String(ev.phase ?? "downloading"),
            percent: Number(ev.percent ?? 0),
          };
          urlSongProgress = [song];
        } else if (ev.type === "done") {
          sawDone = true;
        } else if (ev.type === "error") {
          throw new Error(typeof ev.message === "string" ? ev.message : "Import failed");
        }
      });
      if (!sawDone) throw new Error("Import ended without a result");
      ingestUrl = "";
      await invalidateAll();
      window.location.href = "/catalogue";
    } catch (err) {
      ingestError = err instanceof Error ? err.message : "Import failed";
    } finally {
      ingestBusy = false;
      urlSongProgress = [];
    }
  }

  async function uploadFileSubmit(event: Event) {
    event.preventDefault();
    if (addBusy || !data.storageReady) return;
    const file = uploadFileInput?.files?.[0];
    if (!file) {
      uploadError = "Choose an audio file.";
      return;
    }
    uploadBusy = true;
    uploadError = null;
    uploadSongProgress = [
      {
        identityKey: "upload:local",
        title: uploadTitle || file.name,
        phase: "downloading",
        percent: 0,
      },
    ];
    try {
      const formData = new FormData();
      formData.set("file", file);
      if (uploadTitle.trim()) formData.set("title", uploadTitle.trim());
      for (const id of uploadTagIds) formData.append("tagIds", id);
      if (uploadCustomTag.trim()) formData.set("customTag", uploadCustomTag.trim());

      let sawDone = false;
      await xhrFormNdjson(
        "/api/ingest/upload",
        formData,
        (percent) => {
          uploadSongProgress = [
            {
              identityKey: "upload:local",
              title: uploadTitle || file.name,
              phase: "downloading",
              percent,
            },
          ];
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
            sawDone = true;
          } else if (ev.type === "error") {
            throw new Error(typeof ev.message === "string" ? ev.message : "Upload failed");
          }
        }
      );
      if (!sawDone) throw new Error("Upload ended without a result");
      uploadTagIds = [];
      uploadCustomTag = "";
      uploadTitle = "";
      if (uploadFileInput) uploadFileInput.value = "";
      await invalidateAll();
      window.location.href = "/catalogue";
    } catch (err) {
      uploadError = err instanceof Error ? err.message : "Upload failed";
    } finally {
      uploadBusy = false;
      uploadSongProgress = [];
    }
  }

  // After successful form upload action
  $effect(() => {
    if (form?.uploadOk) {
      window.location.href = "/catalogue";
    }
  });
</script>

<section class="space-y-6">
  <div>
    <h1 class="text-3xl font-semibold tracking-tight">Add music</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Import into the shared Zap catalogue (max 10 minutes per track). Then browse on
      <a href="/catalogue" class="text-signal hover:underline">Catalogue</a>.
    </p>
  </div>

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
          R2 ready
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
          href="/api/auth/youtube/start?returnTo=/add"
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
            detail={ytImportProgress && ytImportProgress.total > 0
              ? `${ytImportProgress.done}/${ytImportProgress.total} done · ${ytImportProgress.imported} ok · ${ytImportProgress.skipped} skipped · ${ytImportProgress.failed} failed · ${ytImportProgress.remaining} left`
              : `${ytSelected.length} playlist${ytSelected.length === 1 ? "" : "s"} · expanding & downloading in parallel…`}
          />
          <SongProgressList songs={ytImportProgress?.songs ?? []} />
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
            onclick={openYtTagPrompt}
          >
            {ytPhase === "importing" ? "Importing…" : `Import selected (${ytSelected.length})`}
          </button>
        {/if}
      {/if}

      <h2 class="mt-6 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Public URL</h2>
      {#if form?.ingestError}
        <p class="auth-error mt-2">{form.ingestError}</p>
      {/if}
      {#if ingestError}
        <p class="auth-error mt-2">{ingestError}</p>
      {/if}
      {#if form?.ingestOk && form.ingestSummary}
        <p class="mt-2 text-sm text-signal">
          Sync done — imported {form.ingestSummary.imported}, skipped {form.ingestSummary.skipped}, failed {form.ingestSummary.failed}.
        </p>
      {/if}
      <form class="mt-2 space-y-3" onsubmit={(e) => void importUrlSubmit(e)}>
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
          <BusyStatus label="Importing URL…" detail="Download then upload to R2" />
          <SongProgressList songs={urlSongProgress} />
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
      {#if uploadError}
        <p class="auth-error mt-2">{uploadError}</p>
      {/if}
      {#if form?.uploadOk}
        <p class="mt-2 text-sm text-signal">Added to catalogue.</p>
      {/if}
      <form class="mt-2 space-y-3" enctype="multipart/form-data" onsubmit={(e) => void uploadFileSubmit(e)}>
        <input
          class="auth-field"
          type="text"
          name="title"
          placeholder="Title (optional)"
          bind:value={uploadTitle}
          disabled={uploadBusy || ingestBusy || ytBusy}
        />
        <input
          class="auth-field"
          type="file"
          name="file"
          accept="audio/*"
          required
          bind:this={uploadFileInput}
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
          bind:value={uploadCustomTag}
          disabled={uploadBusy || ingestBusy || ytBusy}
        />
        <button type="submit" class="auth-btn" disabled={!data.storageReady || uploadBusy || ingestBusy || ytBusy}>
          {uploadBusy ? "Uploading…" : "Upload to Zap"}
        </button>
        {#if uploadBusy}
          <BusyStatus label="Uploading to Zap…" detail="Sending file, then storing on R2" />
          <SongProgressList songs={uploadSongProgress} sendingLabel="Sending" />
        {/if}
      </form>
    </div>
  </div>
</section>

<dialog
  bind:this={ytTagDialog}
  class="zap-dialog m-auto w-[min(100%,24rem)] rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-background/80"
  onclose={() => {
    ytTagPromptOpen = false;
  }}
  oncancel={(e) => {
    if (ytBusy) e.preventDefault();
  }}
>
  <div class="space-y-4 p-5">
    <div>
      <h2 class="text-lg font-semibold tracking-tight">Import options</h2>
      <p class="mt-2 text-sm text-muted-foreground">
        Choose sort order for songs from the selected playlist{ytSelected.length === 1 ? "" : "s"}, then optional tags applied to every imported
        track.
      </p>
    </div>
    <div>
      <p class="mb-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Sort order</p>
      <ZapSelect
        options={PLAYLIST_IMPORT_SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        bind:value={ytImportSort}
        disabled={ytBusy}
        placeholder="Sort order"
      />
    </div>
    <div>
      <p class="mb-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Tags</p>
      <TagMultiSelect options={data.availableTags} bind:selected={ytImportTagIds} name="ytImportTagIds" placeholder="Select tags…" />
    </div>
    <input class="auth-field" type="text" placeholder="New custom tag (optional)" bind:value={ytImportCustomTag} />
    <div class="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        class="rounded border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary disabled:opacity-40"
        disabled={ytBusy}
        onclick={closeYtTagPrompt}
      >
        Cancel
      </button>
      <button
        type="button"
        class="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        disabled={ytBusy || ytSelected.length === 0}
        onclick={() => void importSelectedPlaylists()}
      >
        Start import
      </button>
    </div>
  </div>
</dialog>
