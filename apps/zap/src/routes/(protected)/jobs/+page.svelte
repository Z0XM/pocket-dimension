<script lang="ts">
  import { goto } from "$app/navigation";
  import LoaderIcon from "@lucide/svelte/icons/loader";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let tab = $state<"active" | "failed">(data.tab === "failed" ? "failed" : "active");
  let jobs = $state(data.jobs ?? []);
  let failedItems = $state(data.failedItems ?? []);
  let runningCount = $state(data.runningCount ?? 0);
  let busyItemId = $state<string | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    tab = data.tab === "failed" ? "failed" : "active";
    jobs = data.jobs ?? [];
    failedItems = data.failedItems ?? [];
    runningCount = data.runningCount ?? 0;
  });

  async function refresh() {
    const res = await fetch(`/api/jobs?tab=${tab}`, { credentials: "same-origin" });
    if (!res.ok) return;
    const body = await res.json();
    runningCount = body.runningCount ?? 0;
    if (tab === "failed") failedItems = body.items ?? [];
    else jobs = body.jobs ?? [];
  }

  $effect(() => {
    if (runningCount <= 0 && tab !== "active") return;
    const id = setInterval(() => {
      void refresh();
    }, 2500);
    return () => clearInterval(id);
  });

  function setTab(next: "active" | "failed") {
    tab = next;
    void goto(`/jobs?tab=${next}`, { replaceState: true, keepFocus: true, noScroll: true });
  }

  async function retryItem(itemId: string) {
    busyItemId = itemId;
    error = null;
    try {
      const res = await fetch(`/api/jobs/items/${encodeURIComponent(itemId)}/retry`, {
        method: "POST",
        credentials: "same-origin",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Retry failed");
      await refresh();
    } catch (err) {
      error = err instanceof Error ? err.message : "Retry failed";
    } finally {
      busyItemId = null;
    }
  }

  function when(iso: string | null | undefined) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  function progressLabel(job: (typeof jobs)[number]) {
    if (job.status === "queued") return "Queued";
    if (job.total > 0) return `${job.done}/${job.total}`;
    if (job.done > 0) return `${job.done} processed`;
    return job.currentTitle ? "Working…" : "Starting…";
  }
</script>

<section class="zap-page">
  <PageHeader title="Running Jobs">
    {#snippet meta()}
      {runningCount} active · {failedItems.length} failed song{failedItems.length === 1 ? "" : "s"}
    {/snippet}
  </PageHeader>

  <div class="mb-4 flex gap-1 border-b border-border/60">
    <button
      type="button"
      class={`px-3 py-2 font-mono text-[11px] tracking-[0.12em] uppercase ${
        tab === "active" ? "border-b-2 border-signal text-signal" : "text-muted-foreground hover:text-signal"
      }`}
      onclick={() => setTab("active")}
    >
      Active
    </button>
    <button
      type="button"
      class={`px-3 py-2 font-mono text-[11px] tracking-[0.12em] uppercase ${
        tab === "failed" ? "border-b-2 border-signal text-signal" : "text-muted-foreground hover:text-signal"
      }`}
      onclick={() => setTab("failed")}
    >
      Failed
    </button>
  </div>

  {#if error}
    <p class="auth-error">{error}</p>
  {/if}

  {#if tab === "active"}
    {#if jobs.length === 0}
      <p class="rounded border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
        No running or recent imports. Start one from Add song or Connections → YouTube.
      </p>
    {:else}
      <ul class="divide-y divide-border/50 border border-border/70 bg-card">
        {#each jobs as job (job.id)}
          <li class="space-y-1.5 px-4 py-3">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{job.label}</p>
                <p class="font-mono text-[10px] text-muted-foreground">
                  {job.status} · {progressLabel(job)}
                  {#if job.importedCount || job.failedCount || job.skippedCount}
                    · +{job.importedCount} · fail {job.failedCount} · skip {job.skippedCount}
                  {/if}
                </p>
                {#if job.currentTitle}
                  <p class="mt-0.5 truncate font-mono text-[10px] text-signal/80">{job.currentTitle}</p>
                {/if}
                {#if job.errorMessage}
                  <p class="mt-0.5 font-mono text-[10px] text-destructive">{job.errorMessage}</p>
                {/if}
              </div>
              {#if job.status === "queued" || job.status === "running"}
                <LoaderIcon class="size-4 shrink-0 animate-spin text-signal" aria-hidden="true" />
              {/if}
            </div>
            {#if job.total > 0 && (job.status === "running" || job.status === "queued")}
              <div class="h-1 overflow-hidden rounded bg-border/60">
                <div class="h-full bg-signal transition-all" style={`width: ${Math.min(100, Math.round((job.done / job.total) * 100))}%`}></div>
              </div>
            {/if}
            <p class="font-mono text-[10px] text-muted-foreground">Updated {when(job.updatedAt)}</p>
          </li>
        {/each}
      </ul>
    {/if}
  {:else if failedItems.length === 0}
    <p class="rounded border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
      No failed song imports.
    </p>
  {:else}
    <ul class="divide-y divide-border/50 border border-border/70 bg-card">
      {#each failedItems as item (item.id)}
        <li class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium">{item.title ?? item.identityKey}</p>
            <p class="font-mono text-[10px] text-muted-foreground">
              {item.jobLabel}
              {#if item.reason}
                · {item.reason}{/if}
            </p>
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground hover:text-signal disabled:opacity-40"
            disabled={busyItemId !== null}
            onclick={() => void retryItem(item.id)}
          >
            {#if busyItemId === item.id}
              …
            {:else}
              <RotateCcwIcon class="size-3.5" aria-hidden="true" />
              Retry
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>
