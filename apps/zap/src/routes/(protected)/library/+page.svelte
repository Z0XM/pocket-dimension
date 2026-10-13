<script lang="ts">
  import { invalidateAll, replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import BusyStatus from "$lib/components/BusyStatus.svelte";
  import SongProgressList, { type SongProgressView } from "$lib/components/SongProgressList.svelte";
  import StartSessionButton from "$lib/components/StartSessionButton.svelte";
  import TagMultiSelect from "$lib/components/TagMultiSelect.svelte";
  import TrackRow, { type TrackItem } from "$lib/components/TrackRow.svelte";
  import ZapSelect from "$lib/components/ZapSelect.svelte";
  import { PLAYLIST_IMPORT_SORT_OPTIONS, type PlaylistImportSort } from "$lib/youtube-playlist-sort";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  type LibraryTab = "browse" | "upload" | "history";
  type YtPhase = "idle" | "linking" | "loading" | "importing" | "disconnecting";

  function initialTab(): LibraryTab {
    const t = page.url.searchParams.get("tab");
    if (t === "upload" || t === "history") return t;
    return "browse";
  }

  let tab = $state<LibraryTab>(initialTab());
  let scope = $state<"all" | "yours">("all");
  let q = $state("");
  let selected = $state<string[]>([]);
  /** Nested boolean tag filter, e.g. `love and (soft not upbeat)`. Wins over chip AND. */
  let tagQuery = $state("");
  let tagQueryError = $state<string | null>(null);
  let tagQueryInput = $state<HTMLInputElement | null>(null);
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
  const activity = $derived(data.activity ?? []);
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
    const key = `${data.scope}|${data.q}|${data.tagQuery}|${data.selectedTagIds.join(",")}|${data.nextOffset}|${data.assets.map((a) => a.id).join(",")}`;
    if (key === hydratedKey) return;
    hydratedKey = key;
    scope = data.scope === "yours" ? "yours" : "all";
    q = data.q;
    tagQuery = data.tagQuery ?? "";
    tagQueryError = data.tagQueryError ?? null;
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
      tab = "browse";
      void fetchPage({ reset: true });
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
      tab = "browse";
      void fetchPage({ reset: true });
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
      tab = "browse";
      void fetchPage({ reset: true });
    } catch (err) {
      uploadError = err instanceof Error ? err.message : "Upload failed";
    } finally {
      uploadBusy = false;
      uploadSongProgress = [];
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
    const tq = tagQuery.trim();
    if (tq) {
      params.set("tq", tq);
    } else {
      for (const id of selected) params.append("tag", id);
    }
    if (offset > 0) params.set("offset", String(offset));
    params.set("limit", String(data.pageSize));
    return params;
  }

  function updateUrl() {
    const params = new URLSearchParams();
    if (tab === "upload" || tab === "history") params.set("tab", tab);
    if (scope === "yours") params.set("scope", "yours");
    if (q.trim()) params.set("q", q.trim());
    const tq = tagQuery.trim();
    if (tq) {
      params.set("tq", tq);
    } else {
      for (const id of selected) params.append("tag", id);
    }
    const qs = params.toString();
    const href = qs ? `${page.url.pathname}?${qs}` : page.url.pathname;
    replaceState(href, {});
  }

  function formatActivityWhen(iso: string) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function activityKindLabel(kind: string) {
    if (kind === "playlist_import") return "Playlist";
    if (kind === "url_import") return "URL";
    if (kind === "upload") return "Upload";
    return kind;
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
      tagQueryError = null;
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
        tagQueryError?: string | null;
      };
      if (gen !== fetchGen) return;
      assets = opts.reset ? body.assets : [...assets, ...body.assets];
      hasMore = body.hasMore;
      nextOffset = body.nextOffset;
      tagQueryError = body.tagQueryError ?? null;
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

  function onTagQueryInput() {
    if (tagQuery.trim()) selected = [];
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      void fetchPage({ reset: true });
    }, 320);
  }

  function clearTagQuery() {
    if (!tagQuery && !tagQueryError) return;
    tagQuery = "";
    tagQueryError = null;
    void fetchPage({ reset: true });
  }

  /** Insert a keyword or tag name into the query at the caret (or append). */
  function insertIntoTagQuery(piece: string, { asToken = true }: { asToken?: boolean } = {}) {
    const el = tagQueryInput;
    const cur = tagQuery;
    const start = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? cur.length;
    const before = cur.slice(0, start);
    const after = cur.slice(end);
    const needsSpaceBefore = asToken && before.length > 0 && !/\s$/.test(before) && !/[(\[]$/.test(before);
    const needsSpaceAfter = asToken && after.length > 0 && !/^\s/.test(after) && !/^[)\]]/.test(after);
    const next = `${before}${needsSpaceBefore ? " " : ""}${piece}${needsSpaceAfter ? " " : ""}${after}`;
    tagQuery = next;
    selected = [];
    queueMicrotask(() => {
      if (!el) return;
      const pos = before.length + (needsSpaceBefore ? 1 : 0) + piece.length + (needsSpaceAfter ? 1 : 0);
      el.focus();
      el.setSelectionRange(pos, pos);
    });
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      void fetchPage({ reset: true });
    }, 320);
  }

  function onScope(next: "all" | "yours") {
    if (scope === next) return;
    scope = next;
    void fetchPage({ reset: true });
  }

  function toggleTag(id: string) {
    // Nested query mode: chip inserts the tag name into the expression.
    if (tagQuery.trim()) {
      const tag = data.availableTags.find((t) => t.id === id);
      if (tag) insertIntoTagQuery(tag.name);
      return;
    }
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
        Browse the catalogue, open <span class="font-mono text-signal">Add</span> for upload / URL / YouTube, or
        <span class="font-mono text-signal">History</span> for past imports. Tag chips AND together; use a tag query for
        <span class="font-mono text-signal">and</span> /
        <span class="font-mono text-signal">or</span> /
        <span class="font-mono text-signal">not</span>.
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
    <button
      type="button"
      role="tab"
      id="tab-history"
      aria-controls="panel-history"
      aria-selected={tab === "history"}
      class={`flex-1 rounded-md px-4 py-2.5 font-mono text-xs tracking-[0.18em] uppercase transition ${
        tab === "history"
          ? "bg-primary text-primary-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--signal)_35%,transparent)]"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      }`}
      onclick={() => setTab("history")}
    >
      History
    </button>
  </div>

  {#if tab === "browse"}
    <div class="space-y-4" role="tabpanel" id="panel-browse" aria-labelledby="tab-browse">
      <p class="text-sm text-muted-foreground">
        Search and filters apply as you go. Scroll for more. Sessions play from this catalogue — Discord attaches inside a session.
      </p>

      {#if data.suggestions?.length}
        <div class="space-y-2">
          <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Suggested from others</h2>
          <ul class="divide-y divide-border/50 rounded-lg border border-border/70 bg-card/30">
            {#each data.suggestions as track (track.id)}
              <TrackRow {track} availableTags={data.availableTags} bind:activeId bind:audioEl />
            {/each}
          </ul>
        </div>
      {/if}

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

        <div class="space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <label class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase" for="tag-query"> Tag query </label>
            <div class="flex flex-wrap gap-1">
              {#each ["and", "or", "not", "(", ")"] as kw}
                <button
                  type="button"
                  class="rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-signal hover:text-signal"
                  onclick={() => insertIntoTagQuery(kw)}
                >
                  {kw}
                </button>
              {/each}
              {#if tagQuery.trim()}
                <button
                  type="button"
                  class="rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-signal hover:text-signal"
                  onclick={clearTagQuery}
                >
                  clear
                </button>
              {/if}
            </div>
          </div>
          <input
            id="tag-query"
            class="auth-field font-mono text-sm"
            type="search"
            placeholder="love and (soft not upbeat)"
            bind:this={tagQueryInput}
            bind:value={tagQuery}
            oninput={onTagQueryInput}
            autocomplete="off"
            spellcheck="false"
          />
          {#if tagQueryError}
            <p class="auth-error text-xs">{tagQueryError}</p>
          {:else if tagQuery.trim()}
            <p class="font-mono text-[10px] text-muted-foreground">Nested filter active — chips insert tag names into the query.</p>
          {:else}
            <p class="font-mono text-[10px] text-muted-foreground">Optional. Chips below AND together when this is empty.</p>
          {/if}
        </div>

        <div class="flex flex-wrap gap-2">
          {#each data.availableTags as tag}
            <button
              type="button"
              class={`rounded-full border px-3 py-1 font-mono text-xs ${
                tagQuery.trim()
                  ? "border-border text-muted-foreground hover:border-signal hover:text-signal"
                  : selected.includes(tag.id)
                    ? "border-signal bg-signal/15 text-signal"
                    : "border-border text-muted-foreground"
              }`}
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
  {:else if tab === "upload"}
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
  {/if}

  {#if tab === "history"}
    <div id="panel-history" role="tabpanel" aria-labelledby="tab-history" class="space-y-8">
      <div class="space-y-3">
        <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Play history</h2>
        {#if !data.playHistory?.length}
          <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing played yet — start a session and hit play.
          </p>
        {:else}
          <ul class="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/30">
            {#each data.playHistory as play (play.id)}
              <li class="px-4 py-3">
                <div class="flex flex-wrap items-baseline justify-between gap-2">
                  <p class="text-sm font-medium">{play.title}</p>
                  <time class="font-mono text-[11px] text-muted-foreground" datetime={play.at}>{formatActivityWhen(play.at)}</time>
                </div>
                <p class="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {play.artists ?? "Unknown"}
                  {#if play.sessionId}
                    · session{/if}
                </p>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="space-y-3">
        <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Saved queues</h2>
        {#if !data.savedQueues?.length}
          <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
            Save a session queue to replay it later.
          </p>
        {:else}
          <ul class="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/30">
            {#each data.savedQueues as sq (sq.id)}
              <li class="px-4 py-3">
                <div class="flex flex-wrap items-baseline justify-between gap-2">
                  <p class="text-sm font-medium">{sq.name}</p>
                  <time class="font-mono text-[11px] text-muted-foreground" datetime={sq.createdAt}>{formatActivityWhen(sq.createdAt)}</time>
                </div>
                <p class="mt-0.5 font-mono text-[11px] text-muted-foreground">{sq.trackCount} tracks</p>
                {#if sq.titles?.length}
                  <p class="mt-1 truncate text-xs text-muted-foreground">{sq.titles.join(" · ")}</p>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="space-y-3">
        <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Uploads & imports</h2>
        {#if activity.length === 0}
          <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
            No uploads or imports yet. Add music from the Add tab.
          </p>
        {:else}
          <ul class="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/30">
            {#each activity as entry (entry.id)}
              <li class="px-4 py-3">
                <div class="flex flex-wrap items-baseline justify-between gap-2">
                  <span class="font-mono text-[10px] tracking-[0.14em] text-signal uppercase">
                    {activityKindLabel(entry.kind)}
                  </span>
                  <time class="font-mono text-[11px] text-muted-foreground" datetime={entry.at}>
                    {formatActivityWhen(entry.at)}
                  </time>
                </div>
                {#if entry.kind === "upload"}
                  <p class="mt-1 text-sm font-medium text-foreground">{entry.title}</p>
                {:else}
                  <p class="mt-1 text-sm font-medium text-foreground">{entry.label}</p>
                  <p class="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {entry.status}
                    · {entry.imported} imported
                    {#if entry.skipped > 0}· {entry.skipped} skipped{/if}
                    {#if entry.failed > 0}· {entry.failed} failed{/if}
                  </p>
                  {#if entry.songTitles?.length}
                    <ul class="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                      {#each entry.songTitles as title}
                        <li class="truncate">{title}</li>
                      {/each}
                      {#if entry.imported > entry.songTitles.length}
                        <li class="font-mono text-[10px]">+{entry.imported - entry.songTitles.length} more</li>
                      {/if}
                    </ul>
                  {/if}
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {/if}
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
